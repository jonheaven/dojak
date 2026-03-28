import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DOGEOS_ACTIVE_CONFIG } from '@dojak/core';

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
  const [dogeOsAddress, setDogeOsAddress] = useState<`0x${string}`>('0x0000000000000000000000000000000000000000');
  const [dogeOsBalance, setDogeOsBalance] = useState('0');
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [status, setStatus] = useState('Ready');

  useEffect(() => {
    void (async () => {
      const [b, a, t, da, db] = await Promise.all([
        walletCore.getBalance?.(),
        walletCore.getAddress?.(),
        walletCore.getTransactions?.(),
        walletCore.getDogeOsAddress?.(),
        walletCore.getDogeOsBalance?.()
      ]);
      setBalance(Number(b?.amount ?? 0));
      if (a) setAddress(a);
      if (t?.length) setTxs(t);
      if (da) setDogeOsAddress(da);
      if (db) setDogeOsBalance(db);
    })();
  }, [walletCore]);

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-zinc-950">
      <ScrollView className="px-4 py-4">
        <View className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
          <Text className="text-xs text-zinc-400">Dojak Wallet • Dogecoin-first</Text>
          <Text className="text-zinc-100">L1: {shortAddress(address, 6)}</Text>
          <Text className="text-amber-300">DogeOS: {shortAddress(dogeOsAddress, 6)}</Text>
        </View>

        <View className="mt-3 flex-row flex-wrap gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-2">
          {WALLET_TABS.map((tab) => (
            <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} className={`rounded-lg px-2 py-1 ${activeTab === tab.key ? 'bg-amber-400' : 'bg-zinc-800'}`}>
              <Text className={`text-xs ${activeTab === tab.key ? 'text-black' : 'text-zinc-300'}`}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>

        {activeTab === 'home' && (
          <View className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
            <Text className="text-zinc-300">DOGE (L1): {formatDoge(balance)}</Text>
            <Text className="text-amber-300">DOGE (DogeOS): {formatDoge(dogeOsBalance)}</Text>
            {txs.slice(0, 3).map((tx) => (
              <Text key={tx.txid} className="text-xs text-zinc-400">{shortAddress(tx.txid, 6)} • {formatDoge(tx.amount)} DOGE</Text>
            ))}
          </View>
        )}

        {activeTab === 'receive' && (
          <View className="mt-3 gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
            <Text className="text-zinc-300">L1 receive</Text>
            <QRCode value={address} size={140} />
            <Text selectable className="text-xs text-zinc-400">{address}</Text>
            <Text className="text-amber-300">DogeOS receive</Text>
            <QRCode value={dogeOsAddress} size={140} />
            <Text selectable className="text-xs text-zinc-400">{dogeOsAddress}</Text>
          </View>
        )}

        {activeTab === 'send' && (
          <View className="mt-3 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
            <TextInput value={sendTo} onChangeText={setSendTo} placeholder="D..." placeholderTextColor="#71717A" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100" />
            <TextInput value={sendAmount} onChangeText={setSendAmount} placeholder="DOGE amount" placeholderTextColor="#71717A" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100" />
            <Pressable
              className="rounded-lg bg-amber-400 px-3 py-2"
              onPress={async () => {
                if (!isValidAddress(sendTo)) return;
                const tx = await walletCore.sendDogecoin?.({ to: sendTo, amount: Number(sendAmount) });
                if (tx) setStatus(`Sent ${shortAddress(tx.txid, 7)}`);
              }}>
              <Text className="text-center font-semibold text-black">Send DOGE (L1)</Text>
            </Pressable>
          </View>
        )}

        {activeTab === 'dogeos' && (
          <View className="mt-3 gap-2 rounded-xl border border-amber-600/60 bg-zinc-900/80 p-3">
            <Text className="text-amber-300">DogeOS Apps (Testnet)</Text>
            <Text className="text-xs text-zinc-400">{DOGEOS_ACTIVE_CONFIG.name} • Chain ID {DOGEOS_ACTIVE_CONFIG.chainId}</Text>
            <Text className="text-xs text-zinc-500">Powered by DogeOS</Text>
            <TextInput
              placeholder="0x recipient"
              placeholderTextColor="#71717A"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              onChangeText={setSendTo}
              value={sendTo}
            />
            <TextInput
              placeholder="DOGE amount"
              placeholderTextColor="#71717A"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              onChangeText={setSendAmount}
              value={sendAmount}
            />
            <Pressable
              className="rounded-lg bg-amber-400 px-3 py-2"
              onPress={async () => {
                if (!walletCore.validateDogeOsAddress?.(sendTo)) return;
                const tx = await walletCore.sendDogeOs?.({ to: sendTo as `0x${string}`, amount: sendAmount });
                if (tx) setStatus(`DogeOS tx ${shortAddress(tx.txid, 7)}`);
              }}>
              <Text className="text-center font-semibold text-black">Send DOGE (DogeOS)</Text>
            </Pressable>
            <Pressable
              className="rounded-lg border border-amber-500 px-3 py-2"
              onPress={async () => {
                const tx = await walletCore.bridgeDogeOs?.({ amount: sendAmount || '0', direction: 'l1-to-dogeos' });
                if (tx) setStatus(`Bridge ${shortAddress(tx.txid, 7)}`);
              }}>
              <Text className="text-center text-amber-300">Bridge L1 → DogeOS</Text>
            </Pressable>
            <Text className="text-xs text-zinc-500">In-app browser: open DogeOS dApps from Discover tab with WalletConnect v2 fallback.</Text>
          </View>
        )}

        <Text className="mt-3 text-center text-xs text-zinc-500">{status}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

export default DojakWallet;
