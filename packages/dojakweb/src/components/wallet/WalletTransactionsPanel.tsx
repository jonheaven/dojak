'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { ArrowDownTrayIcon, ArrowPathIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { useDojakwebI18n } from '../../contexts/DojakwebLocaleContext';
import { walletDataApi, type DogeTransaction } from '../../utils/api';
import {
  dogeTxExplorerDisplayName,
  dogeTxExplorerUrl,
  useDogeTxExplorerPreference,
} from '../../utils/dogeTxExplorer';
import {
  loadWalletTxJournal,
  mergeWalletTxJournalIntoList,
  subscribeWalletTxJournal,
  upsertWalletTxJournalEntry,
  walletTxDisplayChips,
  type DojakwebWalletTxEntry,
  type WalletTxListRow,
} from '../../lib/wallet-tx-journal';
import {
  enrichWalletTransactionsForAddress,
  inscriptionFaceFromWalletTx,
} from '../../lib/wallet-tx-enrichment';
import { WalletTxInscriptionPreview } from './WalletTxInscriptionPreview';

const cx = clsx;

export type WalletTransactionList = {
  rows: WalletTxListRow[];
  loading: boolean;
  error: string | null;
  pendingCount: number;
  hasMore: boolean;
  /** False until the first history request for this address finishes. */
  settled: boolean;
  refresh: () => void;
  loadMore: () => void;
};

function compactTxTimeAgo(timestamp: string): string {
  if (!timestamp) return '';
  const iso = timestamp.includes('T') ? timestamp : `${timestamp.replace(' ', 'T')}Z`;
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '';
  const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (sec < 60) return 'now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}d`;
  return `${Math.floor(sec / 86400 / 7)}w`;
}

function formatCompactTxAmount(label: string): { value: string; ticker?: string } {
  const trimmed = label.trim();
  const m = trimmed.match(/^([+\-]?\d+(?:\.\d+)?)\s*(.*)$/);
  if (!m) return { value: trimmed };
  const sign = m[1].startsWith('+') ? '+' : m[1].startsWith('-') ? '-' : '';
  const n = Number(m[1]);
  const ticker = m[2]?.replace(/•/g, '').trim();
  const abs = Math.abs(n);
  let absStr: string;
  if (!Number.isFinite(n)) absStr = m[1].replace(/^[+\-]/, '');
  else if (abs >= 1_000_000) absStr = `${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  else if (abs >= 10_000) absStr = `${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  else if (n % 1 === 0) absStr = abs.toLocaleString(undefined, { maximumFractionDigits: 0 });
  else absStr = abs.toLocaleString(undefined, { maximumFractionDigits: abs < 0.01 ? 6 : 3 });
  const shortTicker = ticker ? (ticker.length > 8 ? `${ticker.slice(0, 7)}…` : ticker) : undefined;
  return { value: `${sign}${absStr}`, ticker: shortTicker };
}

function dogeAmount(n: number): string {
  if (n % 1 === 0) return n.toLocaleString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

/**
 * Same history the hot-wallet Transactions tab uses: provider pages, the local
 * broadcast journal, and protocol enrichment (DNS, tokens, sales, …).
 */
export function useWalletTransactionList(opts: {
  address?: string | null;
  enabled?: boolean;
  reloadToken?: number;
  localTransactions?: WalletTxListRow[];
}): WalletTransactionList {
  const { t } = useDojakwebI18n();
  const address = opts.address?.trim() || '';
  const enabled = opts.enabled ?? true;
  const reloadToken = opts.reloadToken ?? 0;
  const localTransactions = opts.localTransactions;

  const [chain, setChain] = useState<DogeTransaction[]>([]);
  const [journal, setJournal] = useState<DojakwebWalletTxEntry[]>(() =>
    typeof window !== 'undefined' ? loadWalletTxJournal() : [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [settled, setSettled] = useState(false);
  const req = useRef(0);

  useEffect(() => {
    setJournal(loadWalletTxJournal());
    return subscribeWalletTxJournal(() => setJournal(loadWalletTxJournal()));
  }, []);

  const load = useCallback(
    async (addr: string, nextPage: number, append: boolean) => {
      const id = ++req.current;
      setLoading(true);
      if (!append) setError(null);
      try {
        const result = await walletDataApi.fetchTransactions(addr, nextPage);
        if (id !== req.current) return;
        setChain((prev) => (append ? [...prev, ...result.transactions] : result.transactions));
        setTotal(result.total);
        setPage(nextPage);
        setSettled(true);
      } catch {
        if (id !== req.current) return;
        setSettled(true);
        setError(t('modal.tx.error'));
      } finally {
        if (id === req.current) setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    setChain([]);
    setTotal(0);
    setPage(1);
    setError(null);
    setSettled(false);
  }, [address]);

  useEffect(() => {
    if (!enabled) return;
    if (!address) {
      setSettled(true);
      return;
    }
    void load(address, 1, false);
  }, [enabled, address, reloadToken, load]);

  useEffect(() => {
    for (const tx of chain) {
      const txid = tx.txid?.trim().toLowerCase();
      if (!txid) continue;
      const entry = journal.find((row) => row.txid === txid);
      if (!entry) continue;
      if (tx.confirmations > 0 && (entry.status === 'broadcasted' || entry.status === 'seen')) {
        upsertWalletTxJournalEntry({
          txid,
          address: entry.address,
          protocol: entry.protocol,
          action: entry.action,
          title: entry.title,
          summary: entry.summary,
          status: 'confirmed',
          originHost: entry.originHost,
          originPath: entry.originPath,
          originLabel: entry.originLabel,
          metadata: entry.metadata,
        });
      } else if (!tx.pending && entry.status === 'broadcasted') {
        upsertWalletTxJournalEntry({
          txid,
          address: entry.address,
          protocol: entry.protocol,
          action: entry.action,
          title: entry.title,
          summary: entry.summary,
          status: 'seen',
          originHost: entry.originHost,
          originPath: entry.originPath,
          originLabel: entry.originLabel,
          metadata: entry.metadata,
        });
      }
    }
  }, [chain, journal]);

  const rows = useMemo(() => {
    const seen = new Set<string>();
    const localFirst: WalletTxListRow[] = [];
    for (const tx of localTransactions ?? []) {
      if (address && tx.walletAddress && tx.walletAddress !== address) continue;
      const id = tx.txid?.trim().toLowerCase();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      localFirst.push(tx);
    }
    for (const tx of chain) {
      const id = tx.txid?.trim().toLowerCase();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      localFirst.push(tx);
    }
    return mergeWalletTxJournalIntoList(localFirst, journal, { address });
  }, [localTransactions, chain, journal, address]);

  const txidKey = useMemo(
    () =>
      rows
        .map((row) => row.txid)
        .filter(Boolean)
        .join(','),
    [rows],
  );

  useEffect(() => {
    if (!enabled || !address || !txidKey) return;
    let cancelled = false;
    void enrichWalletTransactionsForAddress(address, txidKey.split(','))
      .then(() => {
        if (!cancelled) setJournal(loadWalletTxJournal());
      })
      .catch((err) => {
        console.warn('[dojakweb:tx] protocol enrichment failed', err);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, address, txidKey]);

  const pendingCount = useMemo(() => rows.filter((tx) => tx.pending).length, [rows]);

  useEffect(() => {
    if (!enabled || !address || pendingCount <= 0) return;
    const id = window.setInterval(() => {
      void load(address, 1, false);
    }, 12_000);
    return () => window.clearInterval(id);
  }, [enabled, address, pendingCount, load]);

  const refresh = useCallback(() => {
    if (address) void load(address, 1, false);
  }, [address, load]);

  const loadMore = useCallback(() => {
    if (!address || loading) return;
    void load(address, page + 1, true);
  }, [address, load, loading, page]);

  return {
    rows,
    loading,
    error,
    pendingCount,
    hasMore: chain.length < total,
    settled,
    refresh,
    loadMore,
  };
}

function TxDetail({
  tx,
  isDark,
  page,
  onClose,
}: {
  tx: WalletTxListRow;
  isDark: boolean;
  page: boolean;
  onClose: () => void;
}) {
  const { t } = useDojakwebI18n();
  const explorer = useDogeTxExplorerPreference();
  const chips = walletTxDisplayChips(tx);
  const face = inscriptionFaceFromWalletTx(tx);
  const ink = page ? 'text-text' : isDark ? 'text-white' : 'text-zinc-900';
  const mute = page ? 'text-muted' : isDark ? 'text-white/45' : 'text-zinc-500';
  const card = page
    ? 'border-border bg-surface text-text'
    : isDark
      ? 'border-white/10 bg-[#0A0A0A] text-white'
      : 'border-zinc-200 bg-white text-zinc-900';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className={cx('relative w-full max-w-md rounded-2xl border p-6 text-center shadow-2xl', card)}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className={cx('absolute right-4 top-4 text-lg leading-none', mute)}
          aria-label="Close"
        >
          ×
        </button>
        <div className={cx('mb-3 text-[11px] font-bold uppercase tracking-widest', mute)}>
          {tx.protocol === 'doginals' && tx.title
            ? tx.title
            : tx.title || (tx.type === 'sent' ? t('modal.tx.to') : t('modal.tx.from'))}
        </div>
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
          {chips.protocolLabel ? (
            <span className={cx('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', page ? 'bg-accent/15 text-accent' : 'bg-amber-400/15 text-amber-200')}>
              {chips.protocolLabel}
            </span>
          ) : null}
          {chips.actionLabel ? (
            <span className="rounded-full bg-fuchsia-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-fuchsia-200">
              {chips.actionLabel}
            </span>
          ) : null}
          {chips.originLabel ? (
            <span className="rounded-full bg-sky-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-sky-200">
              {chips.originLabel}
            </span>
          ) : null}
        </div>
        <div className={cx('mb-3 text-xs font-medium', tx.pending ? 'text-amber-400' : 'text-emerald-400')}>
          {tx.pending
            ? 'Mempool'
            : tx.journal?.status === 'indexed'
              ? 'Indexed'
              : tx.confirmations > 0
                ? `Confirmed · ${tx.confirmations}`
                : 'Seen'}
        </div>
        {tx.summary && tx.protocol !== 'dunes' && tx.protocol !== 'marketplace' ? (
          <p className={cx('mb-3 text-xs leading-relaxed', mute)}>{tx.summary}</p>
        ) : null}
        {face ? (
          <div className="mx-auto mb-4 w-40">
            <WalletTxInscriptionPreview face={face} />
          </div>
        ) : (
          <div className={cx('mb-2 font-mono text-sm font-semibold', ink)}>
            {tx.address ? `${tx.address.slice(0, 10)}…${tx.address.slice(-4)}` : tx.localOnly ? 'Local journal' : '—'}
          </div>
        )}
        <div className={cx('my-4 text-3xl font-bold', ink)}>
          {tx.protocol === 'dunes' && (tx.tokenAmountLabel || tx.summary) ? (
            <div className="space-y-1">
              <div className="text-2xl">{tx.tokenAmountLabel || tx.summary}</div>
              {tx.amount > 0 ? (
                <div className="text-base text-[#FCD34D]">Ð{dogeAmount(tx.amount)}</div>
              ) : null}
            </div>
          ) : tx.protocol === 'marketplace' ? (
            <div className="space-y-1 text-lg">{tx.summary || tx.title || 'NFT sale'}</div>
          ) : (
            <>Ð{dogeAmount(tx.amount)}</>
          )}
        </div>
        <div className={cx('mt-2 divide-y rounded-xl border text-left text-sm', page ? 'divide-border border-border' : isDark ? 'divide-white/10 border-white/10' : 'divide-zinc-100 border-zinc-200')}>
          <div className="flex items-center justify-between gap-3 px-4 py-2">
            <span className={mute}>TXID</span>
            <span className={cx('truncate font-mono text-[11px] font-semibold', ink)}>
              {tx.txid ? `${tx.txid.slice(0, 10)}…${tx.txid.slice(-8)}` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-2">
            <span className={mute}>{t('modal.tx.confirmations')}</span>
            <span className={cx('font-semibold', ink)}>{tx.confirmations}</span>
          </div>
          {tx.timestamp ? (
            <div className="flex items-center justify-between px-4 py-2">
              <span className={mute}>{t('modal.tx.timestamp')}</span>
              <span className={cx('font-semibold', ink)}>{tx.timestamp}</span>
            </div>
          ) : null}
        </div>
        {tx.txid ? (
          <a
            href={dogeTxExplorerUrl(tx.txid, explorer)}
            target="_blank"
            rel="noopener noreferrer"
            className={cx(
              'mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold',
              page ? 'bg-text text-surface' : isDark ? 'bg-white text-zinc-900' : 'bg-zinc-800 text-white',
            )}
          >
            {t('modal.tx.viewOnExplorer', { name: dogeTxExplorerDisplayName(explorer) })}
            <ArrowDownTrayIcon className="h-4 w-4 -rotate-90" />
          </a>
        ) : null}
        {tx.txid ? (
          <button
            type="button"
            className={cx('mt-2 inline-flex items-center gap-1 text-xs', mute)}
            onClick={() => {
              void navigator.clipboard.writeText(tx.txid);
            }}
          >
            <ClipboardDocumentIcon className="h-3.5 w-3.5" />
            Copy txid
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export function WalletTransactionsPanel({
  address,
  enabled = true,
  reloadToken = 0,
  localTransactions,
  list,
  isDark = true,
  surface = 'page',
  className,
}: {
  address?: string | null;
  enabled?: boolean;
  reloadToken?: number;
  localTransactions?: WalletTxListRow[];
  list?: WalletTransactionList;
  isDark?: boolean;
  surface?: 'modal' | 'page';
  className?: string;
}) {
  const { t } = useDojakwebI18n();
  const internal = useWalletTransactionList({
    address: list ? null : address,
    enabled: list ? false : enabled,
    reloadToken: list ? 0 : reloadToken,
    localTransactions: list ? undefined : localTransactions,
  });
  const data = list ?? internal;
  const page = surface === 'page';
  const [selected, setSelected] = useState<WalletTxListRow | null>(null);
  const detail = selected
    ? data.rows.find((row) => row.txid === selected.txid) ?? selected
    : null;

  const ink = page ? 'text-text' : isDark ? 'text-white' : 'text-zinc-900';
  const mute = page ? 'text-muted' : isDark ? 'text-white/45' : 'text-zinc-500';
  const divide = page ? 'divide-border' : isDark ? 'divide-zinc-800' : 'divide-zinc-200';

  return (
    <div className={className}>
      <div className={cx('flex items-center justify-end border-b px-3 py-2', page ? 'border-border' : 'border-white/[0.06]')}>
        <button
          type="button"
          onClick={() => data.refresh()}
          className={cx('rounded-lg p-1.5 transition', mute)}
          aria-label={t('modal.aria.refreshTransactions')}
          title={t('modal.aria.refreshTransactions')}
        >
          <ArrowPathIcon className={cx('h-4 w-4', data.loading && 'animate-spin')} />
        </button>
      </div>
      {detail ? (
        <TxDetail tx={detail} isDark={isDark} page={page} onClose={() => setSelected(null)} />
      ) : null}
      {data.error ? (
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
          <div className="text-sm text-red-400">{data.error}</div>
          <button type="button" onClick={() => data.refresh()} className="text-xs text-amber-400 underline">
            {t('modal.tx.retry')}
          </button>
        </div>
      ) : data.rows.length === 0 && (data.loading || !data.settled) ? (
        <div className={cx('px-4 py-8 text-center text-sm', mute)}>{t('modal.tx.loading')}</div>
      ) : data.rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <div className={cx('text-sm font-semibold', ink)}>{t('modal.tx.emptyTitle')}</div>
          <div className={cx('text-xs', mute)}>{t('modal.tx.emptyHint')}</div>
        </div>
      ) : (
        <div>
          <div className={cx('divide-y', divide)}>
            {data.rows.map((tx, i) => {
              const timeAgo = compactTxTimeAgo(tx.timestamp);
              const rawPrimary =
                tx.title ||
                (tx.address
                  ? `${tx.address.slice(0, 8)}…${tx.address.slice(-4)}`
                  : tx.txid
                    ? `${tx.txid.slice(0, 8)}…`
                    : '—');
              const primary = String(rawPrimary).replace(/^Ðune\s*[·•.-]\s*/i, '');
              const initials =
                tx.protocol === 'dunes'
                  ? 'ÐU'
                  : (tx.protocolLabel || tx.address || 'TX').slice(0, 2).toUpperCase();
              const chips = walletTxDisplayChips(tx);
              const inscriptionFace = inscriptionFaceFromWalletTx(tx);
              const statusText = tx.pending
                ? 'Mempool'
                : tx.journal?.status === 'indexed'
                  ? 'Indexed'
                  : 'Confirmed';
              const amountRaw = tx.tokenAmountLabel
                ? tx.tokenAmountLabel
                : inscriptionFace?.postageDoge != null
                  ? `${tx.type === 'received' ? '+' : '-'}${inscriptionFace.postageDoge} DOGE`
                  : tx.protocol === 'dunes'
                    ? 'Ðune'
                    : `${tx.type === 'received' ? '+' : '-'}${tx.amount % 1 === 0 ? tx.amount : tx.amount.toFixed(tx.amount < 0.01 ? 8 : 3)}`;
              const amount = formatCompactTxAmount(amountRaw);
              const metaBits = [chips.protocolLabel, chips.actionLabel, statusText, timeAgo].filter(Boolean);
              return (
                <button
                  key={`${tx.txid}-${i}`}
                  type="button"
                  onClick={() => setSelected(tx)}
                  className={cx(
                    'flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition',
                    page ? 'hover:bg-surface-2/80' : isDark ? 'hover:bg-white/5' : 'bg-zinc-50 hover:bg-white',
                    tx.pending && (page ? 'bg-amber-500/10' : isDark ? 'bg-amber-500/5' : 'bg-amber-50'),
                  )}
                >
                  {inscriptionFace ? (
                    <div className={cx(tx.pending && 'rounded-lg ring-2 ring-amber-400 animate-pulse')}>
                      <WalletTxInscriptionPreview face={inscriptionFace} compact />
                    </div>
                  ) : (
                    <div
                      className={cx(
                        'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C9A84C] text-[10px] font-bold text-[#161109]',
                        tx.pending && 'ring-2 ring-amber-400 animate-pulse',
                      )}
                    >
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className={cx('truncate text-[13px] font-semibold leading-tight', ink)}>{primary}</div>
                    <div className={cx('mt-0.5 truncate text-[10px] leading-tight', mute)}>
                      {chips.protocolLabel ? (
                        <span className={page ? 'text-accent' : isDark ? 'text-[#C9A84C]' : 'text-[#7A5410]'}>
                          {chips.protocolLabel}
                        </span>
                      ) : null}
                      {metaBits.slice(chips.protocolLabel ? 1 : 0).map((bit, idx) => (
                        <span
                          key={`${bit}-${idx}`}
                          className={bit === 'Mempool' ? 'animate-pulse text-amber-400' : undefined}
                        >
                          {chips.protocolLabel || idx > 0 ? ' · ' : null}
                          {bit}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div
                    className={cx(
                      'min-w-[4.25rem] max-w-[6.5rem] shrink-0 text-right leading-tight',
                      tx.type === 'received' ? (page ? 'text-success' : 'text-emerald-400') : ink,
                    )}
                  >
                    <div className="truncate text-[13px] font-semibold tabular-nums">{amount.value}</div>
                    {amount.ticker ? (
                      <div className={cx('truncate text-[9px] font-medium uppercase tracking-wide', mute)}>
                        {amount.ticker}
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
          {data.hasMore ? (
            <div className={cx('border-t px-4 py-3', page ? 'border-border' : isDark ? 'border-zinc-800' : 'border-zinc-200')}>
              <button
                type="button"
                disabled={data.loading}
                onClick={() => data.loadMore()}
                className="w-full text-center text-xs text-amber-400 disabled:opacity-50"
              >
                {data.loading ? t('modal.tx.loading') : t('modal.tx.loadMore')}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
