'use client';

import { useCallback, useEffect, useState } from 'react';
import { useGlobalStore } from '../stores/globalStore';

export type WalletDrawerLayout = 'paw' | 'dock' | 'modal';

export const WALLET_DRAWER_LAYOUT_KEY = 'dojakweb.walletDrawer.layout.v1';
export const WALLET_DRAWER_LAYOUT_EVENT = 'dojakweb-wallet-drawer-layout';

function readLegacyModal(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem('dojakweb-global-store');
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { state?: { walletInterface?: string } };
    return parsed.state?.walletInterface === 'modal';
  } catch {
    return false;
  }
}

export function readWalletDrawerLayout(): WalletDrawerLayout {
  if (typeof window === 'undefined') return 'paw';
  try {
    const raw = window.localStorage.getItem(WALLET_DRAWER_LAYOUT_KEY);
    if (raw === 'dock' || raw === 'paw' || raw === 'modal') return raw;
  } catch {
    /* ignore quota / private mode */
  }
  return readLegacyModal() ? 'modal' : 'paw';
}

export function writeWalletDrawerLayout(layout: WalletDrawerLayout): void {
  try {
    window.localStorage.setItem(WALLET_DRAWER_LAYOUT_KEY, layout);
  } catch {
    /* ignore */
  }
  try {
    useGlobalStore.getState().setWalletInterface(layout === 'modal' ? 'modal' : 'drawer');
  } catch {
    /* store may not be hydrated yet */
  }
  window.dispatchEvent(new Event(WALLET_DRAWER_LAYOUT_EVENT));
}

/** Paw overlay (default), DevTools-style dock, or centered modal. Persists in localStorage. */
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
