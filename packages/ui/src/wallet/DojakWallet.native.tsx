import { useEffect, useState } from 'react';
import { RefreshControl } from 'react-native';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isValidAddress } from '../utils/bitcoin-utils';
import { shortAddress } from '../utils';
import { useWalletCore, WalletTransaction } from './WalletCoreContext';
import { WALLET_TABS, WalletTab } from './walletTypes';

const FALLBACK_TRANSACTIONS: WalletTransaction[] = [
  { txid: 'sample-received-001', amount: 1250, direction: 'received', timestamp: Date.now() - 86_400_000, status: 'confirmed' }
];

const formatDoge = (value: number | string) => {
  const parsed = typeof value === 'number' ? value : Number(value || 0);
  return Number.isFinite(parsed) ? parsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : '0.00';
};

export function DojakWallet() {
  const walletCore = useWalletCore();
  const [activeTab, setActiveTab] = useState<WalletTab>('home');
  const [balance, setBalance] = useState(0);
  const [address, setAddress] = useState('D8n4gQ8S4aQszM4xTq3w9fF6xR9H1skGgT');
  const [txs, setTxs] = useState<WalletTransaction[]>(FALLBACK_TRANSACTIONS);
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [status, setStatus] = useState('Ready');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const pushToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  };

  const refreshWallet = async () => {
    try {
      setError(null);
      const [b, a, t] = await Promise.all([
        walletCore.getBalance?.(),
        walletCore.getAddress?.(),
        walletCore.getTransactions?.()
      ]);
      setBalance(Number(b?.amount ?? 0));
      if (a) setAddress(a);
      if (t?.length) setTxs(t);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to refresh wallet';
      setError(message);
      pushToast(`RPC error: ${message}`);
    }
  };

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      await refreshWallet();
      setIsLoading(false);
    })();
  }, [walletCore]);

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-zinc-950">
      <ScrollView
        className="px-4 py-4"
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => void refreshWallet()} tintColor="#fbbf24" />}
      >
        <View className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
          <Text className="text-xs text-zinc-400">Dojak Wallet • Dogecoin L1</Text>
          <Text className="text-zinc-100">{shortAddress(address, 6)}</Text>
        </View>

        <View className="mt-3 flex-row flex-wrap gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-2">
          {WALLET_TABS.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className={`rounded-lg px-2 py-1 ${activeTab === tab.key ? 'bg-amber-400' : 'bg-zinc-800'}`}
            >
              <Text className={`text-xs ${activeTab === tab.key ? 'text-black' : 'text-zinc-300'}`}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>

        {activeTab === 'home' && (
          <View className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
            <Text className="text-zinc-300">
              <Text className="text-amber-300">Ð</Text> {formatDoge(balance)}
            </Text>
            {txs.slice(0, 3).map((tx) => (
              <Text key={tx.txid} className="text-xs text-zinc-400">
                {shortAddress(tx.txid, 6)} • {formatDoge(tx.amount)} DOGE
              </Text>
            ))}
          </View>
        )}

        {activeTab === 'receive' && (
          <View className="mt-3 gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
            <Text className="text-zinc-300">Receive DOGE</Text>
            <QRCode value={address} size={140} />
            <Text selectable className="text-xs text-zinc-400">
              {address}
            </Text>
          </View>
        )}

        {activeTab === 'send' && (
          <View className="mt-3 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
            <TextInput
              value={sendTo}
              onChangeText={setSendTo}
              placeholder="D..."
              placeholderTextColor="#71717A"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            />
            <TextInput
              value={sendAmount}
              onChangeText={setSendAmount}
              placeholder="DOGE amount"
              placeholderTextColor="#71717A"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            />
            <Pressable
              className="rounded-lg bg-amber-400 px-3 py-2"
              onPress={async () => {
                if (!isValidAddress(sendTo)) return;
                const tx = await walletCore.sendDogecoin?.({ to: sendTo, amount: Number(sendAmount) });
                if (tx) {
                  setStatus(`Sent ${shortAddress(tx.txid, 7)}`);
                  await refreshWallet();
                }
              }}
            >
              <Text className="text-center font-semibold text-black">Send DOGE</Text>
            </Pressable>
          </View>
        )}

        {error && (
          <View className="mt-3 rounded-lg border border-red-600/40 bg-red-500/10 p-2">
            <Text className="text-xs text-red-300">{error}</Text>
            <Pressable onPress={() => void refreshWallet()}>
              <Text className="text-xs text-red-200 underline">Retry</Text>
            </Pressable>
          </View>
        )}
        {isLoading && <Text className="mt-2 text-center text-xs text-zinc-500">Loading wallet data...</Text>}
        <Text className="mt-3 text-center text-xs text-zinc-500">{status}</Text>
      </ScrollView>
      {toast && (
        <View className="absolute bottom-4 left-4 right-4 rounded-lg border border-red-500/40 bg-zinc-900 px-3 py-2">
          <Text className="text-center text-xs text-red-200">{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

export default DojakWallet;
