import { FormEvent, useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { isValidAddress } from '../utils/bitcoin-utils';
import { shortAddress } from '../utils';
import { useWalletCore, WalletTransaction } from './WalletCoreContext';
import { FEE_OPTIONS, FeePreset, WALLET_TABS, WalletTab } from './walletTypes';

const FALLBACK_TRANSACTIONS: WalletTransaction[] = [
  { txid: 'sample-received-001', amount: 1250, direction: 'received', timestamp: Date.now() - 86_400_000, status: 'confirmed' },
  { txid: 'sample-sent-002', amount: 75, direction: 'sent', timestamp: Date.now() - 172_800_000, status: 'confirmed' }
];

function formatDoge(value: number | string) {
  const parsed = typeof value === 'number' ? value : Number(value || 0);
  return Number.isFinite(parsed) ? parsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : '0.00';
}

function formatUsd(value: number) {
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

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
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const pushToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

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
        const message = loadError instanceof Error ? loadError.message : 'Failed to load wallet data';
        setError(message);
        pushToast(message);
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
      const message = refreshError instanceof Error ? refreshError.message : 'Could not refresh wallet';
      setError(message);
      setStatus('Refresh failed');
      pushToast(`RPC error: ${message}`);
    }
  };

  const copyAddress = async (copyValue = address) => {
    try {
      if (walletCore.copyText) {
        await walletCore.copyText(copyValue);
      } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyValue);
      }
      setStatus('Address copied');
    } catch {
      setError('Copy not available on this platform');
      pushToast('Copy not available on this platform');
    }
  };

  const onSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!walletCore.sendDogecoin) return setError('Core send adapter unavailable');
    if (!sendTo.trim()) return setError('Recipient address is required');

    const isAddressValid = walletCore.validateAddress ? await walletCore.validateAddress(sendTo.trim()) : isValidAddress(sendTo.trim());
    if (!isAddressValid) return setError('Recipient address is invalid');
    if (!Number.isFinite(dogeAmount) || dogeAmount <= 0) return setError('Enter a valid amount');
    if (dogeAmount > balance) return setError('Insufficient balance');
    if (!Number.isFinite(feeRate) || feeRate <= 0) return setError('Select a valid network fee');

    try {
      setIsSending(true);
      setStatus('Submitting transaction...');
      const response = await walletCore.sendDogecoin({ to: sendTo.trim(), amount: Number(dogeAmount.toFixed(8)), feeRate });
      setStatus(`Transaction sent: ${shortAddress(response.txid, 8)}`);
      setBalance((prev) => Math.max(0, prev - dogeAmount));
      setSendTo('');
      setSendAmount('');
      setActiveTab('home');
      await refreshWallet();
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'Failed to send transaction';
      setError(message);
      setStatus('Send failed');
      pushToast(`RPC error: ${message}`);
    } finally {
      setIsSending(false);
    }
  };

  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)).slice(0, 5),
    [transactions]
  );

  const tabButtonClass = (tab: WalletTab) =>
    `rounded-lg px-1 py-2 text-[10px] font-medium leading-tight sm:text-xs ${activeTab === tab ? 'bg-amber-400 text-black' : 'bg-zinc-800 text-zinc-300'}`;

  return (
    <main className="wallet-safe-area min-h-screen bg-zinc-950 text-zinc-100">
      <section className="mx-auto flex min-h-screen w-full max-w-[402px] flex-col gap-4 px-4 py-4">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Dojak Wallet</p>
          <h1 className="mt-1 text-xl font-semibold">Dogecoin</h1>
          <p className="mt-1 text-xs text-zinc-400">{shortAddress(address, 7)}</p>
        </header>

        <div className="grid grid-cols-4 gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-2">
          {WALLET_TABS.map((tab) => (
            <button key={tab.key} type="button" className={tabButtonClass(tab.key)} onClick={() => setActiveTab(tab.key)}>
              {tab.label}
            </button>
          ))}
        </div>

        <section className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
          {activeTab === 'home' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-400">DOGE balance</p>
                <p className="mt-2 text-4xl font-bold tracking-tight">
                  <span className="text-amber-300">Ð</span> {formatDoge(balance)}
                </p>
                <p className="mt-1 text-sm text-zinc-400">{formatUsd(balance * usdRate)}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs">
                <p className="mb-2 font-semibold text-zinc-200">Recent activity</p>
                {sortedTransactions.map((tx) => (
                  <p key={tx.txid} className="text-zinc-400">
                    {tx.direction === 'sent' ? '-' : '+'}
                    {formatDoge(tx.amount)} DOGE • {shortAddress(tx.txid, 6)}
                  </p>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'receive' && (
            <div className="space-y-4 text-center">
              <p className="text-xs uppercase tracking-wide text-zinc-400">Receive DOGE</p>
              <p className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200">{address}</p>
              <div className="mx-auto w-fit rounded-2xl bg-white p-3">
                <QRCodeSVG value={address} size={160} includeMargin />
              </div>
              <button
                type="button"
                className="w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-black"
                onClick={() => copyAddress()}
              >
                Copy address
              </button>
            </div>
          )}

          {activeTab === 'send' && (
            <form onSubmit={onSend} className="space-y-4">
              <label className="block text-sm text-zinc-300">
                Recipient
                <input
                  value={sendTo}
                  onChange={(event) => setSendTo(event.target.value)}
                  placeholder="D..."
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm"
                />
              </label>
              <div>
                <input
                  inputMode="decimal"
                  value={sendAmount}
                  onChange={(event) => setSendAmount(event.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  ≈ {formatDoge(dogeAmount)} DOGE / {formatUsd(usdAmount)}
                </p>
              </div>
              <button disabled={isSending} type="submit" className="w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60">
                {isSending ? 'Sending...' : 'Send DOGE'}
              </button>
            </form>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-400">Version {version}</p>
              <p className="text-xs text-zinc-500">
                Connected: {(connectedAccounts.length ? connectedAccounts : [address]).map((a) => shortAddress(a, 6)).join(', ')}
              </p>
            </div>
          )}
        </section>

        <footer className="space-y-1 pb-2">
          {isLoading && <p className="text-center text-xs text-zinc-500">Loading wallet data...</p>}
          {error && (
            <p className="text-center text-xs text-red-400">
              {error}{' '}
              <button type="button" className="underline" onClick={() => void refreshWallet()}>
                Retry
              </button>
            </p>
          )}
          <p className="text-center text-xs text-zinc-500">{status}</p>
        </footer>
      </section>
      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-red-400/40 bg-zinc-900 px-3 py-2 text-xs text-red-200">
          {toast}
        </div>
      )}
    </main>
  );
}

export default DojakWallet;
