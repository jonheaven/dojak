/**
 * Spooky Doge 1.3 injects both `window.spookyWallet` and `window.dogecoin`,
 * then fires `spookyWallet#initialized` and `dogecoin#initialized`.
 * Prefer the dedicated object so another wallet replacing `window.dogecoin`
 * cannot hide an installed Spooky extension.
 */
export type SpookyInjectedProvider = {
  isSpookyWallet?: boolean;
  isConnected?: () => boolean;
  connect?: () => Promise<unknown>;
  disconnect?: () => Promise<unknown>;
  getAddress?: () => Promise<string>;
  getAccounts?: () => Promise<string[]>;
  getBalance?: () => Promise<unknown>;
  request?: (args: { method: string; params?: unknown }) => Promise<unknown>;
  on?: (event: string, callback: (data?: unknown) => void) => void;
  removeListener?: (event: string, callback: (data?: unknown) => void) => void;
  [key: string]: unknown;
};

type SpookyWindow = Window & {
  spookyWallet?: SpookyInjectedProvider;
  dogecoin?: SpookyInjectedProvider;
  isSpookyWallet?: boolean;
  __DOJAKWEB_FLAGS?: { isSpookyWallet?: boolean };
};

export const SPOOKY_INIT_EVENTS = [
  'spookyWallet#initialized',
  'dogecoin#initialized',
  'spookydoge#initialized',
] as const;

export function getInjectedSpookyProvider(): SpookyInjectedProvider | null {
  if (typeof window === 'undefined') return null;
  const w = window as SpookyWindow;
  const dedicated = w.spookyWallet;
  if (dedicated?.isSpookyWallet === true) return dedicated;
  const hinted = Boolean(w.isSpookyWallet || w.__DOJAKWEB_FLAGS?.isSpookyWallet);
  const shared = w.dogecoin;
  if (shared && (shared.isSpookyWallet === true || hinted)) return shared;
  return null;
}
