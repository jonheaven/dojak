import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isValidAddress } from '../utils/bitcoin-utils';
import { shortAddress } from '../utils';
import { useWalletCore, WalletTransaction } from './WalletCoreContext';
import { FEE_OPTIONS, FeePreset, WALLET_TABS, WalletTab } from './walletTypes';
import { formatDoge, formatUsd, relativeTime } from './walletFormat';

export function DojakWallet() {
  const walletCore = useWalletCore();
  const [activeTab, setActiveTab] = useState<WalletTab>('home');
  const [balance, setBalance] = useState(0);
  const [address, setAddress] = useState('');
  const [txs, setTxs] = useState<WalletTransaction[]>([]);
  const [usdRate, setUsdRate] = useState(0);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [amountMode, setAmountMode] = useState<'doge' | 'usd'>('doge');
  const [feePreset, setFeePreset] = useState<FeePreset>('medium');
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const feeRate = FEE_OPTIONS.find((item) => item.key === feePreset)?.feeRate ?? 2;
  const parsedAmount = Number(sendAmount || 0);
  const dogeAmount = amountMode === 'doge' ? parsedAmount : usdRate > 0 ? parsedAmount / usdRate : 0;

  const pushToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  };

  const refreshWallet = async () => {
    const [nextBalance, nextAddress, nextTxs, nextRate, nextVersion] = await Promise.all([
      walletCore.getBalance?.(),
      walletCore.getAddress?.(),
      walletCore.getTransactions?.(),
      walletCore.getUsdRate?.(),
      walletCore.getVersion?.()
    ]);
    setBalance(Number(nextBalance?.amount ?? 0));
    if (nextAddress) setAddress(nextAddress);
    setTxs(nextTxs ?? []);
    if (nextRate && Number.isFinite(nextRate) && nextRate > 0) setUsdRate(nextRate);
    if (nextVersion) setVersion(nextVersion);
  };

  useEffect(() => {
    void (async () => {
      try {
        setIsLoading(true);
        setError(null);
        await refreshWallet();
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to refresh wallet';
        setError(message);
        pushToast(message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [walletCore]);

  const sorted = useMemo(
    () => [...txs].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)).slice(0, 8),
    [txs]
  );

  const copyAddress = async () => {
    if (!address) return;
    try {
      await walletCore.copyText?.(address);
      pushToast('Address copied');
    } catch {
      pushToast('Copy is not available');
    }
  };

  const onSend = async () => {
    setError(null);
    if (!walletCore.sendDogecoin) {
      setError('Send is not available yet');
      return;
    }
    const valid = walletCore.validateAddress ? await walletCore.validateAddress(sendTo.trim()) : isValidAddress(sendTo.trim());
    if (!valid) {
      setError('That does not look like a Dogecoin address');
      return;
    }
    if (!Number.isFinite(dogeAmount) || dogeAmount <= 0) {
      setError('Enter an amount greater than zero');
      return;
    }
    if (dogeAmount > balance) {
      setError('Amount is higher than your balance');
      return;
    }
    try {
      setIsSending(true);
      const tx = await walletCore.sendDogecoin({ to: sendTo.trim(), amount: Number(dogeAmount.toFixed(8)), feeRate });
      setStatus(`Sent ${shortAddress(tx.txid, 7)}`);
      setSendTo('');
      setSendAmount('');
      setActiveTab('home');
      pushToast('Transaction sent');
      await refreshWallet();
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'Failed to send';
      setError(message);
      pushToast(message);
    } finally {
      setIsSending(false);
    }
  };

  const shownBalance = balanceHidden ? '••••' : formatDoge(balance);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => void refreshWallet()} tintColor="#e8d48b" />}
      >
        <View style={styles.top}>
          <View>
            <Text style={styles.kicker}>DOJAK</Text>
            <Text style={styles.title}>Dogecoin</Text>
          </View>
          <Pressable style={styles.chip} onPress={() => void copyAddress()}>
            <Text style={styles.chipText}>{address ? shortAddress(address, 6) : '—'}</Text>
          </Pressable>
        </View>

        {activeTab === 'home' && (
          <>
            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <Text style={styles.heroLabel}>TOTAL BALANCE</Text>
                <Pressable style={styles.hideBtn} onPress={() => setBalanceHidden((v) => !v)}>
                  <Text style={styles.hideText}>{balanceHidden ? 'Show' : 'Hide'}</Text>
                </Pressable>
              </View>
              <Text style={styles.balance}>Ð {shownBalance}</Text>
              <Text style={styles.usd}>
                {balanceHidden || usdRate <= 0 ? 'Dogecoin L1 · self-custody' : formatUsd(balance * usdRate)}
              </Text>
            </View>
            <View style={styles.panel}>
              <Text style={styles.section}>ACTIVITY</Text>
              {sorted.length === 0 ? (
                <Text style={styles.empty}>{isLoading ? 'Loading activity…' : 'No transactions yet.'}</Text>
              ) : (
                sorted.map((tx) => (
                  <View key={tx.txid} style={styles.tx}>
                    <View style={styles.txCopy}>
                      <Text style={styles.txTitle}>{tx.direction === 'sent' ? 'Sent' : 'Received'}</Text>
                      <Text style={styles.txMeta}>
                        {shortAddress(tx.txid, 6)}
                        {tx.timestamp ? ` · ${relativeTime(tx.timestamp)}` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.txAmt, tx.direction === 'received' ? styles.received : null]}>
                      {tx.direction === 'sent' ? '−' : '+'}
                      {formatDoge(tx.amount)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {activeTab === 'receive' && (
          <View style={styles.receive}>
            <Text style={styles.section}>RECEIVE DOGE</Text>
            {address ? (
              <View style={styles.qr}>
                <QRCode value={address} size={168} />
              </View>
            ) : null}
            <Text selectable style={styles.address}>
              {address || 'No address yet'}
            </Text>
            <Pressable style={styles.primary} onPress={() => void copyAddress()}>
              <Text style={styles.primaryText}>Copy address</Text>
            </Pressable>
          </View>
        )}

        {activeTab === 'send' && (
          <View style={styles.stack}>
            <Text style={styles.fieldLabel}>Amount</Text>
            <View style={styles.amountRow}>
              <TextInput
                value={sendAmount}
                onChangeText={setSendAmount}
                placeholder="0.00"
                placeholderTextColor="#8a8478"
                keyboardType="decimal-pad"
                style={[styles.input, styles.amountInput]}
              />
              <Pressable
                style={styles.chip}
                onPress={() => {
                  if (amountMode === 'doge') setSendAmount(String(balance));
                  else if (usdRate > 0) setSendAmount(String(Number((balance * usdRate).toFixed(2))));
                }}
              >
                <Text style={styles.chipText}>Max</Text>
              </Pressable>
            </View>
            <View style={styles.segRow}>
              {(['doge', 'usd'] as const).map((mode) => (
                <Pressable
                  key={mode}
                  style={[styles.seg, amountMode === mode && styles.segOn]}
                  onPress={() => setAmountMode(mode)}
                >
                  <Text style={[styles.segText, amountMode === mode && styles.segTextOn]}>{mode.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}>
              ≈ {formatDoge(dogeAmount)} DOGE{usdRate > 0 ? ` · ${formatUsd(dogeAmount * usdRate)}` : ''}
            </Text>
            <Text style={styles.fieldLabel}>Recipient</Text>
            <TextInput
              value={sendTo}
              onChangeText={setSendTo}
              placeholder="D…"
              placeholderTextColor="#8a8478"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <Text style={styles.section}>NETWORK FEE</Text>
            <View style={styles.segRow}>
              {FEE_OPTIONS.map((option) => (
                <Pressable
                  key={option.key}
                  style={[styles.seg, feePreset === option.key && styles.segOn]}
                  onPress={() => setFeePreset(option.key)}
                >
                  <Text style={[styles.segText, feePreset === option.key && styles.segTextOn]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={styles.primary} onPress={() => void onSend()} disabled={isSending}>
              <Text style={styles.primaryText}>{isSending ? 'Sending…' : 'Send DOGE'}</Text>
            </Pressable>
          </View>
        )}

        {activeTab === 'settings' && (
          <View style={styles.panel}>
            <View style={styles.setting}>
              <Text style={styles.txTitle}>Version</Text>
              <Text style={styles.txMeta}>{version || '—'}</Text>
            </View>
            <View style={styles.setting}>
              <Text style={styles.txTitle}>Address</Text>
              <Text style={styles.txMeta}>{address ? shortAddress(address, 8) : '—'}</Text>
            </View>
            <Pressable style={[styles.ghost, { marginTop: 12 }]} onPress={() => void refreshWallet()}>
              <Text style={styles.ghostText}>Refresh balance</Text>
            </Pressable>
            {walletCore.logout ? (
              <Pressable style={[styles.ghost, { marginTop: 8 }]} onPress={() => void walletCore.logout?.()}>
                <Text style={styles.ghostText}>Lock wallet</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {error && activeTab !== 'send' ? <Text style={styles.error}>{error}</Text> : null}
        {status ? <Text style={styles.status}>{status}</Text> : null}
      </ScrollView>

      <View style={styles.nav}>
        {WALLET_TABS.map((tab) => {
          const on = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.navBtn, on && styles.navBtnOn]}
              onPress={() => {
                setError(null);
                setActiveTab(tab.key);
              }}
            >
              <Text style={[styles.navText, on && styles.navTextOn]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0c' },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  kicker: { color: '#c2a633', fontSize: 10, fontWeight: '700', letterSpacing: 2.2 },
  title: { color: '#f4efe3', fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 2 },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 999,
    paddingHorizontal: 12,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  chipText: { color: '#f4efe3', fontSize: 12, fontWeight: '700' },
  hero: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#e8d48b'
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { color: 'rgba(22,17,9,0.62)', fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  hideBtn: { backgroundColor: 'rgba(22,17,9,0.08)', borderRadius: 999, paddingHorizontal: 10, height: 28, justifyContent: 'center' },
  hideText: { color: '#161109', fontSize: 11, fontWeight: '700' },
  balance: { marginTop: 10, color: '#161109', fontSize: 34, fontWeight: '800', letterSpacing: -0.8 },
  usd: { marginTop: 6, color: 'rgba(22,17,9,0.72)', fontSize: 14, fontWeight: '600' },
  panel: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderRadius: 18,
    padding: 12
  },
  section: { color: 'rgba(190,185,170,0.45)', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 },
  empty: { color: 'rgba(190,185,170,0.72)', fontSize: 13 },
  tx: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  txCopy: { flex: 1 },
  txTitle: { color: '#f4efe3', fontSize: 13, fontWeight: '700' },
  txMeta: { color: 'rgba(190,185,170,0.72)', fontSize: 11, marginTop: 2 },
  txAmt: { color: '#f4efe3', fontSize: 13, fontWeight: '700' },
  received: { color: '#7dcea0' },
  receive: { alignItems: 'center', gap: 12 },
  qr: { backgroundColor: '#fff', borderRadius: 18, padding: 12 },
  address: { color: '#f4efe3', fontSize: 12, textAlign: 'center' },
  stack: { gap: 8 },
  fieldLabel: { color: 'rgba(190,185,170,0.72)', fontSize: 12, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(0,0,0,0.28)',
    color: '#f4efe3',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14
  },
  amountRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  amountInput: { flex: 1 },
  segRow: { flexDirection: 'row', gap: 6 },
  seg: {
    flex: 1,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  segOn: { backgroundColor: '#e8d48b', borderColor: 'transparent' },
  segText: { color: 'rgba(190,185,170,0.72)', fontSize: 12, fontWeight: '700' },
  segTextOn: { color: '#161109' },
  hint: { color: 'rgba(190,185,170,0.72)', fontSize: 12 },
  primary: {
    marginTop: 8,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#e8d48b',
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryText: { color: '#161109', fontSize: 14, fontWeight: '800' },
  ghost: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  ghostText: { color: '#f4efe3', fontSize: 14, fontWeight: '700' },
  setting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)'
  },
  error: { color: '#f05266', fontSize: 12 },
  status: { textAlign: 'center', color: 'rgba(190,185,170,0.45)', fontSize: 11, marginTop: 8 },
  nav: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0b0b0c'
  },
  navBtn: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  navBtnOn: { backgroundColor: '#e8d48b' },
  navText: { color: 'rgba(190,185,170,0.45)', fontSize: 11, fontWeight: '700' },
  navTextOn: { color: '#161109' },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 72,
    backgroundColor: '#161616',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 10
  },
  toastText: { color: '#f4efe3', textAlign: 'center', fontSize: 12, fontWeight: '600' }
});

export default DojakWallet;
