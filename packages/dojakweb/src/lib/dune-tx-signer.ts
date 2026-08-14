import type { WalletType } from '../types/wallet';
import type { UseBrowserWalletReturn } from '../contexts/BrowserWalletContext';

/** How a Dune OP_RETURN tx is signed before broadcast. */
export type DuneTxSigner = {
  fromAddress: string;
  privateKeyWIF?: string;
  signPsbt?: (psbtBase64: string) => Promise<string>;
};

export type DuneTxSignerResult =
  | { ok: true; signer: DuneTxSigner }
  | { ok: false; message: string };

const PSBT_WALLET_TYPES: WalletType[] = ['mydoge', 'spookydoge', 'dogesoft', 'dojak', 'dogewatch', 'browser'];

function hasPsbtSigning(type: WalletType | null): type is WalletType {
  return type !== null && PSBT_WALLET_TYPES.includes(type);
}

async function loadBrowserWalletForSigning(
  browser: UseBrowserWalletReturn,
  targetAddress?: string | null,
): Promise<DuneTxSigner | null> {
  const active = browser.wallet;
  if (active?.address && (!targetAddress || active.address === targetAddress)) {
    if (active.privateKey) {
      return { fromAddress: active.address, privateKeyWIF: active.privateKey };
    }
    return { fromAddress: active.address };
  }

  try {
    const loaded = await browser.loadWallet(undefined, targetAddress || undefined);
    if (loaded?.address && loaded.privateKey) {
      await browser.connect(loaded);
      return { fromAddress: loaded.address, privateKeyWIF: loaded.privateKey };
    }
    if (loaded?.address) {
      return { fromAddress: loaded.address };
    }
  } catch {
    // Encrypted / locked / unavailable browser wallet.
  }

  return null;
}

/**
 * Resolve signing for Dune etch / mint / send.
 * - Unlocked in-browser wallet -> local WIF sign (fast path)
 * - Connected in-browser wallet (locked) -> PSBT via signPSBTOnly (unlock prompt)
 * - MyDoge, Dojak ext, SpookyDoge, Dogewatch -> PSBT via signPSBTOnly
 */
export async function resolveDuneTxSigner(
  unified: {
    walletType: WalletType | null;
    address: string | null;
    connected: boolean;
  },
  browser: UseBrowserWalletReturn,
  signPSBTOnly: (psbtInput: string) => Promise<string>,
): Promise<DuneTxSignerResult> {
  const browserAddress = browser.wallet?.address ?? browser.address;

  // In-browser wallet is authoritative when connected, even if unified walletType is stale.
  if (browser.connected && browserAddress) {
    const browserSigner = await loadBrowserWalletForSigning(browser, browserAddress);
    if (browserSigner?.privateKeyWIF) {
      return { ok: true, signer: browserSigner };
    }

    return {
      ok: true,
      signer: {
        fromAddress: browserSigner?.fromAddress || browserAddress,
        signPsbt: signPSBTOnly,
      },
    };
  }

  // Unified state can mark browser active before BrowserWalletContext finishes connecting.
  if (unified.walletType === 'browser') {
    const browserSigner = await loadBrowserWalletForSigning(browser, browserAddress || unified.address);
    if (browserSigner?.privateKeyWIF) {
      return { ok: true, signer: browserSigner };
    }
  }

  if (unified.connected && unified.address && hasPsbtSigning(unified.walletType)) {
    return {
      ok: true,
      signer: {
        fromAddress: unified.address,
        signPsbt: signPSBTOnly,
      },
    };
  }

  if (unified.walletType === 'ledger') {
    return {
      ok: false,
      message:
        'Ledger cannot sign Dune OP_RETURN PSBTs from the browser yet. Use MyDoge, Dojak, SpookyDoge, or the in-browser Dojak wallet.',
    };
  }

  // Browser may be ready even when unified.connected is still false.
  if (browserAddress && (browser.connected || unified.walletType === 'browser')) {
    return {
      ok: true,
      signer: {
        fromAddress: browserAddress,
        signPsbt: signPSBTOnly,
      },
    };
  }

  // The host may show the browser wallet address before walletType catches up.
  if (unified.address && (await browser.hasWallet().catch(() => false))) {
    const browserSigner = await loadBrowserWalletForSigning(browser, unified.address);
    if (browserSigner?.privateKeyWIF) {
      return { ok: true, signer: browserSigner };
    }
  }

  if (!unified.connected || !unified.address) {
    return {
      ok: false,
      message: 'Connect a wallet (MyDoge, Dojak, SpookyDoge, or in-browser Dojak) before signing.',
    };
  }

  const hasBrowser = await browser.hasWallet().catch(() => false);
  if (hasBrowser) {
    return {
      ok: false,
      message: 'Unlock your in-browser Dojak wallet, or switch to an extension wallet that supports PSBT signing.',
    };
  }

  return {
    ok: false,
    message: 'Connect MyDoge, Dojak, SpookyDoge, or create an in-browser Dojak wallet to etch Dunes.',
  };
}

export function assertDuneTxSigner(signer: DuneTxSigner): void {
  if (!signer.fromAddress?.trim()) {
    throw new Error('Wallet address is required');
  }
  if (!signer.privateKeyWIF && !signer.signPsbt) {
    throw new Error('No signing method available for this wallet');
  }
}
