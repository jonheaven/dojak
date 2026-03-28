import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { dogecoinKeyrings } from '@dojak/core';
import { DojakWallet, WalletCoreProvider, WalletTransaction } from '@dojak/ui';

import './global.css';

const BALANCE_KEY = 'dojak.balance';
const ADDRESS_KEY = 'dojak.address';
const TXS_KEY = 'dojak.txs';
const fallbackAddress = 'D8n4gQ8S4aQszM4xTq3w9fF6xR9H1skGgT';

export default function App() {
  const adapter = useMemo(() => {
    const memoryStore = new dogecoinKeyrings.MemoryStorageAdapter();
    void memoryStore;

    return {
      getBalance: async () => {
        const stored = await SecureStore.getItemAsync(BALANCE_KEY);
        return {
          amount: Number(stored ?? '0'),
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
      getAddress: async () => (await SecureStore.getItemAsync(ADDRESS_KEY)) ?? fallbackAddress,
      getUsdRate: async () => 0.12,
      getTransactions: async () => {
        const raw = await SecureStore.getItemAsync(TXS_KEY);
        return raw ? (JSON.parse(raw) as WalletTransaction[]) : [];
      },
      getConnectedAccounts: async () => [((await SecureStore.getItemAsync(ADDRESS_KEY)) as string) ?? fallbackAddress],
      validateAddress: (address: string) => /^D[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address.trim()),
      copyText: async (value: string) => {
        await Clipboard.setStringAsync(value);
      },
      sendDogecoin: async ({ amount, to }: { amount: number; to: string }) => {
        const current = Number((await SecureStore.getItemAsync(BALANCE_KEY)) ?? '0');
        const next = Math.max(0, current - amount);
        await SecureStore.setItemAsync(BALANCE_KEY, String(next));

        const tx = {
          txid: `mobile-${Date.now()}`,
          amount,
          direction: 'sent' as const,
          timestamp: Date.now(),
          to,
          status: 'confirmed' as const
        };
        const raw = await SecureStore.getItemAsync(TXS_KEY);
        const txs = raw ? (JSON.parse(raw) as WalletTransaction[]) : [];
        await SecureStore.setItemAsync(TXS_KEY, JSON.stringify([tx, ...txs].slice(0, 20)));

        return {
          txid: tx.txid
        };
      },
      logout: async () => {
        await Promise.all([
          SecureStore.setItemAsync(BALANCE_KEY, '0'),
          SecureStore.setItemAsync(TXS_KEY, JSON.stringify([]))
        ]);
      },
      getVersion: async () => '0.1.0-mvp'
    };
  }, []);

  return (
    <SafeAreaProvider>
      <WalletCoreProvider adapter={adapter}>
        <DojakWallet />
        <StatusBar style="light" />
      </WalletCoreProvider>
    </SafeAreaProvider>
  );
}
