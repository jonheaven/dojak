import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { deriveDogeOsAddressFromMnemonic, dogecoinKeyrings, DOGEOS_ACTIVE_CONFIG } from '@dojak/core';
import { DojakWallet, WalletCoreProvider, WalletTransaction } from '@dojak/ui';

import './global.css';

const BALANCE_KEY = 'dojak.balance';
const ADDRESS_KEY = 'dojak.address';
const TXS_KEY = 'dojak.txs';
const DOGEOS_BALANCE_KEY = 'dojak.dogeos.balance';
const DOGEOS_TXS_KEY = 'dojak.dogeos.txs';
const MNEMONIC_KEY = 'dojak.mnemonic';

const fallbackAddress = 'D8n4gQ8S4aQszM4xTq3w9fF6xR9H1skGgT';
const fallbackMnemonic = 'test test test test test test test test test test test junk';

const isHexAddress = (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address.trim());

export default function App() {
  const adapter = useMemo(() => {
    const memoryStore = new dogecoinKeyrings.MemoryStorageAdapter();
    void memoryStore;

    const getMnemonic = async () => {
      const stored = await SecureStore.getItemAsync(MNEMONIC_KEY);
      if (stored) return stored;
      await SecureStore.setItemAsync(MNEMONIC_KEY, fallbackMnemonic);
      return fallbackMnemonic;
    };

    const getDogeOsAddress = async () => {
      const mnemonic = await getMnemonic();
      return deriveDogeOsAddressFromMnemonic(mnemonic) as `0x${string}`;
    };

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
      getDogeOsAddress,
      getDogeOsBalance: async () => (await SecureStore.getItemAsync(DOGEOS_BALANCE_KEY)) ?? '0',
      getUsdRate: async () => 0.12,
      getTransactions: async () => {
        const raw = await SecureStore.getItemAsync(TXS_KEY);
        return raw ? (JSON.parse(raw) as WalletTransaction[]) : [];
      },
      getDogeOsTransactions: async () => {
        const raw = await SecureStore.getItemAsync(DOGEOS_TXS_KEY);
        return raw ? (JSON.parse(raw) as WalletTransaction[]) : [];
      },
      getConnectedAccounts: async () => [((await SecureStore.getItemAsync(ADDRESS_KEY)) as string) ?? fallbackAddress],
      validateAddress: (address: string) => /^D[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address.trim()),
      validateDogeOsAddress: isHexAddress,
      copyText: async (value: string) => {
        await Clipboard.setStringAsync(value);
      },
      sendDogecoin: async ({ amount, to }: { amount: number; to: string }) => {
        const current = Number((await SecureStore.getItemAsync(BALANCE_KEY)) ?? '0');
        const next = Math.max(0, current - amount);
        await SecureStore.setItemAsync(BALANCE_KEY, String(next));

        const tx = {
          txid: `mobile-l1-${Date.now()}`,
          amount,
          direction: 'sent' as const,
          timestamp: Date.now(),
          to,
          status: 'confirmed' as const
        };
        const raw = await SecureStore.getItemAsync(TXS_KEY);
        const txs = raw ? (JSON.parse(raw) as WalletTransaction[]) : [];
        await SecureStore.setItemAsync(TXS_KEY, JSON.stringify([tx, ...txs].slice(0, 20)));

        return { txid: tx.txid };
      },
      sendDogeOs: async ({ amount, to }: { amount: string; to: `0x${string}` }) => {
        const current = Number((await SecureStore.getItemAsync(DOGEOS_BALANCE_KEY)) ?? '0');
        const spend = Number(amount || '0');
        await SecureStore.setItemAsync(DOGEOS_BALANCE_KEY, String(Math.max(0, current - spend)));

        const tx = {
          txid: `0xmobile-dogeos-${Date.now().toString(16)}`,
          amount: spend,
          direction: 'sent' as const,
          timestamp: Date.now(),
          to,
          status: 'confirmed' as const
        };

        const raw = await SecureStore.getItemAsync(DOGEOS_TXS_KEY);
        const txs = raw ? (JSON.parse(raw) as WalletTransaction[]) : [];
        await SecureStore.setItemAsync(DOGEOS_TXS_KEY, JSON.stringify([tx, ...txs].slice(0, 20)));
        return { txid: tx.txid };
      },
      bridgeDogeOs: async ({ amount, direction }: { amount: string; direction: 'l1-to-dogeos' | 'dogeos-to-l1' }) => {
        const txid = `0xbridge-${direction}-${Date.now().toString(16)}`;
        // Placeholder bridge call. Replace with official DogeOS bridge contract address when published.
        void DOGEOS_ACTIVE_CONFIG.bridgeContractAddress;
        void amount;
        return { txid };
      },
      logout: async () => {
        await Promise.all([
          SecureStore.setItemAsync(BALANCE_KEY, '0'),
          SecureStore.setItemAsync(DOGEOS_BALANCE_KEY, '0'),
          SecureStore.setItemAsync(TXS_KEY, JSON.stringify([])),
          SecureStore.setItemAsync(DOGEOS_TXS_KEY, JSON.stringify([]))
        ]);
      },
      getSeedPhraseForDogeOsTesting: async () => getMnemonic(),
      getVersion: async () => '0.2.0-dogeos-testnet'
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
