import React from 'react';
import ReactDOM from 'react-dom/client';

import { storage } from '@dojak/core';
import { DojakWallet, WalletCoreProvider } from '@dojak/ui';
import '@dojak/ui/src/global.css';

const adapter = {
  getBalance: async () => {
    const cached = await storage.get('popup-balance');
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
  sendDogecoin: async ({ amount }: { amount: number }) => {
    const current = Number((await storage.get('popup-balance')) ?? 0);
    const next = Math.max(0, current - amount);
    await storage.set('popup-balance', next);
    return { txid: `popup-${Date.now()}` };
  }
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
