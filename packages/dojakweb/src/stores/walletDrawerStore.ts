/**
 * One wallet surface for the whole page.
 * Every ConnectWalletButton used to mount its own drawer, so Buy opened
 * two phones on top of each other. Closing the top one rejected the signature.
 */
import type { WalletOpenFocus } from './dxHostStore';

export type WalletDrawerStep =
  | 'chooser'
  | 'entry'
  | 'dashboard'
  | 'settings'
  | 'unlock'
  | 'verification';

export type WalletDrawerSnapshot = {
  open: boolean;
  step: WalletDrawerStep;
  nonce: number;
  focus: WalletOpenFocus | null;
  isDark: boolean | null;
  mode: 'drawer' | 'modal';
};

const SERVER_SNAPSHOT: WalletDrawerSnapshot = {
  open: false,
  step: 'dashboard',
  nonce: 0,
  focus: null,
  isDark: null,
  mode: 'drawer',
};

let state: WalletDrawerSnapshot = { ...SERVER_SNAPSHOT };
const listeners = new Set<() => void>();

/** First ConnectWalletButton on the page owns the single drawer. */
let hostSerial = 0;
let hostId = 0;

export function claimWalletDrawerHost(): number {
  const id = ++hostSerial;
  if (hostId === 0) hostId = id;
  return id;
}

export function releaseWalletDrawerHost(id: number): void {
  if (hostId === id) hostId = 0;
}

export function isWalletDrawerHost(id: number): boolean {
  return id !== 0 && hostId === id;
}

function emit(): void {
  for (const listener of listeners) listener();
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent('dojakweb-wallet-drawer-changed', { detail: { open: state.open } }),
    );
  } catch {
    /* non-DOM */
  }
}

export function getWalletDrawerSnapshot(): WalletDrawerSnapshot {
  return state;
}

export function getWalletDrawerServerSnapshot(): WalletDrawerSnapshot {
  return SERVER_SNAPSHOT;
}

export function subscribeWalletDrawer(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function presentWalletDrawer(opts?: {
  step?: WalletDrawerStep;
  focus?: WalletOpenFocus | null;
  isDark?: boolean;
  mode?: 'drawer' | 'modal';
}): void {
  const step = opts?.step ?? (state.open ? state.step : 'dashboard');
  const focus = opts?.focus === undefined ? state.focus : opts.focus;
  const isDark = opts?.isDark ?? state.isDark;
  const mode = opts?.mode ?? state.mode;
  if (state.open && state.step === step && state.mode === mode && state.focus === focus && state.isDark === isDark) {
    return;
  }
  const reopen = !state.open || state.step !== step;
  state = {
    open: true,
    step,
    nonce: reopen ? state.nonce + 1 : state.nonce,
    focus,
    isDark,
    mode,
  };
  emit();
}

export function dismissWalletDrawer(): void {
  if (!state.open) return;
  state = { ...state, open: false };
  emit();
}

let eventsInstalled = false;

/** Sidebar / command palette open the one drawer via `dojakweb-open-wallet`. */
export function installWalletDrawerWindowEvents(): void {
  if (eventsInstalled || typeof window === 'undefined') return;
  eventsInstalled = true;
  window.addEventListener('dojakweb-open-wallet', (event: Event) => {
    const detail = (event as CustomEvent<{ initialStep?: WalletDrawerStep; focus?: string }>).detail;
    const step: WalletDrawerStep =
      detail?.initialStep ?? (detail?.focus === 'verification' ? 'verification' : 'dashboard');
    presentWalletDrawer({ step });
  });
}
