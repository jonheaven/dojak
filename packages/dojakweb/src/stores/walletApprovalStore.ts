/**
 * Host dApp → Local Browser Wallet approval queue (MetaMask-style).
 *
 * Hosts call `requestWalletApproval(...)`; ConnectWalletButton opens the drawer
 * and WalletApprovalPanel prompts the user. Approve runs `onApprove` with the
 * unlocked session key; Reject / dismiss rejects the promise.
 */
import { useDxHostStore } from './dxHostStore';

export type WalletApprovalDetail = {
  label: string;
  value: string;
};

export type WalletApprovalSession = {
  /** Unlocked session WIF — only available after user has unlocked local wallet. */
  privateKeyWif: string;
  address: string;
};

export type WalletApprovalRequest = {
  /** Short title shown at top of approval sheet */
  title: string;
  /** Optional longer explanation */
  description?: string;
  /** Key/value rows (amount, recipient, picks, etc.) */
  details?: WalletApprovalDetail[];
  approveLabel?: string;
  rejectLabel?: string;
  /**
   * Runs only after the user taps Approve with an unlocked browser session.
   * Throw an Error to show the message and keep the sheet open for retry.
   */
  onApprove: (session: WalletApprovalSession) => Promise<unknown>;
};

type InternalPending = WalletApprovalRequest & {
  id: string;
  status: 'pending' | 'working' | 'error';
  error?: string;
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
};

type Listener = () => void;

let pending: InternalPending | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

export function getWalletApprovalPending(): InternalPending | null {
  return pending;
}

export function subscribeWalletApproval(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function openDrawer() {
  try {
    useDxHostStore.getState().signalOpenWallet();
  } catch {
    /* store always available */
  }
}

/**
 * Open the wallet drawer and wait for user approval of a dynamic signing action.
 * Rejects with `WalletApprovalCancelledError` if the user rejects or closes the drawer.
 */
export function requestWalletApproval(request: WalletApprovalRequest): Promise<unknown> {
  if (pending) {
    return Promise.reject(
      new Error('Another wallet approval is already pending. Finish or reject it first.'),
    );
  }

  return new Promise((resolve, reject) => {
    pending = {
      ...request,
      id: `wa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      status: 'pending',
      resolve,
      reject,
    };
    emit();
    openDrawer();
  });
}

/** Imperatively open the host wallet drawer (no approval request). */
export function openWalletDrawer(): void {
  openDrawer();
}

export function setWalletApprovalWorking(working: boolean, error?: string) {
  if (!pending) return;
  pending = {
    ...pending,
    status: working ? 'working' : error ? 'error' : 'pending',
    error,
  };
  emit();
}

export function resolveWalletApproval(value: unknown) {
  if (!pending) return;
  const p = pending;
  pending = null;
  emit();
  p.resolve(value);
}

export function rejectWalletApproval(message = 'User rejected the request') {
  if (!pending) return;
  const p = pending;
  pending = null;
  emit();
  p.reject(new WalletApprovalCancelledError(message));
}

export class WalletApprovalCancelledError extends Error {
  readonly code = 'WALLET_APPROVAL_CANCELLED';
  constructor(message = 'User rejected the request') {
    super(message);
    this.name = 'WalletApprovalCancelledError';
  }
}

/** React hook-friendly snapshot via useSyncExternalStore. */
export const walletApprovalStore = {
  subscribe: subscribeWalletApproval,
  getSnapshot: getWalletApprovalPending,
  getServerSnapshot: () => null as InternalPending | null,
};
