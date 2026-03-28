import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isValidAddress } from '../utils/bitcoin-utils';
import { shortAddress } from '../utils';
import { useWalletCore, WalletTransaction } from './WalletCoreContext';
import { FEE_OPTIONS, FeePreset, WALLET_TABS, WalletTab } from './walletTypes';

const FALLBACK_TRANSACTIONS: WalletTransaction[] = [
  { txid: 'sample-received-001', amount: 1250, direction: 'received', timestamp: Date.now() - 86_400_000, status: 'confirmed' },
  { txid: 'sample-sent-002', amount: 75, direction: 'sent', timestamp: Date.now() - 172_800_000, status: 'confirmed' }
];

const formatDoge = (value: number | string) => {
  const parsed = typeof value === 'number' ? value : Number(value || 0);
  return Number.isFinite(parsed) ? parsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : '0.00';
};

const formatUsd = (value: number) => value.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export function DojakWallet() {
  const walletCore = useWalletCore();
  const [activeTab, setActiveTab] = useState<WalletTab>('home');
  const [balance, setBalance] = useState(0);
  const [address, setAddress] = useState('D8n4gQ8S4aQszM4xTq3w9fF6xR9H1skGgT');
  const [transactions, setTransactions] = useState<WalletTransaction[]>(FALLBACK_TRANSACTIONS);
  const [usdRate, setUsdRate] = useState(0.12);

  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [amountMode, setAmountMode] = useState<'doge' | 'usd'>('doge');
  const [feePreset, setFeePreset] = useState<FeePreset>('medium');
  const [customFee, setCustomFee] = useState('');

  const [connectedAccounts, setConnectedAccounts] = useState<string[]>([]);
  const [version, setVersion] = useState('0.1.0-mvp');
  const [status, setStatus] = useState('Ready');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const feeRate = feePreset === 'custom' ? Number(customFee || 0) : FEE_OPTIONS.find((item) => item.key === feePreset)?.feeRate ?? 2;
  const parsedAmount = Number(sendAmount || 0);
  const dogeAmount = amountMode === 'doge' ? parsedAmount : parsedAmount / usdRate;
  const usdAmount = dogeAmount * usdRate;

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [nextBalance, nextAddress, nextTxs, nextRate, nextAccounts, nextVersion] = await Promise.all([
          walletCore.getBalance?.(),
          walletCore.getAddress?.(),
          walletCore.getTransactions?.(),
          walletCore.getUsdRate?.(),
          walletCore.getConnectedAccounts?.(),
          walletCore.getVersion?.()
        ]);
        setBalance(Number(nextBalance?.amount ?? 0));
        if (nextAddress) setAddress(nextAddress);
        if (nextTxs?.length) setTransactions(nextTxs);
        if (nextRate && Number.isFinite(nextRate) && nextRate > 0) setUsdRate(nextRate);
        if (nextAccounts?.length) setConnectedAccounts(nextAccounts);
        if (nextVersion) setVersion(nextVersion);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load wallet data');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [walletCore]);

  const refreshWallet = async () => {
    setStatus('Refreshing...');
    try {
      const [nextBalance, nextTxs] = await Promise.all([walletCore.getBalance?.(), walletCore.getTransactions?.()]);
      if (nextBalance?.amount !== undefined) setBalance(Number(nextBalance.amount));
      if (nextTxs?.length) setTransactions(nextTxs);
      setStatus('Wallet updated');
    } catch (refreshError) {
      setStatus('Refresh failed');
      setError(refreshError instanceof Error ? refreshError.message : 'Could not refresh wallet');
    }
  };

  const onSend = async () => {
    setError(null);

    if (!walletCore.sendDogecoin) {
      setError('Core send adapter unavailable');
      return;
    }

    if (!sendTo.trim()) {
      setError('Recipient address is required');
      return;
    }

    const isAddressValid = walletCore.validateAddress
      ? await walletCore.validateAddress(sendTo.trim())
      : isValidAddress(sendTo.trim());

    if (!isAddressValid) {
      setError('Recipient address is invalid');
      return;
    }

    if (!Number.isFinite(dogeAmount) || dogeAmount <= 0) {
      setError('Enter a valid amount');
      return;
    }

    if (dogeAmount > balance) {
      setError('Insufficient balance');
      return;
    }

    if (!Number.isFinite(feeRate) || feeRate <= 0) {
      setError('Select a valid network fee');
      return;
    }

    try {
      setIsSending(true);
      setStatus('Submitting transaction...');
      const response = await walletCore.sendDogecoin({
        to: sendTo.trim(),
        amount: Number(dogeAmount.toFixed(8)),
        feeRate
      });
      setStatus(`Transaction sent: ${shortAddress(response.txid, 8)}`);
      setBalance((prev) => Math.max(0, prev - dogeAmount));
      setSendTo('');
      setSendAmount('');
      setActiveTab('home');
      await refreshWallet();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Failed to send transaction');
      setStatus('Send failed');
    } finally {
      setIsSending(false);
    }
  };

  const copyAddress = async () => {
    try {
      if (walletCore.copyText) {
        await walletCore.copyText(address);
        setStatus('Address copied');
      } else {
        setError('Copy unavailable for this adapter');
      }
    } catch {
      setError('Copy failed');
    }
  };

  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)).slice(0, 5),
    [transactions]
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-zinc-950">
      <View className="mx-auto h-full w-full max-w-[402px]">
        <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 16 }}>
          <View className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
            <Text className="text-xs uppercase tracking-[2px] text-zinc-400">Dojak Wallet</Text>
            <Text className="mt-1 text-xl font-semibold text-zinc-100">Dogecoin</Text>
            <Text className="mt-1 text-xs text-zinc-400">{shortAddress(address, 7)}</Text>
          </View>

          <View className="mt-4 flex-row gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-2">
            {WALLET_TABS.map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                className={`flex-1 rounded-xl px-2 py-2 ${activeTab === tab.key ? 'bg-sky-500' : 'bg-transparent'}`}>
                <Text className={`text-center text-xs font-semibold ${activeTab === tab.key ? 'text-white' : 'text-zinc-300'}`}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
            {activeTab === 'home' && (
              <View className="gap-4">
                <View>
                  <Text className="text-xs uppercase tracking-wide text-zinc-400">Total Balance</Text>
                  <Text className="mt-2 text-4xl font-bold text-zinc-100">{formatDoge(balance)} DOGE</Text>
                  <Text className="mt-1 text-sm text-zinc-400">{formatUsd(balance * usdRate)}</Text>
                </View>
                <View className="flex-row gap-3">
                  <Pressable onPress={() => setActiveTab('send')} className="flex-1 rounded-xl bg-sky-500 px-4 py-3">
                    <Text className="text-center text-sm font-semibold text-white">Quick Send</Text>
                  </Pressable>
                  <Pressable onPress={() => setActiveTab('receive')} className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3">
                    <Text className="text-center text-sm font-semibold text-zinc-100">Receive</Text>
                  </Pressable>
                </View>
                <View>
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="text-sm font-semibold text-zinc-100">Recent Activity</Text>
                    <Pressable onPress={refreshWallet}>
                      <Text className="text-xs text-sky-400">Refresh</Text>
                    </Pressable>
                  </View>
                  <View className="gap-2">
                    {sortedTransactions.map((tx) => (
                      <View key={tx.txid} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-xs text-zinc-400">{tx.direction === 'received' ? 'Received' : 'Sent'}</Text>
                          <Text className="text-xs text-zinc-400">{tx.status ?? 'confirmed'}</Text>
                        </View>
                        <Text className="mt-1 text-sm font-semibold text-zinc-100">
                          {tx.direction === 'sent' ? '-' : '+'}
                          {formatDoge(tx.amount)} DOGE
                        </Text>
                        <Text className="text-xs text-zinc-500">{shortAddress(tx.txid, 8)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {activeTab === 'receive' && (
              <View className="gap-4">
                <Text className="text-center text-xs uppercase tracking-wide text-zinc-400">Wallet Address</Text>
                <Text selectable className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-center text-xs text-zinc-200">
                  {address}
                </Text>
                <View className="mx-auto rounded-2xl bg-white p-3">
                  <QRCode value={address} size={220} />
                </View>
                <Pressable onPress={copyAddress} className="rounded-xl bg-sky-500 px-4 py-3">
                  <Text className="text-center text-sm font-semibold text-white">Copy Address</Text>
                </Pressable>
              </View>
            )}

            {activeTab === 'send' && (
              <View className="gap-4">
                <View>
                  <Text className="text-sm text-zinc-300">Recipient</Text>
                  <TextInput
                    value={sendTo}
                    onChangeText={setSendTo}
                    placeholder="D..."
                    placeholderTextColor="#71717A"
                    className="mt-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100"
                  />
                </View>
                <View>
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="text-sm text-zinc-300">Amount</Text>
                    <View className="flex-row rounded-lg border border-zinc-700 bg-zinc-950 p-1">
                      <Pressable
                        onPress={() => setAmountMode('doge')}
                        className={`rounded-md px-2 py-1 ${amountMode === 'doge' ? 'bg-sky-500' : 'bg-transparent'}`}>
                        <Text className={`text-xs ${amountMode === 'doge' ? 'text-white' : 'text-zinc-400'}`}>DOGE</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setAmountMode('usd')}
                        className={`rounded-md px-2 py-1 ${amountMode === 'usd' ? 'bg-sky-500' : 'bg-transparent'}`}>
                        <Text className={`text-xs ${amountMode === 'usd' ? 'text-white' : 'text-zinc-400'}`}>USD</Text>
                      </Pressable>
                    </View>
                  </View>
                  <TextInput
                    value={sendAmount}
                    onChangeText={setSendAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#71717A"
                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100"
                  />
                  <Text className="mt-1 text-xs text-zinc-500">≈ {formatDoge(dogeAmount)} DOGE / {formatUsd(usdAmount)}</Text>
                </View>
                <View>
                  <Text className="mb-2 text-sm text-zinc-300">Network Fee</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {FEE_OPTIONS.map((option) => (
                      <Pressable
                        key={option.key}
                        onPress={() => setFeePreset(option.key)}
                        className={`rounded-lg px-3 py-2 ${feePreset === option.key ? 'bg-sky-500' : 'bg-zinc-950'}`}>
                        <Text className={`text-xs ${feePreset === option.key ? 'text-white' : 'text-zinc-400'}`}>{option.label}</Text>
                      </Pressable>
                    ))}
                    <Pressable
                      onPress={() => setFeePreset('custom')}
                      className={`rounded-lg px-3 py-2 ${feePreset === 'custom' ? 'bg-sky-500' : 'bg-zinc-950'}`}>
                      <Text className={`text-xs ${feePreset === 'custom' ? 'text-white' : 'text-zinc-400'}`}>Custom</Text>
                    </Pressable>
                  </View>
                  {feePreset === 'custom' && (
                    <TextInput
                      value={customFee}
                      onChangeText={setCustomFee}
                      keyboardType="decimal-pad"
                      placeholder="sat/vB"
                      placeholderTextColor="#71717A"
                      className="mt-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100"
                    />
                  )}
                </View>
                <View className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                  <Text className="text-xs text-zinc-400">Preview</Text>
                  <Text className="mt-1 text-xs text-zinc-400">To: {sendTo ? shortAddress(sendTo, 6) : '—'}</Text>
                  <Text className="text-xs text-zinc-400">Amount: {formatDoge(dogeAmount)} DOGE</Text>
                  <Text className="text-xs text-zinc-400">Fee: {feeRate || 0} sat/vB</Text>
                </View>
                <Pressable disabled={isSending} onPress={onSend} className="rounded-xl bg-sky-500 px-4 py-3 disabled:opacity-60">
                  <Text className="text-center text-sm font-semibold text-white">{isSending ? 'Sending...' : 'Preview & Confirm'}</Text>
                </Pressable>
              </View>
            )}

            {activeTab === 'settings' && (
              <View className="gap-3">
                <View className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                  <Text className="text-sm font-semibold text-zinc-100">Connected Accounts</Text>
                  <View className="mt-2 gap-1">
                    {(connectedAccounts.length ? connectedAccounts : [address]).map((account) => (
                      <Text key={account} className="text-xs text-zinc-400">
                        {shortAddress(account, 8)}
                      </Text>
                    ))}
                  </View>
                </View>
                <View className="rounded-xl border border-amber-700/60 bg-amber-950/20 p-3">
                  <Text className="text-xs text-amber-200">
                    Backup seed phrase is not configured in this MVP. Store your keys securely before production.
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    void walletCore.logout?.();
                    setStatus('Logged out');
                  }}
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3">
                  <Text className="text-center text-sm text-zinc-100">Logout</Text>
                </Pressable>
                <Text className="text-center text-xs text-zinc-500">Version {version}</Text>
              </View>
            )}
          </View>

          <View className="mt-3 pb-2">
            {isLoading && <Text className="text-center text-xs text-zinc-500">Loading wallet data...</Text>}
            {error && <Text className="text-center text-xs text-red-400">{error}</Text>}
            <Text className="text-center text-xs text-zinc-500">{status}</Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

export default DojakWallet;
