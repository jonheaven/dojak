import { useMemo } from 'react';
import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';
import { useBrowserWallet } from '../contexts/BrowserWalletContext';

/**
 * Connection state for Ðune modals.
 * In-browser Dojak wallets often live in BrowserWalletContext while
 * UnifiedWalletContext can lag (connected=false) — treat either as ready.
 */
export function useDuneWalletConnection() {
  const unified = useUnifiedWallet();
  const browser = useBrowserWallet();

  return useMemo(() => {
    const browserAddress =
      browser.wallet?.address?.trim() || browser.address?.trim() || null;
    const browserReady = Boolean(browser.connected && browserAddress);
    const unifiedReady = Boolean(unified.connected && unified.address?.trim());
    // Stale type=browser with a loaded address still counts
    const browserTypeReady = Boolean(
      unified.walletType === 'browser' && browserAddress,
    );

    const connected = browserReady || unifiedReady || browserTypeReady;
    const address =
      (unifiedReady ? unified.address : null) ||
      browserAddress ||
      unified.address ||
      null;

    return {
      connected,
      address,
      walletType: unified.walletType,
      /** True when in-browser wallet is the active path */
      isBrowser: browserReady || unified.walletType === 'browser',
    };
  }, [
    browser.address,
    browser.connected,
    browser.wallet?.address,
    unified.address,
    unified.connected,
    unified.walletType,
  ]);
}
