import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { dogecoinKeyrings } from '@dojak/core';

import { useWalletCore } from './WalletCoreContext';

export function DojakWallet() {
  const walletCore = useWalletCore();
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState('0.00000000');
  const [status, setStatus] = useState('Ready');

  const keyringLabel = useMemo(
    () => (dogecoinKeyrings?.DogecoinKeyringService ? 'Dogecoin keyring connected' : 'Keyring unavailable'),
    []
  );

  const refreshBalance = async () => {
    if (!walletCore.getBalance) {
      setStatus('No balance adapter connected');
      return;
    }
    const nextBalance = await walletCore.getBalance();
    setBalance(nextBalance?.amount?.toString?.() ?? '0.00000000');
    setStatus('Balance updated');
  };

  const onSend = async () => {
    if (!walletCore.sendDogecoin) {
      setStatus('No send adapter connected');
      return;
    }
    const response = await walletCore.sendDogecoin({ to, amount: Number(amount || '0') });
    setStatus(`Transaction queued: ${response.txid}`);
    setTo('');
    setAmount('');
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-zinc-950">
      <View className="mx-auto flex h-full w-full max-w-[402px] flex-col gap-4 px-4 py-4">
        <View className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
          <Text className="text-xs uppercase tracking-wide text-zinc-400">Dojak Wallet</Text>
          <Text className="text-xl font-semibold text-zinc-100">Dogecoin</Text>
          <Text className="mt-1 text-sm text-zinc-400">{keyringLabel}</Text>
        </View>

        <View className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
          <Text className="text-xs uppercase tracking-wide text-zinc-400">Balance</Text>
          <Text className="mt-2 text-3xl font-semibold text-zinc-100">{balance} DOGE</Text>
          <Pressable onPress={refreshBalance} className="mt-4 rounded-xl bg-lime-400 px-4 py-2">
            <Text className="text-center text-sm font-semibold text-zinc-900">Refresh</Text>
          </Pressable>
        </View>

        <View className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
          <Text className="text-xs uppercase tracking-wide text-zinc-400">Send</Text>
          <TextInput
            value={to}
            onChangeText={setTo}
            placeholder="D..."
            placeholderTextColor="#71717A"
            className="mt-3 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor="#71717A"
            keyboardType="decimal-pad"
            className="mt-3 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
          <Pressable onPress={onSend} className="mt-4 rounded-xl bg-sky-500 px-4 py-2">
            <Text className="text-center text-sm font-semibold text-white">Send DOGE</Text>
          </Pressable>
        </View>

        <View className="mt-auto flex-row gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-2">
          {['Home', 'Send', 'Receive', 'Settings'].map((tab) => (
            <Pressable key={tab} className="flex-1 rounded-lg px-2 py-2">
              <Text className="text-center text-xs text-zinc-300">{tab}</Text>
            </Pressable>
          ))}
        </View>

        <Text className="text-center text-xs text-zinc-500">{status}</Text>
      </View>
    </SafeAreaView>
  );
}

export default DojakWallet;
