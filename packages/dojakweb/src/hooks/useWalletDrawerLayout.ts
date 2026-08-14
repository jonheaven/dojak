'use client';

import { useCallback, useEffect, useState } from 'react';

export type WalletDrawerLayout = 'paw' | 'dock';

export const WALLET_DRAWER_LAYOUT_KEY = 'dojakweb.walletDrawer.layout.v1';
export const WALLET_DRAWER_LAYOUT_EVENT = 'dojakweb-wallet-drawer-layout';

export function readWalletDrawerLayout(): WalletDrawerLayout {
  if (typeof window === 'undefined') return 'paw';
  try {
    const raw = window.localStorage.getItem(WALLET_DRAWER_LAYOUT_KEY);
    if (raw === 'dock' || raw === 'paw') return raw;
  } catch {
    /* ignore quota / private mode */
  }
  return 'paw';
}

export function writeWalletDrawerLayout(layout: WalletDrawerLayout): void {
  try {
    window.localStorage.setItem(WALLET_DRAWER_LAYOUT_KEY, layout);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(WALLET_DRAWER_LAYOUT_EVENT));
}

/** Paw overlay (default) vs DevTools-style right column. Persists in localStorage. */
export function useWalletDrawerLayout(): [
  WalletDrawerLayout,
  (layout: WalletDrawerLayout) => void,
  () => void,
] {
  const [layout, setLayoutState] = useState<WalletDrawerLayout>(readWalletDrawerLayout);

  useEffect(() => {
    const sync = () => setLayoutState(readWalletDrawerLayout());
    window.addEventListener(WALLET_DRAWER_LAYOUT_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(WALLET_DRAWER_LAYOUT_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setLayout = useCallback((next: WalletDrawerLayout) => {
    writeWalletDrawerLayout(next);
    setLayoutState(next);
  }, []);

  const toggleLayout = useCallback(() => {
    setLayout(layout === 'paw' ? 'dock' : 'paw');
  }, [layout, setLayout]);

  return [layout, setLayout, toggleLayout];
}
