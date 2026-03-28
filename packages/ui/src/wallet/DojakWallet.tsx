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
      setError(refreshError instanceof Error ? refreshError.message : 'Could not refresh wallet');
      setStatus('Refresh failed');
    }
  };

  const copyAddress = async () => {
    try {
      if (walletCore.copyText) {
        await walletCore.copyText(address);
      } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(address);
      }
      setStatus('Address copied');
    } catch {
      setError('Copy not available on this platform');
    }
  };

  const onSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)).slice(0, 5),
    [transactions]
  );

  const tabButtonClass = (tab: WalletTab) =>
    `rounded-xl px-3 py-2 text-xs font-semibold transition ${
      activeTab === tab ? 'bg-sky-500 text-white' : 'text-zinc-300 hover:bg-zinc-800'
    }`;

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
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-400">Total Balance</p>
                <p className="mt-2 text-4xl font-bold tracking-tight">{formatDoge(balance)} DOGE</p>
                <p className="mt-1 text-sm text-zinc-400">{formatUsd(balance * usdRate)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" className="rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold" onClick={() => setActiveTab('send')}>
                  Quick Send
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-semibold text-zinc-100"
                  onClick={() => setActiveTab('receive')}>
                  Receive
                </button>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">Recent Activity</p>
                  <button type="button" className="text-xs text-sky-400" onClick={refreshWallet}>
                    Refresh
                  </button>
                </div>
                <div className="space-y-2">
                  {sortedTransactions.map((tx) => (
                    <div key={tx.txid} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>{tx.direction === 'received' ? 'Received' : 'Sent'}</span>
                        <span>{tx.status ?? 'confirmed'}</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-zinc-100">
                        {tx.direction === 'sent' ? '-' : '+'}
                        {formatDoge(tx.amount)} DOGE
                      </p>
                      <p className="text-xs text-zinc-500">{shortAddress(tx.txid, 8)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'receive' && (
            <div className="space-y-4 text-center">
              <p className="text-xs uppercase tracking-wide text-zinc-400">Wallet Address</p>
              <p className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200">{address}</p>
              <div className="mx-auto w-fit rounded-2xl bg-white p-3">
                <QRCodeSVG value={address} size={220} includeMargin />
              </div>
              <button type="button" className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold" onClick={copyAddress}>
                Copy Address
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
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm text-zinc-300">Amount</p>
                  <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-950 p-1">
                    <button
                      type="button"
                      className={`rounded-md px-2 py-1 text-xs ${amountMode === 'doge' ? 'bg-sky-500 text-white' : 'text-zinc-400'}`}
                      onClick={() => setAmountMode('doge')}>
                      DOGE
                    </button>
                    <button
                      type="button"
                      className={`rounded-md px-2 py-1 text-xs ${amountMode === 'usd' ? 'bg-sky-500 text-white' : 'text-zinc-400'}`}
                      onClick={() => setAmountMode('usd')}>
                      USD
                    </button>
                  </div>
                </div>
                <input
                  inputMode="decimal"
                  value={sendAmount}
                  onChange={(event) => setSendAmount(event.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm"
                />
                <p className="mt-1 text-xs text-zinc-500">≈ {formatDoge(dogeAmount)} DOGE / {formatUsd(usdAmount)}</p>
              </div>
              <div>
                <p className="mb-2 text-sm text-zinc-300">Network Fee</p>
                <div className="grid grid-cols-4 gap-2">
                  {FEE_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setFeePreset(option.key)}
                      className={`rounded-lg px-2 py-2 text-xs ${
                        feePreset === option.key ? 'bg-sky-500 text-white' : 'bg-zinc-950 text-zinc-400'
                      }`}>
                      {option.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFeePreset('custom')}
                    className={`rounded-lg px-2 py-2 text-xs ${feePreset === 'custom' ? 'bg-sky-500 text-white' : 'bg-zinc-950 text-zinc-400'}`}>
                    Custom
                  </button>
                </div>
                {feePreset === 'custom' && (
                  <input
                    inputMode="decimal"
                    value={customFee}
                    onChange={(event) => setCustomFee(event.target.value)}
                    placeholder="sat/vB"
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm"
                  />
                )}
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-xs text-zinc-400">
                <p>Preview</p>
                <p className="mt-1">To: {sendTo ? shortAddress(sendTo, 6) : '—'}</p>
                <p>Amount: {formatDoge(dogeAmount)} DOGE</p>
                <p>Fee: {feeRate || 0} sat/vB</p>
              </div>
              <button disabled={isSending} type="submit" className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold disabled:opacity-60">
                {isSending ? 'Sending...' : 'Preview & Confirm'}
              </button>
            </form>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-sm font-semibold">Connected Accounts</p>
                <div className="mt-2 space-y-1 text-xs text-zinc-400">
                  {(connectedAccounts.length ? connectedAccounts : [address]).map((account) => (
                    <p key={account}>{shortAddress(account, 8)}</p>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-amber-700/60 bg-amber-950/20 p-3 text-xs text-amber-200">
                Backup seed phrase is not configured in this MVP. Store your keys securely before production.
              </div>
              <button
                type="button"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm"
                onClick={() => {
                  void walletCore.logout?.();
                  setStatus('Logged out');
                }}>
                Logout
              </button>
              <p className="text-center text-xs text-zinc-500">Version {version}</p>
            </div>
          )}
        </section>

        <footer className="space-y-1 pb-2">
          {isLoading && <p className="text-center text-xs text-zinc-500">Loading wallet data...</p>}
          {error && <p className="text-center text-xs text-red-400">{error}</p>}
          <p className="text-center text-xs text-zinc-500">{status}</p>
        </footer>
      </section>
    </main>
  );
}

export default DojakWallet;
