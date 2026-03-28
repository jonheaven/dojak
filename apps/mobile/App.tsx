import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { dogecoinKeyrings } from '@dojak/core';
import { DojakWallet, WalletCoreProvider } from '@dojak/ui';

import './global.css';

const BALANCE_KEY = 'dojak.balance';

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
      sendDogecoin: async ({ amount }: { amount: number }) => {
        const current = Number((await SecureStore.getItemAsync(BALANCE_KEY)) ?? '0');
        const next = Math.max(0, current - amount);
        await SecureStore.setItemAsync(BALANCE_KEY, String(next));
        return {
          txid: `mobile-${Date.now()}`
        };
      }
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
