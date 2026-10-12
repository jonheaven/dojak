import { Message } from '@dojak/core/utils';
import type { SendDogecoinRequest, SendDogecoinResult, WalletCoreAdapter, WalletTransaction } from '@dojak/ui';
import { storage } from '@dojak/core';

const BALANCE_KEY = 'popup-balance';
const ADDRESS_KEY = 'popup-address';
const TXS_KEY = 'popup-transactions';
const fallbackAddress = 'D8n4gQ8S4aQszM4xTq3w9fF6xR9H1skGgT';

type WalletProxy = {
  isUnlocked: () => Promise<boolean>;
  hasVault: () => Promise<boolean>;
  getCurrentAccount: () => Promise<{ address?: string } | null>;
  getAddressBalance: (address: string) => Promise<{ amount?: number } | null>;
  sendAndBroadcastDOGE: (params: {
    to: string;
    amount: number;
    feeRate: number;
    enableRBF?: boolean;
    memo?: string;
    memos?: string[];
  }) => Promise<{ txid: string; rawtx?: string; fee?: number }>;
  publishDxRegister: (params: { handle: string; tweetId: string; feeRate?: number }) => Promise<{ txid: string }>;
  getAddressHistory?: (params: { address: string; start: number; limit: number }) => Promise<{ list?: WalletTransaction[] }>;
  listPopupDoginals: () => Promise<import('@dojak/ui').PopupDoginal[]>;
  listPopupTokens: () => Promise<{ drc20: import('@dojak/ui').PopupDrc20[]; dunes: import('@dojak/ui').PopupDune[] }>;
  protectInscription: (params: { inscriptionId: string; feeRate?: number }) => Promise<{ already: boolean; txid: string | null }>;
  sendPopupInscription: (params: { inscriptionId: string; to: string; feeRate?: number }) => Promise<{ txid: string }>;
  listPopupInscriptionForSale: (params: { inscriptionId: string; priceDoge: number }) => Promise<unknown>;
  getConnectedSites: () => Promise<import('@dojak/ui').ConnectedSiteRow[]>;
  removeConnectedSite: (origin: string) => Promise<void>;
  resolvePopupName: (input: string) => Promise<string>;
  listPopupDns: () => Promise<{ name: string; address: string }[]>;
  getAutoLockTimeId: () => Promise<number>;
  setAutoLockTimeId: (timeId: number) => Promise<void>;
};

function createWalletProxy(): WalletProxy {
  const { PortMessage } = Message;
  const pm = new PortMessage().connect('popup');
  return new Proxy({} as WalletProxy, {
    get(_obj, key: string) {
      return (...params: unknown[]) =>
        pm.request({
          type: 'controller',
          method: key,
          params
        });
    }
  });
}

const KOINU = 1e8;

export function createPopupAdapter(): WalletCoreAdapter & {
  publishDxRegister?: (p: { handle: string; tweetId: string }) => Promise<{ txid: string }>;
} {
  const wallet = createWalletProxy();

  const liveAddress = async (): Promise<string | null> => {
    try {
      const unlocked = await wallet.isUnlocked();
      if (!unlocked) return null;
      const account = await wallet.getCurrentAccount();
      return account?.address || null;
    } catch {
      return null;
    }
  };

  return {
    getBalance: async () => {
      const address = await liveAddress();
      if (address) {
        try {
          const bal = await wallet.getAddressBalance(address);
          const amount = Number(bal?.amount ?? 0);
          return {
            amount,
            btc_amount: '0',
            inscription_amount: 0,
            inscription_btc_amount: '0',
            pending_amount: 0,
            pending_btc_amount: '0',
            transferable_inscription_amount: 0,
            transferable_inscription_btc_amount: '0',
            satoshidoge: { amount: '0' },
            satoshidoge_pending: { amount: '0' }
          } as any;
        } catch {
          /* fall through */
        }
      }
      const cached = await storage.get(BALANCE_KEY);
      return {
        amount: Number(cached ?? 0),
        btc_amount: '0',
        inscription_amount: 0,
        inscription_btc_amount: '0',
        pending_amount: 0,
        pending_btc_amount: '0',
        transferable_inscription_amount: 0,
        transferable_inscription_btc_amount: '0',
        satoshidoge: { amount: '0' },
        satoshidoge_pending: { amount: '0' }
      } as any;
    },
    getAddress: async () => (await liveAddress()) || ((await storage.get(ADDRESS_KEY)) as string) || fallbackAddress,
    getUsdRate: async () => 0.12,
    getTransactions: async () => {
      const cached = (await storage.get(TXS_KEY)) as WalletTransaction[] | undefined;
      return cached ?? [];
    },
    getConnectedAccounts: async () => {
      const addr = await liveAddress();
      return [addr || ((await storage.get(ADDRESS_KEY)) as string) || fallbackAddress];
    },
    validateAddress: (address: string) => /^D[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address.trim()),
    copyText: async (value: string) => {
      await navigator.clipboard.writeText(value);
    },
    sendDogecoin: async (request: SendDogecoinRequest & { memo?: string }): Promise<SendDogecoinResult> => {
      const unlocked = await wallet.isUnlocked().catch(() => false);
      if (!unlocked) {
        throw new Error('Unlock Dojak to send. Open the extension and unlock the vault.');
      }
      const koinu = Math.round(request.amount * KOINU);
      if (!Number.isFinite(koinu) || koinu <= 0) throw new Error('Invalid amount');
      const res = await wallet.sendAndBroadcastDOGE({
        to: request.to,
        amount: koinu,
        feeRate: request.feeRate && request.feeRate > 0 ? request.feeRate : 2,
        enableRBF: false,
        memo: request.memo
      });
      return { txid: res.txid, rawtx: res.rawtx };
    },
    publishDxRegister: async ({ handle, tweetId }) => {
      const unlocked = await wallet.isUnlocked().catch(() => false);
      if (!unlocked) throw new Error('Unlock Dojak to publish the Ð𝕏 bind.');
      return wallet.publishDxRegister({ handle, tweetId, feeRate: 2 });
    },
    listDoginals: () => wallet.listPopupDoginals(),
    listTokens: () => wallet.listPopupTokens(),
    protectDoginal: async (inscriptionId: string) => {
      const unlocked = await wallet.isUnlocked().catch(() => false);
      if (!unlocked) throw new Error('Unlock Dojak to protect a Doginal.');
      return wallet.protectInscription({ inscriptionId, feeRate: 2 });
    },
    sendDoginal: async (inscriptionId: string, to: string) => {
      const unlocked = await wallet.isUnlocked().catch(() => false);
      if (!unlocked) throw new Error('Unlock Dojak to send a Doginal.');
      return wallet.sendPopupInscription({ inscriptionId, to, feeRate: 2 });
    },
    listDoginalForSale: async (inscriptionId: string, priceDoge: number) => {
      const unlocked = await wallet.isUnlocked().catch(() => false);
      if (!unlocked) throw new Error('Unlock Dojak to list a Doginal.');
      return wallet.listPopupInscriptionForSale({ inscriptionId, priceDoge });
    },
    getConnectedSites: () => wallet.getConnectedSites(),
    removeConnectedSite: (origin: string) => wallet.removeConnectedSite(origin),
    resolveName: (input: string) => wallet.resolvePopupName(input),
    listDns: () => wallet.listPopupDns(),
    getAutoLock: async () => Number(await wallet.getAutoLockTimeId()),
    setAutoLock: (timeId: number) => wallet.setAutoLockTimeId(timeId),
    logout: async () => {
      await Promise.all([storage.set(BALANCE_KEY, 0), storage.set(TXS_KEY, [])]);
    },
    getVersion: async () => '0.1.2-dx'
  };
}
