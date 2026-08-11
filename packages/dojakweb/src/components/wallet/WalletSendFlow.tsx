/**
 * World-class Local Browser Wallet send flow:
 * form → live quote → review → approve → success
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownTrayIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { TechDetails } from '../ui/tech-details';
import { useAddressBook } from '../../hooks/useAddressBook';
import {
  dogeAddressKindLabel,
  normalizeDogeAddressInput,
  validateDogecoinAddress,
} from '../../lib/dogecoinAddressValidate';
import { friendlyPaymentSendError, clearMempoolOverlayForAddress } from '../../lib/mempoolSpendOverlay';
import {
  estimateMaxSendableDoge,
  estimatePaymentSend,
  type PaymentSendQuote,
} from '../../lib/estimatePaymentSend';
import { getPaymentUtxosForSend } from '../../lib/paymentUtxos';
import { getSpendableBalanceBreakdown, type SpendableBalanceBreakdown } from '../../lib/spendableBalance';
import { dogeTxExplorerUrl } from '../../utils/dogeTxExplorer';
import { useBrowserWallet } from '../../contexts/BrowserWalletContext';

function isLikelyTxid(id: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(id.trim());
}

function Button({
  className,
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} {...props} className={className} />;
}

const INPUT_CLASS = 'wallet-input';
const PRIMARY_BUTTON =
  'rounded-full bg-[#FCD34D] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#f5c84a] disabled:cursor-not-allowed disabled:opacity-50';
const SECONDARY_BUTTON =
  'rounded-full border border-white/15 bg-transparent px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5';

const RECENT_KEY = 'dojakweb-recent-send-recipients';
const MAX_RECENT = 8;

type SendPhase = 'form' | 'review' | 'success';

type RecentRecipient = { address: string; label?: string; at: number };

function loadRecent(): RecentRecipient[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentRecipient[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function pushRecent(address: string, label?: string): void {
  const next: RecentRecipient[] = [
    { address, label, at: Date.now() },
    ...loadRecent().filter((r) => r.address.toLowerCase() !== address.toLowerCase()),
  ].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function formatDoge(n: number, digits = 8): string {
  if (!Number.isFinite(n)) return '—';
  const s = n.toFixed(digits).replace(/\.?0+$/, '');
  return s === '' ? '0' : s;
}

function formatDogeInput(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  return n.toFixed(8).replace(/\.?0+$/, '');
}

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export type WalletSendFlowProps = {
  connected: boolean;
  activeAddress: string | null;
  balance: number;
  sendTransaction: (
    to: string,
    amountDoge: number,
    opts?: { skipApprovalUi?: boolean },
  ) => Promise<string>;
  refreshBalance: () => Promise<void> | void;
  /** Prefill from address book / deep link */
  initialRecipient?: string;
  /** Optional fiat line under amounts */
  formatFiat?: (doge: number) => string | null;
};

export function WalletSendFlow({
  connected,
  activeAddress,
  balance,
  sendTransaction,
  refreshBalance,
  initialRecipient,
  formatFiat,
}: WalletSendFlowProps) {
  const browser = useBrowserWallet();
  const { entries, addEntry, markUsed, updateEntry } = useAddressBook();
  const [phase, setPhase] = useState<SendPhase>('form');
  const [recipient, setRecipient] = useState(() =>
    initialRecipient ? normalizeDogeAddressInput(initialRecipient) : '',
  );
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<PaymentSendQuote | null>(null);
  const [txid, setTxid] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentRecipient[]>(() => loadRecent());
  const [showContacts, setShowContacts] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');
  const [copied, setCopied] = useState(false);
  const [spendableDoge, setSpendableDoge] = useState<number | null>(null);
  const [spendableBusy, setSpendableBusy] = useState(false);
  const [spendBreak, setSpendBreak] = useState<SpendableBalanceBreakdown | null>(null);

  // Keep spendable UTXO total visible (often lower than wallet indexer balance).
  useEffect(() => {
    if (!connected || !activeAddress) {
      setSpendableDoge(null);
      setSpendBreak(null);
      return;
    }
    let cancelled = false;
    setSpendableBusy(true);
    void getSpendableBalanceBreakdown(activeAddress, balance)
      .then((b) => {
        if (cancelled) return;
        setSpendBreak(b);
        setSpendableDoge(b.spendableDoge);
      })
      .catch(async () => {
        if (cancelled) return;
        setSpendBreak(null);
        try {
          const utxos = await getPaymentUtxosForSend(activeAddress);
          if (cancelled) return;
          const koinu = utxos.reduce((s, u) => s + u.value, 0);
          setSpendableDoge(Math.round(koinu) / 1e8);
        } catch {
          if (!cancelled) setSpendableDoge(null);
        }
      })
      .finally(() => {
        if (!cancelled) setSpendableBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [connected, activeAddress, balance, phase, txid]);

  const validation = useMemo(() => validateDogecoinAddress(recipient), [recipient]);

  const bookMatch = useMemo(() => {
    if (!validation.ok) return null;
    return (
      entries.find((e) => e.address.toLowerCase() === validation.address.toLowerCase()) ?? null
    );
  }, [entries, validation]);

  const isSelfSend =
    validation.ok &&
    !!activeAddress &&
    validation.address.toLowerCase() === activeAddress.toLowerCase();

  const amountNum = Number(amount);
  const amountOk = Number.isFinite(amountNum) && amountNum > 0;

  // Debounced live quote on form
  useEffect(() => {
    if (phase !== 'form' || !connected || !activeAddress || !validation.ok || !amountOk) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      setQuoteBusy(true);
      void estimatePaymentSend({
        fromAddress: activeAddress,
        recipientAddress: validation.address,
        amountDoge: amountNum,
      })
        .then((q) => {
          if (!cancelled) {
            setQuote(q);
            setError(null);
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setQuote(null);
            setError(friendlyPaymentSendError(e));
          }
        })
        .finally(() => {
          if (!cancelled) setQuoteBusy(false);
        });
    }, 380);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [phase, connected, activeAddress, validation, amountOk, amountNum]);

  const handleMax = useCallback(async () => {
    if (!connected || !activeAddress) {
      toast.info('Connect your wallet to use Max.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const max = await estimateMaxSendableDoge(activeAddress);
      if (max <= 0) {
        setError('Nothing left to send after network fees.');
        setAmount('');
        return;
      }
      setAmount(formatDogeInput(max));
    } catch (e) {
      setError(friendlyPaymentSendError(e));
    } finally {
      setBusy(false);
    }
  }, [activeAddress, connected]);

  const goReview = useCallback(async () => {
    if (!connected || !activeAddress) {
      setError('Connect a wallet before sending DOGE.');
      return;
    }
    if (!validation.ok) {
      setError(validation.hint ? `${validation.error} ${validation.hint}` : validation.error);
      return;
    }
    if (!amountOk) {
      setError('Enter a valid DOGE amount.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const q = await estimatePaymentSend({
        fromAddress: activeAddress,
        recipientAddress: validation.address,
        amountDoge: amountNum,
      });
      setQuote(q);
      setPhase('review');
    } catch (e) {
      setError(friendlyPaymentSendError(e));
    } finally {
      setBusy(false);
    }
  }, [activeAddress, amountNum, amountOk, connected, validation]);

  const confirmSend = useCallback(async () => {
    if (!quote || !activeAddress) return;
    setBusy(true);
    setStatus('Signing & broadcasting…');
    setError(null);
    try {
      const unlocked = Boolean(browser.wallet?.privateKey);
      const idRaw = await sendTransaction(quote.recipient, quote.amountDoge, {
        // Review screen is the confirmation — don't open a second Approve sheet.
        skipApprovalUi: unlocked,
      });
      const id = String(idRaw || '').trim();
      if (!isLikelyTxid(id)) {
        throw new Error(
          `Send did not return a valid txid (${id || 'empty'}). Treat this as failed — check explorer / try again. Coins may or may not have moved.`,
        );
      }
      setTxid(id);
      setPhase('success');
      pushRecent(quote.recipient, bookMatch?.label);
      setRecent(loadRecent());
      const existing = entries.find(
        (e) => e.address.toLowerCase() === quote.recipient.toLowerCase(),
      );
      if (existing) markUsed(existing.id);

      // Pending spend survives stale indexer polls until chain/index catches up.
      if (
        browser.connected &&
        browser.address &&
        browser.address.toLowerCase() === activeAddress.toLowerCase()
      ) {
        browser.debitLocalBalance(quote.totalDebitDoge, id);
      }
      setSpendableDoge((prev) =>
        prev == null ? prev : Math.max(0, Math.round((prev - quote.totalDebitDoge) * 1e8) / 1e8),
      );

      toast.success(`Sent ${formatDoge(quote.amountDoge)} Ð`, {
        description: `Tx ${id.slice(0, 10)}… · balance updated now (indexer may lag)`,
        duration: 10_000,
      });

      // Delayed polls OK — pending-spend math prevents bouncing back up to the old total.
      void (async () => {
        for (const wait of [2_000, 8_000, 20_000]) {
          await new Promise((r) => setTimeout(r, wait));
          try {
            await refreshBalance();
          } catch {
            /* keep polling */
          }
        }
      })();
    } catch (e) {
      const msg = friendlyPaymentSendError(e);
      setError(msg);
      setPhase('form');
      toast.error('Send failed', { description: msg, duration: 12_000 });
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }, [
    activeAddress,
    bookMatch?.label,
    browser,
    entries,
    markUsed,
    quote,
    refreshBalance,
    sendTransaction,
  ]);

  const resetAll = useCallback(() => {
    setPhase('form');
    setRecipient('');
    setAmount('');
    setQuote(null);
    setTxid(null);
    setError(null);
    setStatus(null);
    setSaveLabel('');
    setShowContacts(false);
  }, []);

  const pickAddress = useCallback((addr: string, label?: string) => {
    setRecipient(normalizeDogeAddressInput(addr));
    setShowContacts(false);
    setError(null);
    if (label) setSaveLabel(label);
  }, []);

  const saveRecipientToBook = useCallback(() => {
    if (!quote) return;
    const label = saveLabel.trim() || `Saved ${quote.recipient.slice(0, 6)}…`;
    const existing = entries.find(
      (e) => e.address.toLowerCase() === quote.recipient.toLowerCase(),
    );
    if (existing) {
      updateEntry(existing.id, { label, lastUsed: new Date() });
      toast.success('Contact updated');
    } else {
      addEntry({ label, address: quote.recipient, lastUsed: new Date() });
      toast.success('Saved to address book');
    }
  }, [addEntry, entries, quote, saveLabel, updateEntry]);

  const copyTxid = useCallback(async () => {
    if (!txid) return;
    try {
      await navigator.clipboard.writeText(txid);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('Copy failed');
    }
  }, [txid]);

  const sortedBook = useMemo(
    () =>
      [...entries].sort((a, b) => {
        if (a.lastUsed && b.lastUsed) return b.lastUsed.getTime() - a.lastUsed.getTime();
        if (a.lastUsed) return -1;
        if (b.lastUsed) return 1;
        return a.label.localeCompare(b.label);
      }),
    [entries],
  );

  if (phase === 'success' && txid && quote) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-4">
          <div className="flex items-center gap-2 text-emerald-300">
            <CheckCircleIcon className="h-5 w-5 shrink-0" />
            <div className="font-semibold">Payment broadcast</div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-emerald-100/80">
            On-chain send succeeded. Wallet total from the indexer can lag 30–120s — we already
            subtracted {formatDoge(quote.totalDebitDoge)} Ð locally (
            {formatDoge(quote.amountDoge)} + {formatDoge(quote.feeDoge)} fee).
          </p>
          <div className="mt-3 space-y-2 text-sm text-white/75">
            <div className="flex justify-between gap-3">
              <span className="text-white/45">Amount</span>
              <span className="font-mono text-white">{formatDoge(quote.amountDoge)} Ð</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-white/45">To</span>
              <span className="max-w-[60%] break-all text-right font-mono text-xs text-white/80">
                {bookMatch?.label ? `${bookMatch.label} · ` : ''}
                {quote.recipient}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-white/45">Txid</span>
              <button
                type="button"
                onClick={() => void copyTxid()}
                className="flex max-w-[70%] items-start gap-1 text-right font-mono text-[11px] text-white/80 hover:text-white"
              >
                <span className="break-all">{txid}</span>
                <ClipboardDocumentIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              </button>
            </div>
            {copied ? <p className="text-[11px] text-emerald-300/90">Copied</p> : null}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0A0A0A] px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-white/70">Save this recipient?</p>
          <input
            className={INPUT_CLASS}
            placeholder="Label (e.g. House treasury)"
            value={saveLabel}
            onChange={(e) => setSaveLabel(e.target.value)}
          />
          <Button type="button" className={cx('w-full', SECONDARY_BUTTON)} onClick={saveRecipientToBook}>
            Save to address book
          </Button>
        </div>

        <a
          href={dogeTxExplorerUrl(txid)}
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-zinc-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
        >
          View on explorer
          <ArrowDownTrayIcon className="h-4 w-4 rotate-[-90deg]" />
        </a>

        <Button type="button" className={cx('w-full', PRIMARY_BUTTON)} onClick={resetAll}>
          Send another
        </Button>
      </div>
    );
  }

  if (phase === 'review' && quote) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-white/70">
          One confirm — we sign & broadcast from your unlocked Local Browser Wallet.
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0A0A0A] px-4 py-4 space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/40">You send</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-white">
              {formatDoge(quote.amountDoge)} Ð
            </p>
            {formatFiat?.(quote.amountDoge) ? (
              <p className="text-xs text-white/45">{formatFiat(quote.amountDoge)}</p>
            ) : null}
          </div>
          <div className="border-t border-white/10 pt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-white/50">To</span>
              <span className="max-w-[65%] break-all text-right font-mono text-xs text-white">
                {bookMatch?.label ? (
                  <span className="mb-0.5 block text-[11px] text-[#FCD34D]/90">{bookMatch.label}</span>
                ) : null}
                {quote.recipient}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-white/50">Network fee</span>
              <span className="font-mono text-white">{formatDoge(quote.feeDoge)} Ð</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-white/50">Change back</span>
              <span className="font-mono text-white/80">{formatDoge(quote.changeDoge)} Ð</span>
            </div>
            <div className="flex justify-between gap-3 border-t border-white/10 pt-2 font-semibold">
              <span className="text-white">Total debit</span>
              <span className="font-mono text-[#FCD34D]">{formatDoge(quote.totalDebitDoge)} Ð</span>
            </div>
          </div>
          {isSelfSend ? (
            <div className="flex gap-2 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
              Sending to your own address — usually only useful for consolidating coins.
            </div>
          ) : null}
          <TechDetails
            summary="Geek details"
            className="text-[10px] text-white/40"
            summaryClassName="text-white/50"
            contentClassName="border-white/15 text-white/45"
          >
            <p>
              {quote.inputCount} input{quote.inputCount === 1 ? '' : 's'} · {quote.outputCount}{' '}
              output{quote.outputCount === 1 ? '' : 's'} · fee rate 1000 koinu/byte · UTXOs from
              wallet data provider (MyDoge) + local mempool overlay
            </p>
          </TechDetails>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="flex gap-2">
          <Button
            type="button"
            className={cx('flex-1', SECONDARY_BUTTON)}
            disabled={busy}
            onClick={() => {
              setPhase('form');
              setError(null);
            }}
          >
            Back
          </Button>
          <Button
            type="button"
            className={cx('flex-1', PRIMARY_BUTTON, busy && 'cursor-wait')}
            disabled={busy}
            aria-busy={busy}
            onClick={() => void confirmSend()}
          >
            {busy ? status ?? 'Sending…' : 'Confirm & send'}
          </Button>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-white/65">
        Send DOGE on Dogecoin mainnet. Addresses are checksum-verified. Spendable coins come from
        wallet data provider (MyDoge) so recently used inputs are not reused.
      </p>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm text-white">Recipient</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#FCD34D] hover:opacity-85"
            onClick={() => setShowContacts((v) => !v)}
          >
            <BookOpenIcon className="h-3.5 w-3.5" />
            {showContacts ? 'Hide contacts' : 'Contacts'}
          </button>
        </div>
        <input
          value={recipient}
          onChange={(e) => {
            setRecipient(normalizeDogeAddressInput(e.target.value));
            setError(null);
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text');
            if (!text) return;
            e.preventDefault();
            setRecipient(normalizeDogeAddressInput(text));
            setError(null);
          }}
          placeholder="D… Dogecoin address"
          className={INPUT_CLASS}
          disabled={busy}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={Boolean(recipient) && !validation.ok}
        />
        {recipient ? (
          validation.ok ? (
            <p className="mt-1.5 text-[11px] text-emerald-300/90">
              Valid {dogeAddressKindLabel(validation.kind)}
              {bookMatch ? ` · ${bookMatch.label}` : ''}
              {isSelfSend ? ' · your wallet' : ''}
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-red-300/90">
              {validation.error}
              {validation.hint ? ` — ${validation.hint}` : ''}
            </p>
          )
        ) : (
          <p className="mt-1.5 text-[11px] text-white/40">
            One wrong character fails the checksum — paste when you can.
          </p>
        )}
      </div>

      {showContacts ? (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-[#0A0A0A] p-2">
          {sortedBook.length === 0 && recent.length === 0 ? (
            <p className="px-2 py-3 text-xs text-white/45">No saved contacts yet.</p>
          ) : null}
          {sortedBook.slice(0, 12).map((e) => (
            <button
              key={e.id}
              type="button"
              className="flex w-full flex-col rounded-lg px-3 py-2 text-left transition hover:bg-white/5"
              onClick={() => pickAddress(e.address, e.label)}
            >
              <span className="text-sm font-medium text-white">{e.label}</span>
              <span className="truncate font-mono text-[10px] text-white/45">{e.address}</span>
            </button>
          ))}
          {recent.length > 0 ? (
            <>
              <p className="px-2 pt-2 text-[10px] uppercase tracking-wide text-white/35">Recent</p>
              {recent.map((r) => (
                <button
                  key={r.address}
                  type="button"
                  className="flex w-full flex-col rounded-lg px-3 py-2 text-left transition hover:bg-white/5"
                  onClick={() => pickAddress(r.address, r.label)}
                >
                  <span className="text-sm text-white/90">{r.label || 'Recent send'}</span>
                  <span className="truncate font-mono text-[10px] text-white/45">{r.address}</span>
                </button>
              ))}
            </>
          ) : null}
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-sm text-white">Amount</span>
          <button
            type="button"
            onClick={() => void handleMax()}
            className="text-sm font-medium text-[#FCD34D] hover:opacity-85 disabled:opacity-40"
            disabled={busy || !connected}
          >
            Max
          </button>
        </div>
        <input
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value.replace(/[^0-9.]/g, ''));
            setError(null);
          }}
          className={INPUT_CLASS}
          disabled={busy}
          inputMode="decimal"
          placeholder="0.0"
        />
        <p className="mt-1.5 space-y-0.5 text-[11px] text-white/45">
          <span className="block">
            Wallet total ≈ {formatDoge(balance, 4)} Ð
            {formatFiat?.(balance) ? ` · ${formatFiat(balance)}` : ''}
          </span>
          <span className="block text-white/70">
            {spendableBusy
              ? 'Checking spendable UTXOs…'
              : spendableDoge != null
                ? `Spendable now ≈ ${formatDoge(spendableDoge, 4)} Ð`
                : 'Spendable UTXOs unavailable — try Max after a moment'}
          </span>
          {spendBreak && spendBreak.unavailableDoge > 0.05 ? (
            <span className="block text-white/40">
              {formatDoge(spendBreak.unavailableDoge, 2)} Ð locked
              {spendBreak.duneBearingDoge > 0.05
                ? ` · ${formatDoge(spendBreak.duneBearingDoge, 2)} Ð in Ðune outs`
                : ''}
              {spendBreak.localHoldDoge > 0.001
                ? ` · ${formatDoge(spendBreak.localHoldDoge, 2)} Ð held from a recent broadcast (may still be in mempool)`
                : ''}
              {spendBreak.dustCarrierCount > 0
                ? ` · ${spendBreak.dustCarrierCount}× 0.001 Ð inscription carrier${spendBreak.dustCarrierCount === 1 ? '' : 's'}`
                : ''}
              {spendBreak.lockedCount > 0 ? ` · ${spendBreak.lockedCount} manually locked` : ''}
              . Open ··· → Coins & UTXOs to inspect
              {spendBreak.localHoldCount > 0 ? ' or release local holds' : ''}.
            </span>
          ) : null}
          {spendBreak && spendBreak.localHoldCount > 0 && activeAddress ? (
            <button
              type="button"
              className="mt-1 text-[11px] font-medium text-[#FCD34D] hover:opacity-85"
              onClick={() => {
                clearMempoolOverlayForAddress(activeAddress);
                toast.success('Released local spend holds — rechecking…');
                setSpendableBusy(true);
                void getSpendableBalanceBreakdown(activeAddress, balance)
                  .then((b) => {
                    setSpendBreak(b);
                    setSpendableDoge(b.spendableDoge);
                  })
                  .finally(() => setSpendableBusy(false));
              }}
            >
              Release local holds ({spendBreak.localHoldCount})
            </button>
          ) : null}
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0A0A0A] px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-white/80">Network fee</span>
          {quoteBusy ? (
            <span className="text-xs text-white/40">Estimating…</span>
          ) : quote ? (
            <span className="font-mono text-sm text-white">{formatDoge(quote.feeDoge)} Ð</span>
          ) : (
            <span className="text-xs text-white/40">Enter recipient & amount</span>
          )}
        </div>
        {quote ? (
          <div className="space-y-1.5 text-xs text-white/55">
            <div className="flex justify-between">
              <span>You send</span>
              <span className="font-mono text-white/80">{formatDoge(quote.amountDoge)} Ð</span>
            </div>
            <div className="flex justify-between font-medium text-white/80">
              <span>Total debit</span>
              <span className="font-mono">{formatDoge(quote.totalDebitDoge)} Ð</span>
            </div>
            <div className="flex justify-between">
              <span>Change returned</span>
              <span className="font-mono">{formatDoge(quote.changeDoge)} Ð</span>
            </div>
          </div>
        ) : (
          <p className="text-[11px] leading-relaxed text-white/40">
            Fee is calculated from your real UTXOs before you approve — not a guess.
          </p>
        )}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <Button
        type="button"
        className={cx('w-full', PRIMARY_BUTTON, (busy || quoteBusy) && 'cursor-wait')}
        disabled={busy || !validation.ok || !amountOk}
        onClick={() => void goReview()}
      >
        {busy ? 'Preparing…' : 'Review send'}
      </Button>
    </div>
  );
}
