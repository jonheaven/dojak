import { FormEvent, useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { isValidAddress } from '../utils/bitcoin-utils';
import { getUiType, shortAddress } from '../utils';
import { useWalletCore, WalletTransaction } from './WalletCoreContext';
import { FEE_OPTIONS, FeePreset, WALLET_TABS, WalletTab } from './walletTypes';
import { formatDoge, formatUsd, relativeTime } from './walletFormat';
import './dojak-wallet.css';

export function DojakWallet() {
  const walletCore = useWalletCore();
  const isSidePanel = getUiType().isSidePanel;
  const [activeTab, setActiveTab] = useState<WalletTab>('home');
  const [balance, setBalance] = useState(0);
  const [address, setAddress] = useState('');
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [usdRate, setUsdRate] = useState(0);
  const [balanceHidden, setBalanceHidden] = useState(false);

  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [amountMode, setAmountMode] = useState<'doge' | 'usd'>('doge');
  const [feePreset, setFeePreset] = useState<FeePreset>('medium');

  const [connectedAccounts, setConnectedAccounts] = useState<string[]>([]);
  const [version, setVersion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'error' } | null>(null);

  const pushToast = (message: string, tone: 'ok' | 'error' = 'ok') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 2800);
  };

  const feeRate = FEE_OPTIONS.find((item) => item.key === feePreset)?.feeRate ?? 2;
  const parsedAmount = Number(sendAmount || 0);
  const dogeAmount = amountMode === 'doge' ? parsedAmount : usdRate > 0 ? parsedAmount / usdRate : 0;
  const usdAmount = dogeAmount * usdRate;

  const loadWallet = async () => {
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
    setTransactions(nextTxs ?? []);
    if (nextRate && Number.isFinite(nextRate) && nextRate > 0) setUsdRate(nextRate);
    if (nextAccounts?.length) setConnectedAccounts(nextAccounts);
    if (nextVersion) setVersion(nextVersion);
  };

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        await loadWallet();
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load wallet data';
        setError(message);
        pushToast(message, 'error');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [walletCore]);

  const refreshWallet = async () => {
    setStatus('Refreshing…');
    try {
      setError(null);
      await loadWallet();
      setStatus('Updated');
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : 'Could not refresh wallet';
      setError(message);
      setStatus('Refresh failed');
      pushToast(message, 'error');
    }
  };

  const copyAddress = async (copyValue = address) => {
    if (!copyValue) return;
    try {
      if (walletCore.copyText) {
        await walletCore.copyText(copyValue);
      } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyValue);
      }
      setStatus('Address copied');
      pushToast('Address copied');
    } catch {
      setError('Copy not available on this platform');
      pushToast('Copy not available on this platform', 'error');
    }
  };

  const onSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!walletCore.sendDogecoin) {
      setError('Send is not available yet');
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
      setStatus('Submitting…');
      const response = await walletCore.sendDogecoin({
        to: sendTo.trim(),
        amount: Number(dogeAmount.toFixed(8)),
        feeRate
      });
      setStatus(`Sent ${shortAddress(response.txid, 8)}`);
      setBalance((prev) => Math.max(0, prev - dogeAmount));
      setSendTo('');
      setSendAmount('');
      setActiveTab('home');
      pushToast('Transaction sent');
      await refreshWallet();
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'Failed to send transaction';
      setError(message);
      setStatus('Send failed');
      pushToast(message, 'error');
    } finally {
      setIsSending(false);
    }
  };

  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)).slice(0, 8),
    [transactions]
  );

  const shownBalance = balanceHidden ? '••••' : formatDoge(balance);
  const shownUsd = balanceHidden || usdRate <= 0 ? '' : formatUsd(balance * usdRate);
  const displayAddress = address || 'No address yet';

  return (
    <main className={`dj-wallet${isSidePanel ? ' is-side' : ''}`}>
      <section className="dj-shell">
        <header className="dj-top">
          <div>
            <p className="dj-kicker">Dojak</p>
            <h1 className="dj-title">Dogecoin</h1>
          </div>
          <button type="button" className="dj-chip" onClick={() => void copyAddress()} disabled={!address}>
            {address ? shortAddress(address, 6) : '—'}
          </button>
        </header>

        <div className="dj-main">
          {activeTab === 'home' && (
            <>
              <div className="dj-hero">
                <div className="dj-hero-top">
                  <p className="dj-hero-label">Total balance</p>
                  <button type="button" className="dj-icon-btn" onClick={() => setBalanceHidden((v) => !v)}>
                    {balanceHidden ? 'Show' : 'Hide'}
                  </button>
                </div>
                <p className="dj-balance">
                  <span>Ð</span>
                  {shownBalance}
                </p>
                <p className="dj-usd">{shownUsd || 'Dogecoin L1 · self-custody'}</p>
              </div>

              <section className="dj-panel">
                <p className="dj-section-label">Activity</p>
                {sortedTransactions.length === 0 ? (
                  <p className="dj-empty">{isLoading ? 'Loading activity…' : 'No transactions yet.'}</p>
                ) : (
                  sortedTransactions.map((tx) => (
                    <div className="dj-tx" key={tx.txid}>
                      <div className={`dj-tx-mark ${tx.direction}`}>{tx.direction === 'sent' ? '↑' : '↓'}</div>
                      <div className="dj-tx-copy">
                        <p className="dj-tx-title">{tx.direction === 'sent' ? 'Sent' : 'Received'}</p>
                        <p className="dj-tx-meta">
                          {shortAddress(tx.txid, 6)}
                          {tx.timestamp ? ` · ${relativeTime(tx.timestamp)}` : ''}
                          {tx.status === 'pending' ? ' · pending' : ''}
                        </p>
                      </div>
                      <p className={`dj-tx-amt ${tx.direction}`}>
                        {tx.direction === 'sent' ? '−' : '+'}
                        {formatDoge(tx.amount)}
                      </p>
                    </div>
                  ))
                )}
              </section>
            </>
          )}

          {activeTab === 'receive' && (
            <div className="dj-receive">
              <p className="dj-section-label">Receive DOGE</p>
              <div className="dj-qr">{address ? <QRCodeSVG value={address} size={168} includeMargin /> : null}</div>
              <p className="dj-address">{displayAddress}</p>
              <button type="button" className="dj-primary" onClick={() => void copyAddress()} disabled={!address}>
                Copy address
              </button>
            </div>
          )}

          {activeTab === 'send' && (
            <form onSubmit={onSend} className="dj-main">
              <label className="dj-field">
                Amount
                <div className="dj-amount-row">
                  <input
                    className="dj-input"
                    inputMode="decimal"
                    value={sendAmount}
                    onChange={(event) => setSendAmount(event.target.value)}
                    placeholder="0.00"
                  />
                  <button
                    type="button"
                    className="dj-chip"
                    onClick={() => {
                      if (amountMode === 'doge') setSendAmount(String(balance));
                      else if (usdRate > 0) setSendAmount(String(Number((balance * usdRate).toFixed(2))));
                    }}
                  >
                    Max
                  </button>
                </div>
              </label>
              <div className="dj-seg-row">
                <button
                  type="button"
                  className={`dj-seg${amountMode === 'doge' ? ' is-on' : ''}`}
                  onClick={() => setAmountMode('doge')}
                >
                  DOGE
                </button>
                <button
                  type="button"
                  className={`dj-seg${amountMode === 'usd' ? ' is-on' : ''}`}
                  onClick={() => setAmountMode('usd')}
                  disabled={usdRate <= 0}
                >
                  USD
                </button>
              </div>
              <p className="dj-hint">
                ≈ {formatDoge(dogeAmount)} DOGE{usdRate > 0 ? ` · ${formatUsd(usdAmount)}` : ''}
              </p>
              <label className="dj-field">
                Recipient
                <input
                  className="dj-input"
                  value={sendTo}
                  onChange={(event) => setSendTo(event.target.value)}
                  placeholder="D…"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </label>
              <div>
                <p className="dj-section-label">Network fee</p>
                <div className="dj-fee-row">
                  {FEE_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={`dj-fee${feePreset === option.key ? ' is-on' : ''}`}
                      onClick={() => setFeePreset(option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              {error && activeTab === 'send' ? <p className="dj-error">{error}</p> : null}
              <button className="dj-primary" disabled={isSending} type="submit">
                {isSending ? 'Sending…' : 'Send DOGE'}
              </button>
            </form>
          )}

          {activeTab === 'settings' && (
            <section className="dj-panel dj-settings">
              <div className="dj-setting">
                <p className="dj-setting-label">Version</p>
                <p className="dj-setting-value">{version || '—'}</p>
              </div>
              <div className="dj-setting">
                <p className="dj-setting-label">Address</p>
                <p className="dj-setting-value">{address ? shortAddress(address, 8) : '—'}</p>
              </div>
              <div className="dj-setting">
                <p className="dj-setting-label">Accounts</p>
                <p className="dj-setting-value">
                  {(connectedAccounts.length ? connectedAccounts : address ? [address] : [])
                    .map((item) => shortAddress(item, 4))
                    .join(', ') || '—'}
                </p>
              </div>
              <button type="button" className="dj-ghost" style={{ marginTop: 12 }} onClick={() => void refreshWallet()}>
                Refresh balance
              </button>
              {walletCore.logout ? (
                <button
                  type="button"
                  className="dj-ghost"
                  style={{ marginTop: 8 }}
                  onClick={() => void walletCore.logout?.()}
                >
                  Lock wallet
                </button>
              ) : null}
            </section>
          )}

          {error && activeTab !== 'send' ? <p className="dj-error">{error}</p> : null}
          {status ? <p className="dj-status">{status}</p> : null}
        </div>

        <nav className="dj-nav" aria-label="Wallet">
          {WALLET_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`dj-nav-btn${activeTab === tab.key ? ' is-on' : ''}`}
              onClick={() => {
                setError(null);
                setActiveTab(tab.key);
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </section>
      {toast ? <div className={`dj-toast${toast.tone === 'error' ? ' error' : ''}`}>{toast.message}</div> : null}
    </main>
  );
}

export default DojakWallet;
