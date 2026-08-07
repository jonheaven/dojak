/**
 * Host dApp → Local Browser Wallet approval queue (MetaMask-style).
 *
 * Hosts call `requestWalletApproval(...)`; ConnectWalletButton opens the drawer
 * and WalletApprovalPanel prompts the user. Approve runs `onApprove` with the
 * unlocked session key; Reject / dismiss rejects the promise.
 */
import { useDxHostStore, type WalletOpenFocus } from './dxHostStore';

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

function openDrawer(focus?: WalletOpenFocus | null) {
  try {
    useDxHostStore.getState().signalOpenWallet(focus ?? null);
  } catch {
    /* store always available */
  }
}

function closeDrawer() {
  try {
    useDxHostStore.getState().signalCloseWallet();
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
export function openWalletDrawer(
  opts?: WalletOpenFocus | { focus: 'dlotto' } | 'dlotto' | null,
): void {
  if (!opts) {
    openDrawer(null);
    return;
  }
  if (opts === 'dlotto') {
    openDrawer({ tab: 'assets', assetType: 'nft', nftFilter: 'dlotto' });
    return;
  }
  if (typeof opts === 'object' && 'focus' in opts && (opts as { focus?: string }).focus === 'dlotto') {
    openDrawer({ tab: 'assets', assetType: 'nft', nftFilter: 'dlotto' });
    return;
  }
  openDrawer(opts as WalletOpenFocus);
}

export type { WalletOpenFocus };

export function setWalletApprovalWorking(working: boolean, error?: string) {
  if (!pending) return;
  pending = {
    ...pending,
    status: working ? 'working' : error ? 'error' : 'pending',
    error,
  };
  emit();
}

/** True while Approve is signing/broadcasting — Cancel / drawer-close must not abort. */
export function isWalletApprovalWorking(): boolean {
  return pending?.status === 'working';
}

export function resolveWalletApproval(value: unknown) {
  if (!pending) return;
  const p = pending;
  pending = null;
  emit();
  p.resolve(value);
  // Same UX as extension popups: once the signing/broadcast action succeeds,
  // dismiss the wallet surface so the host app can show the receipt/result.
  closeDrawer();
}

/**
 * Reject / dismiss the pending approval.
 * Returns false if signing is already in flight — Cancel is too late once broadcast may have started.
 */
export function rejectWalletApproval(message = 'User rejected the request'): boolean {
  if (!pending) return false;
  if (pending.status === 'working') {
    return false;
  }
  const p = pending;
  pending = null;
  emit();
  p.reject(new WalletApprovalCancelledError(message));
  // Same UX as pressing X — dismiss the paw / drawer after reject.
  closeDrawer();
  return true;
}

export class WalletApprovalCancelledError extends Error {
  readonly code = 'WALLET_APPROVAL_CANCELLED';
  constructor(message = 'User rejected the request') {
    super(message);
    this.name = 'WalletApprovalCancelledError';
  }
}

export function isWalletApprovalCancelled(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: string };
  return e.name === 'WalletApprovalCancelledError' || e.code === 'WALLET_APPROVAL_CANCELLED';
}

/** React hook-friendly snapshot via useSyncExternalStore. */
export const walletApprovalStore = {
  subscribe: subscribeWalletApproval,
  getSnapshot: getWalletApprovalPending,
  getServerSnapshot: () => null as InternalPending | null,
};
