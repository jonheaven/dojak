import { useCallback } from 'react';
import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';
import { useBrowserWallet } from '../contexts/BrowserWalletContext';
import { resolveDuneTxSigner, type DuneTxSignerResult } from '../lib/dune-tx-signer';

/** Resolve the active wallet for Ðune etch / mint / send (browser WIF or extension PSBT). */
export function useDuneTxSigner() {
  const { walletType, address, connected, signPSBTOnly } = useUnifiedWallet();
  const browser = useBrowserWallet();

  return useCallback(async (): Promise<DuneTxSignerResult> => {
    return resolveDuneTxSigner({ walletType, address, connected }, browser, signPSBTOnly);
  }, [address, browser, connected, signPSBTOnly, walletType]);
}
