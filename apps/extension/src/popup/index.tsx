import React from 'react';
import ReactDOM from 'react-dom/client';

import { storage } from '@dojak/core';
import { DojakWallet, WalletCoreProvider, WalletTransaction } from '@dojak/ui';
import '@dojak/ui/src/styles/global.less';

const BALANCE_KEY = 'popup-balance';
const ADDRESS_KEY = 'popup-address';
const TXS_KEY = 'popup-transactions';

const fallbackAddress = 'D8n4gQ8S4aQszM4xTq3w9fF6xR9H1skGgT';

const adapter = {
  getBalance: async () => {
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
  getAddress: async () => (await storage.get(ADDRESS_KEY)) ?? fallbackAddress,
  getUsdRate: async () => 0.12,
  getTransactions: async () => {
    const cached = (await storage.get(TXS_KEY)) as WalletTransaction[] | undefined;
    return cached ?? [];
  },
  getConnectedAccounts: async () => [((await storage.get(ADDRESS_KEY)) as string) ?? fallbackAddress],
  validateAddress: (address: string) => /^D[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address.trim()),
  copyText: async (value: string) => {
    await navigator.clipboard.writeText(value);
  },
  sendDogecoin: async ({ amount, to }: { amount: number; to: string }) => {
    const current = Number((await storage.get(BALANCE_KEY)) ?? 0);
    const next = Math.max(0, current - amount);
    await storage.set(BALANCE_KEY, next);

    const tx = {
      txid: `popup-${Date.now()}`,
      amount,
      direction: 'sent' as const,
      timestamp: Date.now(),
      to,
      status: 'confirmed' as const
    };
    const txs = ((await storage.get(TXS_KEY)) as WalletTransaction[] | undefined) ?? [];
    await storage.set(TXS_KEY, [tx, ...txs].slice(0, 20));

    return { txid: tx.txid };
  },
  logout: async () => {
    await Promise.all([storage.set(BALANCE_KEY, 0), storage.set(TXS_KEY, [])]);
  },
  getVersion: async () => '0.1.0-mvp'
};

const root = document.getElementById('root');

if (root) {
  ReactDOM.createRoot(root).render(
    <div className="mx-auto w-full max-w-[402px] overflow-y-auto" style={{ maxHeight: 600 }}>
      <WalletCoreProvider adapter={adapter}>
        <DojakWallet />
      </WalletCoreProvider>
    </div>
  );
}
