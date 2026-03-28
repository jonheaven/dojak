import { Component, FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { DOGEOS_ACTIVE_CONFIG } from '@dojak/core';

import { isValidAddress } from '../utils/bitcoin-utils';
import { shortAddress } from '../utils';
import { useWalletCore, WalletTransaction } from './WalletCoreContext';
import { FEE_OPTIONS, FeePreset, WALLET_TABS, WalletTab } from './walletTypes';

const FALLBACK_TRANSACTIONS: WalletTransaction[] = [
  { txid: 'sample-received-001', amount: 1250, direction: 'received', timestamp: Date.now() - 86_400_000, status: 'confirmed' },
  { txid: 'sample-sent-002', amount: 75, direction: 'sent', timestamp: Date.now() - 172_800_000, status: 'confirmed' }
];

const CURATED_DOGEOS_APPS = [
  { label: 'DogeOS Testnet Faucet', url: 'https://faucet.testnet.dogeos.com' },
  { label: 'DogeOS Testnet Bridge', url: 'https://bridge.testnet.dogeos.com' },
  { label: 'DogeOS Testnet Swap', url: 'https://swap.testnet.dogeos.com' },
  { label: 'DogeOS Homepage', url: 'https://dogeos.com' },
  { label: 'Blockscout Explorer', url: DOGEOS_ACTIVE_CONFIG.blockExplorerUrl }
];
const DOGEOS_TESTNET_FAUCET = 'https://faucet.testnet.dogeos.com';
const DOGEOS_CHAIN_ID_HEX = `0x${DOGEOS_ACTIVE_CONFIG.chainId.toString(16)}`;

type ProviderListener = (...args: any[]) => void;

class DogeOsProvider {
  isDojak = true;
  isMetaMask = false;
  providers = [this];
  selectedAddress: `0x${string}` | null = null;
  chainId = DOGEOS_CHAIN_ID_HEX;
  private listeners = new Map<string, Set<ProviderListener>>();

  constructor(
    private readonly getAddress: () => `0x${string}`,
    private readonly sendTx: (request: { to: `0x${string}`; amount: string; data?: `0x${string}` }) => Promise<string>
  ) {
    this.selectedAddress = getAddress();
  }

  private emit(eventName: string, ...payload: any[]) {
    this.listeners.get(eventName)?.forEach((listener) => listener(...payload));
  }

  on(eventName: string, listener: ProviderListener) {
    if (!this.listeners.has(eventName)) this.listeners.set(eventName, new Set());
    this.listeners.get(eventName)!.add(listener);
  }

  removeListener(eventName: string, listener: ProviderListener) {
    this.listeners.get(eventName)?.delete(listener);
  }

  async request({ method, params }: { method: string; params?: any[] }) {
    const activeAddress = this.getAddress();
    this.selectedAddress = activeAddress;

    if (method === 'eth_chainId') return this.chainId;
    if (method === 'net_version') return String(DOGEOS_ACTIVE_CONFIG.chainId);
    if (method === 'eth_accounts') return [activeAddress];
    if (method === 'eth_requestAccounts') {
      this.emit('connect', { chainId: this.chainId });
      this.emit('accountsChanged', [activeAddress]);
      this.emit('chainChanged', this.chainId);
      return [activeAddress];
    }
    if (method === 'wallet_switchEthereumChain') {
      const requestedChainId = String(params?.[0]?.chainId ?? '').toLowerCase();
      if (requestedChainId && requestedChainId !== this.chainId.toLowerCase()) {
        throw new Error(`Unsupported chain ${requestedChainId}. Please switch to DogeOS Testnet (${this.chainId}).`);
      }
      this.emit('chainChanged', this.chainId);
      return null;
    }
    if (method === 'wallet_addEthereumChain') {
      const requested = params?.[0] ?? {};
      const requestedChainId = String(requested.chainId ?? '').toLowerCase();
      const normalizedRpcUrls = Array.isArray(requested.rpcUrls)
        ? requested.rpcUrls.map((url: string) => url.replace(/\/+$/, '').toLowerCase())
        : [];
      const expectedRpcUrl = DOGEOS_ACTIVE_CONFIG.rpcUrl.replace(/\/+$/, '').toLowerCase();
      // Mainnet/testnet switching must happen by changing DOGEOS_ACTIVE_CONFIG.
      if (requestedChainId && requestedChainId !== this.chainId.toLowerCase()) {
        throw new Error(`Unsupported chain ${requestedChainId}. Only DogeOS Testnet (${this.chainId}) is available.`);
      }
      if (normalizedRpcUrls.length > 0 && !normalizedRpcUrls.includes(expectedRpcUrl)) {
        throw new Error(`Unsupported RPC URL. Use ${DOGEOS_ACTIVE_CONFIG.rpcUrl} for DogeOS Testnet.`);
      }
      this.emit('chainChanged', this.chainId);
      return null;
    }
    if (method === 'eth_sendTransaction') {
      const tx = params?.[0] ?? {};
      if (!tx.to) throw new Error('eth_sendTransaction requires a recipient (to)');
      const hash = await this.sendTx({ to: tx.to, amount: tx.value ?? '0', data: tx.data });
      return hash;
    }
    if (method === 'wallet_getPermissions') {
      return [{ invoker: 'dojak-wallet', parentCapability: 'eth_accounts' }];
    }
    if (method === 'wallet_requestPermissions') {
      this.emit('accountsChanged', [activeAddress]);
      return [{ parentCapability: 'eth_accounts' }];
    }
    if (method === 'eth_estimateGas') {
      return '0x5208';
    }
    if (method === 'personal_sign' || method === 'eth_sign' || method === 'eth_signTypedData_v4') {
      throw new Error('Signing is not implemented in this testnet build');
    }

    throw new Error(`Method not implemented in Dojak injected provider: ${method}`);
  }
}

class WalletErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">DApp view crashed. Reload tab to recover.</p>;
    }
    return this.props.children;
  }
}

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

  const [dogeOsAddress, setDogeOsAddress] = useState<`0x${string}`>('0x0000000000000000000000000000000000000000');
  const [dogeOsBalance, setDogeOsBalance] = useState('0');
  const [dogeOsTransactions, setDogeOsTransactions] = useState<WalletTransaction[]>([]);
  const [dogeOsSendTo, setDogeOsSendTo] = useState('');
  const [dogeOsSendAmount, setDogeOsSendAmount] = useState('');
  const [bridgeAmount, setBridgeAmount] = useState('');
  const [bridgeDirection, setBridgeDirection] = useState<'l1-to-dogeos' | 'dogeos-to-l1'>('l1-to-dogeos');
  const [dappUrl, setDappUrl] = useState(CURATED_DOGEOS_APPS[0].url);
  const [dappLoading, setDappLoading] = useState(true);
  const [dogeOsLoading, setDogeOsLoading] = useState(false);
  const [dogeOsError, setDogeOsError] = useState<string | null>(null);
  const [dogeOsGasEstimate, setDogeOsGasEstimate] = useState<string | null>(null);

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
        const [nextBalance, nextAddress, nextTxs, nextRate, nextAccounts, nextVersion, nextDogeOsAddress, nextDogeOsBalance, nextDogeOsTxs] =
          await Promise.all([
            walletCore.getBalance?.(),
            walletCore.getAddress?.(),
            walletCore.getTransactions?.(),
            walletCore.getUsdRate?.(),
            walletCore.getConnectedAccounts?.(),
            walletCore.getVersion?.(),
            walletCore.getDogeOsAddress?.(),
            walletCore.getDogeOsBalance?.(),
            walletCore.getDogeOsTransactions?.()
          ]);
        setBalance(Number(nextBalance?.amount ?? 0));
        if (nextAddress) setAddress(nextAddress);
        if (nextTxs?.length) setTransactions(nextTxs);
        if (nextRate && Number.isFinite(nextRate) && nextRate > 0) setUsdRate(nextRate);
        if (nextAccounts?.length) setConnectedAccounts(nextAccounts);
        if (nextVersion) setVersion(nextVersion);
        if (nextDogeOsAddress) setDogeOsAddress(nextDogeOsAddress);
        if (nextDogeOsBalance) setDogeOsBalance(nextDogeOsBalance);
        if (nextDogeOsTxs?.length) setDogeOsTransactions(nextDogeOsTxs);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const provider = new DogeOsProvider(
      () => dogeOsAddress,
      async (request) => {
        const response = await walletCore.sendDogeOs?.({ to: request.to, amount: request.amount });
        return response?.txid ?? `0x${Date.now().toString(16)}`;
      }
    );
    (window as any).ethereum = provider;
    (window as any).dojakEthereum = provider;
  }, [dogeOsAddress, walletCore]);

  useEffect(() => {
    setDappLoading(true);
  }, [dappUrl]);

  useEffect(() => {
    const recipient = dogeOsSendTo.trim();
    if (!walletCore.estimateDogeOsGas || !walletCore.validateDogeOsAddress?.(recipient) || Number(dogeOsSendAmount) <= 0) {
      setDogeOsGasEstimate(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const estimate = await walletCore.estimateDogeOsGas?.({ to: recipient as `0x${string}`, amount: dogeOsSendAmount });
        setDogeOsGasEstimate(estimate?.feeInDoge ?? null);
      } catch {
        setDogeOsGasEstimate(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [dogeOsSendAmount, dogeOsSendTo, walletCore]);

  const refreshWallet = async () => {
    setStatus('Refreshing...');
    try {
      const [nextBalance, nextTxs, nextDogeOsBalance, nextDogeOsTxs] = await Promise.all([
        walletCore.getBalance?.(),
        walletCore.getTransactions?.(),
        walletCore.getDogeOsBalance?.(),
        walletCore.getDogeOsTransactions?.()
      ]);
      if (nextBalance?.amount !== undefined) setBalance(Number(nextBalance.amount));
      if (nextTxs?.length) setTransactions(nextTxs);
      if (nextDogeOsBalance !== undefined) setDogeOsBalance(nextDogeOsBalance);
      if (nextDogeOsTxs) setDogeOsTransactions(nextDogeOsTxs);
      setStatus('Wallet updated');
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : 'Could not refresh wallet';
      setError(message);
      setStatus('Refresh failed');
      pushToast(`RPC error: ${message}`);
    }
  };

  const refreshDogeOs = async () => {
    try {
      setDogeOsLoading(true);
      setDogeOsError(null);
      const [nextDogeOsBalance, nextDogeOsTxs] = await Promise.all([walletCore.getDogeOsBalance?.(), walletCore.getDogeOsTransactions?.()]);
      if (nextDogeOsBalance !== undefined) setDogeOsBalance(nextDogeOsBalance);
      if (nextDogeOsTxs) setDogeOsTransactions(nextDogeOsTxs);
      setStatus('DogeOS updated');
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : 'Could not refresh DogeOS data';
      setDogeOsError(message);
      pushToast(`RPC error: ${message}`);
    } finally {
      setDogeOsLoading(false);
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

  const onSendDogeOs = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = dogeOsSendTo.trim();
    if (!walletCore.sendDogeOs) return setError('DogeOS send unavailable');
    if (!walletCore.validateDogeOsAddress?.(normalized)) return setError('DogeOS recipient is invalid');
    if (Number(dogeOsSendAmount) <= 0) return setError('Enter DogeOS amount');

    try {
      const tx = await walletCore.sendDogeOs({ to: normalized as `0x${string}`, amount: dogeOsSendAmount });
      setStatus(`DogeOS tx sent: ${shortAddress(tx.txid, 8)}`);
      setDogeOsSendTo('');
      setDogeOsSendAmount('');
      setDogeOsGasEstimate(null);
      await refreshDogeOs();
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'DogeOS send failed';
      setError(message);
      pushToast(`RPC error: ${message}`);
    }
  };

  const onBridge = async () => {
    if (!walletCore.bridgeDogeOs) return setError('Bridge unavailable');
    try {
      const tx = await walletCore.bridgeDogeOs({ amount: bridgeAmount, direction: bridgeDirection });
      setStatus(`Bridge submitted: ${shortAddress(tx.txid, 8)}`);
      setBridgeAmount('');
    } catch (bridgeError) {
      const message = bridgeError instanceof Error ? bridgeError.message : 'Bridge failed';
      setError(message);
      pushToast(`RPC error: ${message}`);
    }
  };

  const sortedTransactions = useMemo(() => [...transactions].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)).slice(0, 5), [transactions]);

  const tabButtonClass = (tab: WalletTab) =>
    `rounded-xl px-3 py-2 text-xs font-semibold transition ${activeTab === tab ? 'bg-amber-400 text-black' : 'text-zinc-300 hover:bg-zinc-800'}`;

  return (
    <main className="wallet-safe-area min-h-screen bg-zinc-950 text-zinc-100">
      <section className="mx-auto flex min-h-screen w-full max-w-[402px] flex-col gap-4 px-4 py-4">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Dojak Wallet</p>
          <h1 className="mt-1 text-xl font-semibold">Dogecoin</h1>
          <p className="mt-1 text-xs text-zinc-400">{shortAddress(address, 7)}</p>
        </header>

        <div className="grid grid-cols-5 gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-2">
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
                <p className="text-xs uppercase tracking-wide text-zinc-400">DOGE (L1)</p>
                <p className="mt-2 text-4xl font-bold tracking-tight">{formatDoge(balance)} DOGE</p>
                <p className="mt-1 text-sm text-zinc-400">{formatUsd(balance * usdRate)}</p>
              </div>
              <div className="rounded-xl border border-amber-700/30 bg-amber-500/10 p-3">
                <p className="text-xs uppercase tracking-wide text-amber-200">DOGE (DogeOS)</p>
                <p className="mt-1 text-2xl font-bold text-amber-100">{formatDoge(dogeOsBalance)} DOGE</p>
                <p className="mt-1 inline-flex w-fit rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200">
                  Network Status: DogeOS Testnet • Chain 6281971
                </p>
                <p className="text-xs text-zinc-400">Same seed, same DOGE — now with smart contracts and dApps on DogeOS.</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs">
                <p className="mb-2 font-semibold text-zinc-200">Recent L1 Activity</p>
                {sortedTransactions.map((tx) => (
                  <p key={tx.txid} className="text-zinc-400">{tx.direction === 'sent' ? '-' : '+'}{formatDoge(tx.amount)} DOGE • {shortAddress(tx.txid, 6)}</p>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'receive' && (
            <div className="space-y-4 text-center">
              <p className="text-xs uppercase tracking-wide text-zinc-400">L1 Wallet Address</p>
              <p className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200">{address}</p>
              <div className="mx-auto w-fit rounded-2xl bg-white p-3"><QRCodeSVG value={address} size={160} includeMargin /></div>
              <p className="text-xs uppercase tracking-wide text-amber-300">DogeOS 0x Address</p>
              <p className="rounded-xl border border-amber-600 bg-zinc-950 px-3 py-2 text-xs text-zinc-200">{dogeOsAddress}</p>
              <div className="mx-auto w-fit rounded-2xl bg-white p-3"><QRCodeSVG value={dogeOsAddress} size={160} includeMargin /></div>
              <button type="button" className="w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-black" onClick={() => copyAddress(dogeOsAddress)}>
                Copy DogeOS Address
              </button>
            </div>
          )}

          {activeTab === 'send' && (
            <form onSubmit={onSend} className="space-y-4">
              <label className="block text-sm text-zinc-300">Recipient
                <input value={sendTo} onChange={(event) => setSendTo(event.target.value)} placeholder="D..." className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm" />
              </label>
              <div><input inputMode="decimal" value={sendAmount} onChange={(event) => setSendAmount(event.target.value)} placeholder="0.00" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm" />
                <p className="mt-1 text-xs text-zinc-500">≈ {formatDoge(dogeAmount)} DOGE / {formatUsd(usdAmount)}</p></div>
              <button disabled={isSending} type="submit" className="w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60">{isSending ? 'Sending...' : 'Send DOGE (L1)'}</button>
            </form>
          )}

          {activeTab === 'dogeos' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-amber-600/50 bg-zinc-950/80 p-3 text-xs">
                <p className="font-semibold text-amber-300">DogeOS Apps (Testnet)</p>
                <p className="text-zinc-400">{DOGEOS_ACTIVE_CONFIG.poweredByLabel}</p>
                <p className="text-zinc-400">Network: {DOGEOS_ACTIVE_CONFIG.name}</p>
                <p className="text-zinc-500">Chain ID: {DOGEOS_ACTIVE_CONFIG.chainId} • Gas token: DOGE</p>
                <p className="mt-1 inline-flex w-fit rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200">
                  Network Status: DogeOS Testnet • Chain 6281971
                </p>
              </div>

              <form onSubmit={onSendDogeOs} className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="flex items-center justify-between"><p className="text-sm font-semibold">Send on DogeOS</p><button type="button" onClick={() => void refreshDogeOs()} className="text-xs text-amber-300">Pull to refresh</button></div>
                <input value={dogeOsSendTo} onChange={(event) => setDogeOsSendTo(event.target.value)} placeholder="0x..." className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs" />
                <input value={dogeOsSendAmount} onChange={(event) => setDogeOsSendAmount(event.target.value)} placeholder="DOGE amount" className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs" />
                <p className="text-xs text-zinc-500">Estimated gas: {dogeOsGasEstimate ? `${formatDoge(dogeOsGasEstimate)} DOGE` : '—'}</p>
                <button type="submit" className="w-full rounded-lg bg-amber-400 py-2 text-xs font-semibold text-black">Send DOGE (DogeOS)</button>
                {dogeOsLoading && <p className="text-xs text-zinc-400">Refreshing DogeOS state…</p>}
                {dogeOsError && <div className="rounded-lg border border-red-600/50 bg-red-500/10 p-2 text-xs text-red-300">{dogeOsError} <button type="button" onClick={() => void refreshDogeOs()} className="ml-2 underline">Retry</button></div>}
              </form>

              <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs">
                <p className="text-sm font-semibold">Bridge (placeholder contract call)</p>
                <p className="text-zinc-500">Official bridge contract TBA — currently placeholder.</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setBridgeDirection('l1-to-dogeos')} className={`rounded-lg px-2 py-2 ${bridgeDirection === 'l1-to-dogeos' ? 'bg-amber-400 text-black' : 'bg-zinc-800 text-zinc-300'}`}>L1 → DogeOS</button>
                  <button type="button" onClick={() => setBridgeDirection('dogeos-to-l1')} className={`rounded-lg px-2 py-2 ${bridgeDirection === 'dogeos-to-l1' ? 'bg-amber-400 text-black' : 'bg-zinc-800 text-zinc-300'}`}>DogeOS → L1</button>
                </div>
                <input value={bridgeAmount} onChange={(event) => setBridgeAmount(event.target.value)} placeholder="DOGE amount" className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2" />
                <button type="button" onClick={onBridge} className="w-full rounded-lg border border-amber-400 py-2 text-amber-300">Start Bridge</button>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs">
                <p className="text-sm font-semibold">DApp Browser + WalletConnect v2 fallback</p>
                <input value={dappUrl} onChange={(event) => setDappUrl(event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2" />
                <p className="mt-1 text-zinc-500">Fallback: open WalletConnect v2 QR modal when injected provider is unavailable.</p>
                <a
                  href={DOGEOS_TESTNET_FAUCET}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex w-full justify-center rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-black">
                  Open DogeOS testnet faucet
                </a>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CURATED_DOGEOS_APPS.map((dapp) => (
                    <button key={dapp.url} type="button" onClick={() => setDappUrl(dapp.url)} className="rounded-lg border border-zinc-700 px-2 py-1 text-[11px] text-amber-300">
                      {dapp.label}
                    </button>
                  ))}
                </div>
                <WalletErrorBoundary>
                  <div className="relative mt-2">
                    {dappLoading && <p className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-zinc-950/80 text-xs text-zinc-400">Loading dApp…</p>}
                    <iframe
                      title="dogeos-dapp-browser"
                      src={dappUrl}
                      className="h-52 w-full rounded-lg border border-zinc-700 bg-zinc-900"
                      onLoad={() => setDappLoading(false)}
                      onError={() => {
                        setDappLoading(false);
                        setError('Failed to load DogeOS dApp');
                        pushToast('Failed to load DogeOS dApp');
                      }}
                    />
                  </div>
                </WalletErrorBoundary>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs">
                <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">DogeOS History</p><a href={DOGEOS_ACTIVE_CONFIG.blockExplorerUrl} target="_blank" rel="noreferrer" className="text-amber-300">Explorer</a></div>
                <div className="space-y-1">{dogeOsTransactions.slice(0, 4).map((tx) => <p key={tx.txid} className="text-zinc-300">{tx.direction === 'sent' ? '-' : '+'}{formatDoge(tx.amount)} DOGE • {shortAddress(tx.txid, 6)}</p>)}</div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && <div className="space-y-3"><p className="text-xs text-zinc-400">Version {version}</p><p className="text-xs text-zinc-500">Connected: {(connectedAccounts.length ? connectedAccounts : [address]).map((a) => shortAddress(a, 6)).join(', ')}</p></div>}
        </section>

        <footer className="space-y-1 pb-2">
          {isLoading && <p className="text-center text-xs text-zinc-500">Loading wallet data...</p>}
          {error && <p className="text-center text-xs text-red-400">{error} <button type="button" className="underline" onClick={() => void refreshWallet()}>Retry</button></p>}
          <p className="text-center text-xs text-zinc-500">{status}</p>
        </footer>
      </section>
      {toast && <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-red-400/40 bg-zinc-900 px-3 py-2 text-xs text-red-200">{toast}</div>}
    </main>
  );
}

export default DojakWallet;
