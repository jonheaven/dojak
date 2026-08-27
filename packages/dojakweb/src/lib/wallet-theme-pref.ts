/** Wallet chrome theme (settings Dark/Light). Independent of host `theme` until the user picks. */

export type WalletChromeTheme = 'dark' | 'light';

export const WALLET_THEME_KEY = 'dojakweb.wallet.theme.v1';
export const WALLET_THEME_EVENT = 'dojakweb-wallet-theme';

export function readWalletTheme(): WalletChromeTheme | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(WALLET_THEME_KEY);
    if (raw === 'dark' || raw === 'light') return raw;
  } catch {
    /* quota / private mode */
  }
  return null;
}

export function writeWalletTheme(theme: WalletChromeTheme): void {
  try {
    window.localStorage.setItem(WALLET_THEME_KEY, theme);
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(WALLET_THEME_EVENT));
  }
}
