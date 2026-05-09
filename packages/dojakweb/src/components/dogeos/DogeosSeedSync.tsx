'use client';

import { useEffect } from 'react';
import { useBrowserWallet } from '@/contexts/BrowserWalletContext';
import { deriveDogeosAddressFromMnemonic } from '@/lib/seedDerivation';
import { useWalletStore } from '@/stores/walletStore';

interface DogeosSeedSyncProps {
  /** L1 browser wallet address */
  dogecoinAddress: string | null | undefined;
  isBrowserWallet: boolean;
  dogeosEnabled: boolean;
  unlockPassword?: string;
  pendingMnemonic?: string | null;
  pendingPassphrase?: string;
}

/**
 * When DogeOS is enabled and we have a mnemonic (pending creation flow or unlocked session),
 * derive the EVM receive address and mirror the L1 address into the ecosystem store.
 */
export function DogeosSeedSync({
  dogecoinAddress,
  isBrowserWallet,
  dogeosEnabled,
  unlockPassword,
  pendingMnemonic,
  pendingPassphrase,
}: DogeosSeedSyncProps) {
  const browser = useBrowserWallet();
  const setDogeosAddress = useWalletStore((s) => s.setDogeosAddress);
  const setDogecoinAddress = useWalletStore((s) => s.setDogecoinAddress);

  useEffect(() => {
    if (!dogeosEnabled || !isBrowserWallet || !dogecoinAddress) {
      setDogeosAddress(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        if (pendingMnemonic) {
          const addr = deriveDogeosAddressFromMnemonic(pendingMnemonic, pendingPassphrase ?? '');
          if (!cancelled) {
            setDogecoinAddress(dogecoinAddress);
            setDogeosAddress(addr);
          }
          return;
        }
        const seed = await browser.loadSeedMaterial(unlockPassword, dogecoinAddress);
        if (cancelled || !seed?.mnemonic) {
          if (!cancelled) setDogeosAddress(null);
          return;
        }
        const addr = deriveDogeosAddressFromMnemonic(seed.mnemonic, seed.passphrase);
        setDogecoinAddress(dogecoinAddress);
        setDogeosAddress(addr);
      } catch {
        if (!cancelled) setDogeosAddress(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    browser,
    dogecoinAddress,
    dogeosEnabled,
    isBrowserWallet,
    pendingMnemonic,
    pendingPassphrase,
    setDogeosAddress,
    setDogecoinAddress,
    unlockPassword,
  ]);

  return null;
}
