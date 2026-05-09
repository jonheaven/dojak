/**
 * UtxoManagement.tsx
 *
 * Full UTXO manager for the dojakweb browser wallet.
 *
 * Features:
 *   - Fetch ALL UTXOs (plain + inscribed) via wonky-ord
 *   - Auto-lock inscription UTXOs on load
 *   - Per-UTXO and batch lock / unlock (persisted in localStorage)
 *   - Fragmentation warning + merge (N plain UTXOs → 1)
 *   - Split (1 UTXO → N equal or custom amounts)
 *   - Signed client-side with browser wallet private key (no extension needed)
 *   - Broadcast via RPC → Blockchair → BlockCypher
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  CubeIcon,
  BanknotesIcon,
  LockClosedIcon,
  LockOpenIcon,
  ArrowDownIcon,
  ScissorsIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  BarsArrowDownIcon,
  BarsArrowUpIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { useBrowserWallet } from '../../contexts/BrowserWalletContext';
import {
  ManagedUtxo,
  fetchAllAddressUtxosWithMeta,
  loadLockedUtxos,
  saveLockedUtxos,
  autoLockInscriptionUtxos,
  buildAndSignMergeTx,
  buildAndSignSplitTx,
  broadcastUtxoTx,
  assertUtxosCurrentlyUnspent,
  estimateMergeFee,
  estimateSplitFee,
  calcEqualSplitOutputs,
  DUST_LIMIT,
  type UtxoListSource,
} from '../../lib/utxo-tools';
import { DogeAmount } from '../DogeAmount';
import { DogeCurrencyIcon } from '../DogeCurrencyIcon';
import { useDojakwebI18n } from '../../contexts/DojakwebLocaleContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MergeEstimate {
  feeSatoshis: number;
  inputCount: number;
  totalInputSatoshis: number;
  changeToWallet: number;
}

interface SplitEstimate {
  feeSatoshis: number;
  outputs: number[];
  totalInputSatoshis: number;
}

export interface UtxoManagementProps {
  walletAddress: string;
  /** When false, the managing-address strip is hidden (e.g. UtxoManagerPage shows it in the page header). Default true. */
  showAddressBanner?: boolean;
  /** Called when user selects UTXOs for tool workflows. */
  onSelectUtxos?: (utxos: ManagedUtxo[]) => void;
  /** Fired after a successful UTXO list fetch (RPC vs Blockchair). */
  onFetchMeta?: (meta: { source: UtxoListSource }) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (sats: number) => (sats / 1e8).toFixed(4);
const fmtFull = (sats: number) => (sats / 1e8).toFixed(8);

function confColor(c: number) {
  if (c >= 6) return 'text-emerald-400';
  if (c >= 1) return 'text-yellow-400';
  return 'text-red-400';
}

// ── Component ─────────────────────────────────────────────────────────────────

export const UtxoManagement: React.FC<UtxoManagementProps> = ({
  walletAddress,
  showAddressBanner = true,
  onSelectUtxos,
  onFetchMeta,
}) => {
  const { t } = useDojakwebI18n();
  const browser = useBrowserWallet();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [utxos, setUtxos] = useState<ManagedUtxo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Selection / filter ────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'inscribed' | 'plain' | 'locked'>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'amount' | 'txid'>('amount');
  const [sortAsc, setSortAsc] = useState(false);

  // ── Merge modal ────────────────────────────────────────────────────────────
  const [showMerge, setShowMerge] = useState(false);
  const [mergeEst, setMergeEst] = useState<MergeEstimate | null>(null);
  const [merging, setMerging] = useState(false);

  // ── Split modal ────────────────────────────────────────────────────────────
  const [showSplit, setShowSplit] = useState(false);
  const [splitUtxo, setSplitUtxo] = useState<ManagedUtxo | null>(null);
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [splitCount, setSplitCount] = useState(2);
  const [customAmounts, setCustomAmounts] = useState<string[]>(['', '']);
  const [splitEst, setSplitEst] = useState<SplitEstimate | null>(null);
  const [splitting, setSplitting] = useState(false);
  const [splitTxid, setSplitTxid] = useState<string | null>(null);
  const [mergeTxid, setMergeTxid] = useState<string | null>(null);
  const [listSource, setListSource] = useState<UtxoListSource | null>(null);

  useEffect(() => {
    setListSource(null);
  }, [walletAddress]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchUtxos = async (quiet = false) => {
    setIsLoading(true);
    try {
      const { utxos: data, source } = await fetchAllAddressUtxosWithMeta(walletAddress);
      setListSource(source);
      onFetchMeta?.({ source });
      // Auto-lock inscription UTXOs silently on first load
      const newlyLocked = autoLockInscriptionUtxos(walletAddress, data);
      if (newlyLocked > 0 && !quiet) {
        toast.success(
          newlyLocked === 1
            ? t('utxo.toast.autoLockedOne')
            : t('utxo.toast.autoLockedMany', { count: String(newlyLocked) }),
        );
      }
      // Re-apply lock state (autoLock updated localStorage, re-read)
      const lockedSet = loadLockedUtxos(walletAddress);
      setUtxos(data.map(u => ({ ...u, locked: lockedSet.has(`${u.txid}:${u.vout}`) })));
      if (!quiet) {
        toast.success(
          data.length === 1 ? t('utxo.toast.loadedOne') : t('utxo.toast.loadedMany', { count: String(data.length) }),
        );
      }
    } catch (e: any) {
      console.error('[UtxoManagement] fetch failed', e);
      toast.error(e?.message ?? t('utxo.toast.loadFail'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (walletAddress) fetchUtxos(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  // ── Filtered / sorted view ─────────────────────────────────────────────────
  const visible = useMemo(() => {
    let list = [...utxos];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u => u.txid.toLowerCase().includes(q));
    }
    switch (filter) {
      case 'inscribed': list = list.filter(u => u.inscriptions.length > 0); break;
      case 'plain':     list = list.filter(u => u.inscriptions.length === 0); break;
      case 'locked':    list = list.filter(u => u.locked); break;
    }
    list.sort((a, b) => {
      const av = sortBy === 'amount' ? a.value : a.txid;
      const bv = sortBy === 'amount' ? b.value : b.txid;
      return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return list;
  }, [utxos, filter, search, sortBy, sortAsc]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const totalSat = utxos.reduce((s, u) => s + u.value, 0);
    const hasConf = utxos.some(u => u.confirmations !== undefined);

    /** Matches typical wallet apps: ≥1 conf and spendable in Core (not watch-only). */
    const walletLikeSat = utxos.reduce((s, u) => {
      if (!hasConf) return s + u.value;
      if (u.rpcSpendable === false) return s;
      if ((u.confirmations ?? 0) < 1) return s;
      return s + u.value;
    }, 0);

    const pendingSat = hasConf
      ? utxos
        .filter(u => u.rpcSpendable !== false && u.confirmations === 0)
        .reduce((s, u) => s + u.value, 0)
      : 0;

    const watchOnlySat = hasConf
      ? utxos.filter(u => u.rpcSpendable === false).reduce((s, u) => s + u.value, 0)
      : 0;

    return {
      totalDoge: totalSat / 1e8,
      /** Shown as the main DOGE figure when Core provides confirmations (matches MyDoge-style balance). */
      balanceDoge: (hasConf ? walletLikeSat : totalSat) / 1e8,
      pendingDoge: pendingSat / 1e8,
      watchOnlyDoge: watchOnlySat / 1e8,
      hasConfirmationData: hasConf,
      total: utxos.length,
      inscribed: utxos.filter(u => u.inscriptions.length > 0).length,
      plain: utxos.filter(u => u.inscriptions.length === 0).length,
      locked: utxos.filter(u => u.locked).length,
      spendable: utxos.filter(
        u => !u.locked && u.inscriptions.length === 0 && u.rpcSpendable !== false,
      ).length,
    };
  }, [utxos]);

  // ── Lock helpers ───────────────────────────────────────────────────────────
  const toggleOneLock = (u: ManagedUtxo) => {
    const key = `${u.txid}:${u.vout}`;
    const locked = loadLockedUtxos(walletAddress);
    const nowLocked = !locked.has(key);
    if (nowLocked) locked.add(key); else locked.delete(key);
    saveLockedUtxos(walletAddress, locked);
    setUtxos(prev => prev.map(x =>
      x.txid === u.txid && x.vout === u.vout ? { ...x, locked: nowLocked } : x,
    ));
    toast.success(nowLocked ? t('utxo.toast.lockToggle') : t('utxo.toast.unlockToggle'));
  };

  const batchLock = (lock: boolean) => {
    const locked = loadLockedUtxos(walletAddress);
    visible.forEach(u => {
      if (!selected.has(`${u.txid}:${u.vout}`)) return;
      const key = `${u.txid}:${u.vout}`;
      if (lock) locked.add(key); else locked.delete(key);
    });
    saveLockedUtxos(walletAddress, locked);
    setUtxos(prev => prev.map(u => {
      if (!selected.has(`${u.txid}:${u.vout}`)) return u;
      return { ...u, locked: lock };
    }));
    const action = lock ? t('utxo.toast.lockedWord') : t('utxo.toast.unlockedWord');
    toast.success(
      selected.size === 1
        ? t('utxo.toast.bulkLock', { action, count: String(selected.size) })
        : t('utxo.toast.bulkLockPlural', { action, count: String(selected.size) }),
    );
    setSelected(new Set());
  };

  const handleAutoLock = () => {
    const count = autoLockInscriptionUtxos(walletAddress, utxos);
    if (count === 0) {
      toast.success(t('utxo.toast.allLocked'));
      return;
    }
    const locked = loadLockedUtxos(walletAddress);
    setUtxos(prev => prev.map(u => ({
      ...u,
      locked: locked.has(`${u.txid}:${u.vout}`),
    })));
    toast.success(
      count === 1 ? t('utxo.toast.lockInscriptionsOne') : t('utxo.toast.lockInscriptionsMany', { count: String(count) }),
    );
  };

  // ── Plain-selected helpers ─────────────────────────────────────────────────
  const getPlainSelected = (): ManagedUtxo[] =>
    utxos.filter(u =>
      selected.has(`${u.txid}:${u.vout}`) &&
      u.inscriptions.length === 0 &&
      !u.locked,
    );

  // ── Merge flow ─────────────────────────────────────────────────────────────
  const openMerge = () => {
    const plain = getPlainSelected();
    if (plain.length < 2) {
      toast.error(t('utxo.toast.mergeSelectTwo'));
      return;
    }
    const totalInput = plain.reduce((s, u) => s + u.value, 0);
    const fee = estimateMergeFee(plain.length);
    const change = totalInput - fee;
    if (change <= 0) {
      toast.error(t('utxo.toast.insufficientFunds'));
      return;
    }
    setMergeEst({ feeSatoshis: fee, inputCount: plain.length, totalInputSatoshis: totalInput, changeToWallet: change });
    setShowMerge(true);
  };

  const executeMerge = async () => {
    if (!mergeEst) return;
    const plain = getPlainSelected();
    if (!browser.wallet?.privateKey) {
      toast.error(t('utxo.toast.walletLockedPanel'));
      return;
    }
    setMerging(true);
    try {
      await assertUtxosCurrentlyUnspent(plain.map((u) => ({ txid: u.txid, vout: u.vout })));
      const { rawHex } = await buildAndSignMergeTx(plain, walletAddress, browser.wallet.privateKey);
      const txid = await broadcastUtxoTx(rawHex);
      setMergeTxid(txid);
      setSelected(new Set());
      // Refresh after 15 s — gives time for the tx to propagate and be picked up
      setTimeout(() => fetchUtxos(true), 15000);
    } catch (e: any) {
      toast.error(e?.message ?? t('utxo.toast.mergeFail'));
    } finally {
      setMerging(false);
    }
  };

  // ── Split flow ─────────────────────────────────────────────────────────────
  const openSplit = (u: ManagedUtxo) => {
    if (u.inscriptions.length > 0) {
      toast.error(t('utxo.toast.cannotSplitInscribed'));
      return;
    }
    if (u.locked) {
      toast.error(t('utxo.toast.unlockFirst'));
      return;
    }
    setSplitUtxo(u);
    setSplitMode('equal');
    setSplitCount(2);
    setCustomAmounts(['', '']);
    setSplitEst(null);
    setShowSplit(true);
  };

  const calcSplitEst = () => {
    if (!splitUtxo) return;
    try {
      let outputs: number[];
      if (splitMode === 'equal') {
        outputs = calcEqualSplitOutputs(splitUtxo, splitCount);
      } else {
        outputs = customAmounts.map(v => Math.round(parseFloat(v || '0') * 1e8));
        if (outputs.some((v: number) => !Number.isFinite(v) || v < DUST_LIMIT)) {
          toast.error(t('utxo.toast.dustMinimum', { doge: (DUST_LIMIT / 1e8).toFixed(3) }));
          return;
        }
        const fee = estimateSplitFee(outputs.length);
        const total = outputs.reduce((s, v) => s + v, 0);
        if (total + fee > splitUtxo.value) {
          toast.error(
            t('utxo.toast.outputsOverInput', { total: fmt(total + fee), input: fmt(splitUtxo.value) }),
          );
          return;
        }
      }
      setSplitEst({ feeSatoshis: estimateSplitFee(outputs.length), outputs, totalInputSatoshis: splitUtxo.value });
    } catch (e: any) {
      toast.error(e?.message ?? t('utxo.toast.splitParams'));
    }
  };

  const executeSplit = async () => {
    if (!splitUtxo || !splitEst) return;
    if (!browser.wallet?.privateKey) {
      toast.error(t('utxo.toast.walletLockedPanel'));
      return;
    }
    setSplitting(true);
    try {
      await assertUtxosCurrentlyUnspent([{ txid: splitUtxo.txid, vout: splitUtxo.vout }]);
      const { rawHex } = await buildAndSignSplitTx(
        splitUtxo,
        splitEst.outputs,
        walletAddress,
        browser.wallet.privateKey,
      );
      const txid = await broadcastUtxoTx(rawHex);
      setSplitTxid(txid);
      // Refresh after 15 s — gives mempool time to propagate before we re-fetch
      setTimeout(() => fetchUtxos(true), 15000);
    } catch (e: any) {
      toast.error(e?.message ?? t('utxo.toast.splitFail'));
    } finally {
      setSplitting(false);
    }
  };

  // ── Tools workflow ─────────────────────────────────────────────────────────
  const sendToWalletLab = () => {
    const eligible = getPlainSelected();
    if (eligible.length === 0) {
      toast.error(t('utxo.toast.toolsNoEligible'));
      return;
    }
    localStorage.setItem('walletlab-selected-utxos', JSON.stringify(eligible));
    if (onSelectUtxos) onSelectUtxos(eligible);
    toast.success(
      eligible.length === 1
        ? t('utxo.toast.toolsQueuedOne')
        : t('utxo.toast.toolsQueuedMany', { count: String(eligible.length) }),
    );
    setSelected(new Set());
  };

  // ── Wallet locked warning ──────────────────────────────────────────────────
  const walletLocked = !browser.wallet?.privateKey;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Wallet-locked notice ── */}
      {walletLocked && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
          <LockClosedIcon className="h-4 w-4 shrink-0" />
          {t('utxo.walletLockedNotice')}
        </div>
      )}

      {showAddressBanner && (
        <div className="rounded-lg border border-border-primary bg-bg-secondary px-4 py-3 dark:border-white/10 dark:bg-white/5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary dark:text-white/40">
            {t('utxo.managingAddress')}
          </p>
          <p className="mt-1 break-all font-mono text-base font-semibold leading-snug text-text-primary sm:text-lg dark:text-white">
            {walletAddress}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-text-tertiary dark:text-white/40">
            {listSource === null
              ? t('utxo.fetchSource.pending')
              : listSource === 'dogecoin-core-rpc'
                ? t('utxo.fetchSource.rpc')
                : listSource === 'blockchair-rpc-no-index'
                  ? t('utxo.fetchSource.blockchairRpcNoIndex')
                  : listSource === 'blockcypher'
                    ? t('utxo.fetchSource.blockcypher')
                    : listSource === 'tatum'
                      ? t('utxo.fetchSource.tatum')
                      : t('utxo.fetchSource.blockchair')}
          </p>
        </div>
      )}

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <div
          className="rounded-lg border border-border-primary bg-bg-secondary p-2 text-center dark:border-white/10 dark:bg-white/5"
          title={
            summary.hasConfirmationData ? t('utxo.cardTitle.confirmed') : t('utxo.cardTitle.unconfirmed')
          }
        >
          <div className="text-base font-bold text-[#D4A017]">{summary.balanceDoge.toFixed(2)}</div>
          {summary.hasConfirmationData && summary.pendingDoge > 0 && (
            <div className="text-[10px] font-medium text-amber-700 dark:text-amber-300/90">
              {t('utxo.pendingLine', { n: summary.pendingDoge.toFixed(2) })}
            </div>
          )}
          {summary.hasConfirmationData && summary.watchOnlyDoge > 0 && (
            <div className="text-[10px] font-medium text-text-secondary dark:text-white/45">
              {t('utxo.watchOnlyLine', { n: summary.watchOnlyDoge.toFixed(2) })}
            </div>
          )}
          <div className="mt-0.5 flex items-center justify-center gap-1 text-[10px] font-medium uppercase tracking-wider text-text-tertiary dark:text-white/40">
            {summary.hasConfirmationData ? (
              t('utxo.summary.balanceLabel')
            ) : (
              <DogeCurrencyIcon size="xs" className="opacity-75" />
            )}
          </div>
        </div>
        {[
          { id: 'utxos', label: t('utxo.summary.utxos'), value: summary.total, color: 'text-text-primary dark:text-white' },
          { id: 'insc', label: t('utxo.summary.inscribed'), value: summary.inscribed, color: 'text-orange-400' },
          { id: 'plain', label: t('utxo.summary.plain'), value: summary.plain, color: 'text-emerald-400' },
          { id: 'locked', label: t('utxo.summary.locked'), value: summary.locked, color: 'text-yellow-400' },
          { id: 'spend', label: t('utxo.summary.spendable'), value: summary.spendable, color: 'text-sky-400' },
        ].map(({ id, label, value, color }) => (
          <div key={id} className="rounded-lg border border-border-primary bg-bg-secondary p-2 text-center dark:border-white/10 dark:bg-white/5">
            <div className={`text-base font-bold ${color}`}>{value}</div>
            <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-text-tertiary dark:text-white/40">{label}</div>
          </div>
        ))}
      </div>

      {summary.hasConfirmationData && summary.pendingDoge > 0 && (
        <p className="px-0.5 text-xs text-text-secondary dark:text-white/45">
          {t('utxo.pendingExplain', { totalDoge: summary.totalDoge.toFixed(2) })}
        </p>
      )}

      {/* ── Fragmentation warning ── */}
      {summary.plain > 10 && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
          <div>
            <p className="text-sm font-medium text-yellow-300">{t('utxo.fragmentation.title')}</p>
            <p className="mt-0.5 text-xs text-yellow-300/70">
              {t('utxo.fragmentation.detail', { count: String(summary.plain) })}
            </p>
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary dark:text-white/40" />
          <input
            type="text"
            placeholder={t('utxo.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border-primary bg-bg-secondary py-2 pl-9 pr-3 text-xs text-text-primary placeholder:text-text-tertiary focus:border-[#D4A017]/50 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-white/30"
          />
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          title={t('utxo.sortBy')}
          className="rounded-lg border border-border-primary bg-bg-secondary px-2 py-2 text-xs text-text-primary focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          <option value="amount">{t('utxo.sort.amount')}</option>
          <option value="txid">{t('utxo.sort.txid')}</option>
        </select>
        <button
          type="button"
          onClick={() => setSortAsc(v => !v)}
          className="rounded-lg border border-border-primary bg-bg-secondary p-2 text-text-secondary hover:text-text-primary dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:text-white"
          title={sortAsc ? t('utxo.sort.desc') : t('utxo.sort.asc')}
        >
          {sortAsc ? <BarsArrowUpIcon className="h-3.5 w-3.5" /> : <BarsArrowDownIcon className="h-3.5 w-3.5" />}
        </button>

        {/* Refresh */}
        <button
          type="button"
          onClick={() => fetchUtxos(false)}
          disabled={isLoading}
          className="rounded-lg border border-border-primary bg-bg-secondary p-2 text-text-secondary hover:text-text-primary disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:text-white"
          title={t('utxo.refreshTitle')}
        >
          <ArrowPathIcon className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>

        {/* Auto-lock inscriptions */}
        <button
          type="button"
          onClick={handleAutoLock}
          className="flex items-center gap-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs font-medium text-yellow-300 hover:bg-yellow-500/20"
          title={t('utxo.autoLockTitle')}
        >
          <ShieldCheckIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('utxo.autoLockLong')}</span>
          <span className="sm:hidden">{t('utxo.autoLockShort')}</span>
        </button>
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex gap-1">
        {([
          { key: 'all', label: t('utxo.filter.all'), count: utxos.length },
          { key: 'plain', label: t('utxo.filter.plain'), count: summary.plain },
          { key: 'inscribed', label: t('utxo.filter.inscribed'), count: summary.inscribed },
          { key: 'locked', label: t('utxo.filter.locked'), count: summary.locked },
        ] as const).map(({ key, label, count }) => (
          <button
            type="button"
            key={key}
            onClick={() => setFilter(key)}
            className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 px-2 text-xs font-medium transition-colors ${
              filter === key
                ? 'bg-[#D4A017] text-black'
                : 'border border-border-primary bg-bg-secondary text-text-secondary hover:text-text-primary dark:border-white/10 dark:bg-white/5 dark:text-white/50 dark:hover:text-white'
            }`}
          >
            {label}
            <span className={`rounded px-1 text-[10px] font-bold ${filter === key ? 'bg-black/20 text-black' : 'bg-bg-tertiary text-text-secondary dark:bg-white/10 dark:text-white/60'}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Batch actions bar (shown when UTXOs are selected) ── */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#D4A017]/30 bg-[#D4A017]/10 px-3 py-2.5">
          <span className="text-xs font-semibold text-[#D4A017]">
            {t('utxo.selected', { count: String(selected.size) })}
          </span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => batchLock(true)}
              className="flex items-center gap-1 rounded-md bg-yellow-500/20 px-2 py-1 text-xs font-medium text-yellow-300 hover:bg-yellow-500/30"
            >
              <LockClosedIcon className="h-3 w-3" /> {t('utxo.lock')}
            </button>
            <button
              type="button"
              onClick={() => batchLock(false)}
              className="flex items-center gap-1 rounded-md bg-bg-tertiary px-2 py-1 text-xs font-medium text-text-secondary hover:bg-bg-secondary dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/20"
            >
              <LockOpenIcon className="h-3 w-3" /> {t('utxo.unlock')}
            </button>
            <button
              type="button"
              onClick={openMerge}
              disabled={walletLocked}
              className="flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
              title={walletLocked ? t('utxo.mergeTitleLocked') : t('utxo.mergeTitle')}
            >
              <ArrowDownIcon className="h-3 w-3" /> {t('utxo.merge')}
            </button>
            <button
              type="button"
              onClick={sendToWalletLab}
              className="flex items-center gap-1 rounded-md bg-sky-500/20 px-2 py-1 text-xs font-medium text-sky-300 hover:bg-sky-500/30"
            >
              <ArrowDownIcon className="h-3 w-3" /> {t('utxo.tools')}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="flex items-center gap-1 rounded-md bg-bg-tertiary px-2 py-1 text-xs text-text-tertiary hover:bg-bg-secondary dark:bg-white/10 dark:text-white/50 dark:hover:bg-white/20"
            >
              <XMarkIcon className="h-3 w-3" /> {t('utxo.clear')}
            </button>
          </div>
        </div>
      )}

      {/* ── UTXO list ── */}
      <div className="rounded-xl border border-white/10 bg-[#0A0A0A] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-white/40">
            <ArrowPathIcon className="h-5 w-5 animate-spin" /> {t('utxo.loading')}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10">
            <CubeIcon className="h-10 w-10 text-white/20" />
            <p className="text-sm text-white/40">{t('utxo.noMatch')}</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-xs">
                <thead className="border-b border-white/10 bg-white/5">
                  <tr>
                    <th className="px-3 py-2 text-left" aria-label={t('utxo.selectAll')}>
                      <input
                        type="checkbox"
                        aria-label={t('utxo.selectAll')}
                        checked={selected.size === visible.length && visible.length > 0}
                        onChange={e =>
                          setSelected(e.target.checked
                            ? new Set(visible.map(u => `${u.txid}:${u.vout}`))
                            : new Set())
                        }
                        className="rounded border-white/20"
                      />
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-white/50 uppercase tracking-wider">{t('utxo.th.utxo')}</th>
                    <th className="px-3 py-2 text-right font-medium text-white/50 uppercase tracking-wider">{t('utxo.th.amount')}</th>
                    <th
                      className="px-3 py-2 text-center font-medium text-white/50 uppercase tracking-wider"
                      title={t('utxo.th.confirmsTitle')}
                    >
                      {t('utxo.th.conf')}
                    </th>
                    <th className="px-3 py-2 text-center font-medium text-white/50 uppercase tracking-wider">{t('utxo.th.inscriptions')}</th>
                    <th className="px-3 py-2 text-center font-medium text-white/50 uppercase tracking-wider">{t('utxo.th.status')}</th>
                    <th className="px-3 py-2 text-center font-medium text-white/50 uppercase tracking-wider">{t('utxo.th.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {visible.map(utxo => {
                    const id = `${utxo.txid}:${utxo.vout}`;
                    const isSel = selected.has(id);
                    const hasInscriptions = utxo.inscriptions.length > 0;
                    return (
                      <tr
                        key={id}
                        className={`transition-colors ${isSel ? 'bg-[#D4A017]/10' : 'hover:bg-white/5'}`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            aria-label={`Select ${utxo.txid}:${utxo.vout}`}
                            checked={isSel}
                            onChange={e => {
                              const s = new Set(selected);
                              if (e.target.checked) s.add(id); else s.delete(id);
                              setSelected(s);
                            }}
                            className="rounded border-white/20"
                          />
                        </td>
                        <td className="px-3 py-2 font-mono">
                          <span className="text-white/80 break-all" title={id}>
                            {utxo.txid}:{utxo.vout}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="font-medium text-white"><DogeAmount sats={utxo.value} /></div>
                          <div className="text-white/30">
                            {utxo.value.toLocaleString()} {t('utxo.koinu')}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          {utxo.confirmations === undefined ? (
                            <span className="text-white/25">—</span>
                          ) : utxo.confirmations === 0 ? (
                            <span className="text-[10px] font-semibold text-amber-300/90">{t('utxo.mempool')}</span>
                          ) : (
                            <span className="text-white/70">{utxo.confirmations}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {hasInscriptions ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-semibold text-orange-400">
                              <BanknotesIcon className="h-3 w-3" />
                              {utxo.inscriptions.length}
                            </span>
                          ) : (
                            <span className="text-white/20">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {utxo.rpcSpendable === false ? (
                            <span className="text-[10px] font-semibold text-white/45">{t('utxo.watchOnly')}</span>
                          ) : utxo.locked ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-semibold text-yellow-400">
                              <LockClosedIcon className="h-3 w-3" /> {t('utxo.summary.locked')}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-emerald-400">{t('utxo.spendable')}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleOneLock(utxo)}
                              className={`rounded p-1.5 transition-colors ${
                                utxo.locked
                                  ? 'text-yellow-400 hover:bg-yellow-500/10'
                                  : 'text-white/40 hover:bg-white/10'
                              }`}
                              title={utxo.locked ? t('utxo.aria.unlockOne') : t('utxo.aria.lockOne')}
                            >
                              {utxo.locked
                                ? <LockClosedIcon className="h-3.5 w-3.5" />
                                : <LockOpenIcon className="h-3.5 w-3.5" />}
                            </button>
                            {!hasInscriptions && !utxo.locked && (
                              <button
                                type="button"
                                onClick={() => openSplit(utxo)}
                                disabled={walletLocked}
                                className="rounded p-1.5 text-white/40 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 transition-colors"
                                title={walletLocked ? t('utxo.splitTitleLocked') : t('utxo.splitTitle')}
                              >
                                <ScissorsIcon className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="divide-y divide-white/5 md:hidden">
              {visible.map(utxo => {
                const id = `${utxo.txid}:${utxo.vout}`;
                const isSel = selected.has(id);
                const hasInscriptions = utxo.inscriptions.length > 0;
                return (
                  <div key={id} className={`p-3 ${isSel ? 'bg-[#D4A017]/10' : ''}`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${utxo.txid}:${utxo.vout}`}
                        checked={isSel}
                        onChange={e => {
                          const s = new Set(selected);
                          if (e.target.checked) s.add(id); else s.delete(id);
                          setSelected(s);
                        }}
                        className="mt-0.5 rounded border-white/20"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] text-white/70 break-all">
                            {utxo.txid}:{utxo.vout}
                          </span>
                          <span className="text-xs font-bold text-white shrink-0"><DogeAmount sats={utxo.value} /></span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {utxo.confirmations !== undefined && utxo.confirmations === 0 && (
                            <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300/90">
                              {t('utxo.mobile.mempool')}
                            </span>
                          )}
                          {hasInscriptions && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-orange-400">
                              <BanknotesIcon className="h-2.5 w-2.5" />{' '}
                              {utxo.inscriptions.length === 1
                                ? t('utxo.mobile.inscriptionsOne', { n: String(utxo.inscriptions.length) })
                                : t('utxo.mobile.inscriptionsMany', { n: String(utxo.inscriptions.length) })}
                            </span>
                          )}
                          {utxo.rpcSpendable === false ? (
                            <span className="text-[9px] font-semibold text-white/45">{t('utxo.watchOnly')}</span>
                          ) : utxo.locked ? (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-yellow-400">
                              <LockClosedIcon className="h-2.5 w-2.5" /> {t('utxo.summary.locked')}
                            </span>
                          ) : (
                            <span className="text-[9px] font-semibold text-emerald-400">{t('utxo.spendable')}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleOneLock(utxo)}
                          className={`rounded p-1.5 ${utxo.locked ? 'text-yellow-400' : 'text-white/40'}`}
                        >
                          {utxo.locked ? <LockClosedIcon className="h-4 w-4" /> : <LockOpenIcon className="h-4 w-4" />}
                        </button>
                        {!hasInscriptions && !utxo.locked && (
                          <button
                            type="button"
                            onClick={() => openSplit(utxo)}
                            disabled={walletLocked}
                            title={walletLocked ? t('utxo.splitTitleLocked') : t('utxo.splitTitle')}
                            className="rounded p-1.5 text-white/40 disabled:opacity-30"
                          >
                            <ScissorsIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Inscription IDs on expand */}
                    {hasInscriptions && (
                      <div className="mt-2 rounded bg-orange-500/5 px-2 py-1.5 border border-orange-500/20">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-orange-400/70 mb-1">{t('utxo.inscriptionIds')}</p>
                        {utxo.inscriptions.map(id => (
                          <p key={id} className="font-mono text-[9px] text-orange-300/60 truncate">{id}</p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Merge modal ── */}
      {showMerge && mergeEst && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111] p-5 shadow-2xl">
            {mergeTxid ? (
              /* ── Success state ── */
              <>
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
                    <ArrowDownIcon className="h-4 w-4 text-emerald-400" />
                  </div>
                  <h3 className="text-base font-bold text-white">{t('utxo.merge.successTitle')}</h3>
                </div>
                <p className="mb-2 text-xs text-white/50">{t('utxo.merge.successHint')}</p>
                <div className="mb-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">TXID</p>
                  <p className="break-all font-mono text-[11px] text-white/80">{mergeTxid}</p>
                </div>
                <a
                  href={`https://sochain.com/tx/DOGE/${mergeTxid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 py-2 text-xs text-sky-400 hover:bg-white/5"
                >
                  {t('utxo.viewOnExplorer')}
                </a>
                <p className="mb-4 text-[11px] text-amber-300/70">
                  {t('utxo.confirmPendingNote')}
                </p>
                <button
                  type="button"
                  onClick={() => { setShowMerge(false); setMergeEst(null); setMergeTxid(null); }}
                  className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  {t('utxo.merge.done')}
                </button>
              </>
            ) : (
              /* ── Confirm state ── */
              <>
                <h3 className="text-base font-bold text-white mb-4">
                  {t('utxo.mergeTitleModal', { count: String(mergeEst.inputCount) })}
                </h3>
                {([
                  { id: 'in', label: t('utxo.merge.inputs'), node: mergeEst.inputCount, color: 'text-white font-medium' },
                  { id: 'tot', label: t('utxo.merge.totalInput'), node: <DogeAmount sats={mergeEst.totalInputSatoshis} />, color: 'text-white font-medium' },
                  { id: 'fee', label: t('utxo.merge.estimatedFee'), node: <DogeAmount sats={mergeEst.feeSatoshis} />, color: 'text-yellow-300' },
                  { id: 'recv', label: t('utxo.merge.youReceive'), node: <DogeAmount sats={mergeEst.changeToWallet} />, color: 'text-emerald-300' },
                ] as const).map(({ id, label, node, color }) => (
                  <div key={id} className="flex justify-between py-1.5 border-b border-white/5 text-sm">
                    <span className="text-white/50">{label}</span>
                    <span className={color}>{node}</span>
                  </div>
                ))}
                <p className="mt-3 text-[11px] text-white/40">
                  {t('utxo.merge.combineHint')}
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowMerge(false); setMergeEst(null); setMergeTxid(null); }}
                    disabled={merging}
                    className="flex-1 rounded-lg border border-white/10 py-2 text-sm text-white/60 hover:bg-white/5 disabled:opacity-50"
                  >
                    {t('utxo.merge.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={executeMerge}
                    disabled={merging}
                    className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {merging ? t('utxo.merge.broadcasting') : t('utxo.merge.confirm')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Split modal ── */}
      {showSplit && splitUtxo && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111] p-5 shadow-2xl">
            {splitTxid ? (
              /* ── Success state ── */
              <>
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D4A017]/20">
                    <ScissorsIcon className="h-4 w-4 text-[#D4A017]" />
                  </div>
                  <h3 className="text-base font-bold text-white">{t('utxo.split.successTitle')}</h3>
                </div>
                <p className="mb-2 text-xs text-white/50">
                  {t('utxo.split.successHint', { n: String(splitEst?.outputs.length ?? splitCount) })}
                </p>
                <div className="mb-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">TXID</p>
                  <p className="break-all font-mono text-[11px] text-white/80">{splitTxid}</p>
                </div>
                <a
                  href={`https://sochain.com/tx/DOGE/${splitTxid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 py-2 text-xs text-sky-400 hover:bg-white/5"
                >
                  {t('utxo.viewOnExplorer')}
                </a>
                <p className="mb-4 text-[11px] text-amber-300/70">
                  {t('utxo.confirmPendingNote')}
                </p>
                <button
                  type="button"
                  onClick={() => { setShowSplit(false); setSplitUtxo(null); setSplitEst(null); setSplitTxid(null); }}
                  className="w-full rounded-lg bg-[#D4A017] py-2 text-sm font-semibold text-black hover:bg-yellow-400"
                >
                  {t('utxo.split.done')}
                </button>
              </>
            ) : (
              /* ── Confirm state ── */
              <>
                <h3 className="text-base font-bold text-white mb-1">{t('utxo.splitTitle')}</h3>
                <p className="mb-3 font-mono text-[11px] text-white/40 break-all">
                  {splitUtxo.txid}:{splitUtxo.vout} · <DogeAmount sats={splitUtxo.value} />
                </p>

                {/* 0-conf warning */}
                {splitUtxo.confirmations === 0 && (
                  <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                    <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    <p className="text-[11px] text-amber-300/90">{t('utxo.split.zeroConfWarning')}</p>
                  </div>
                )}

                {/* Mode toggle */}
                <div className="mb-4 flex rounded-lg border border-white/10 bg-white/5 p-0.5">
                  {(['equal', 'custom'] as const).map(m => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => { setSplitMode(m); setSplitEst(null); }}
                      className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                        splitMode === m ? 'bg-[#D4A017] text-black' : 'text-white/50 hover:text-white'
                      }`}
                    >
                      {m === 'equal' ? t('utxo.split.equal') : t('utxo.split.custom')}
                    </button>
                  ))}
                </div>

                {splitMode === 'equal' ? (
                  <div className="mb-4">
                    <label className="mb-1 block text-xs text-white/50" htmlFor="split-count">{t('utxo.numOutputs')}</label>
                    <input
                      id="split-count"
                      type="number"
                      min={2}
                      max={50}
                      value={splitCount}
                      title={t('utxo.numOutputs')}
                      placeholder="2"
                      onChange={e => { setSplitCount(Math.max(2, Math.min(50, parseInt(e.target.value) || 2))); setSplitEst(null); }}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none"
                    />
                    <p className="mt-1 text-[10px] text-white/30">{t('utxo.split.maxNote')}</p>
                  </div>
                ) : (
                  <div className="mb-4 space-y-1.5">
                    <label className="mb-1 block text-xs text-white/50">{t('utxo.outputAmounts')}</label>
                    {customAmounts.map((v, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          placeholder="0.000"
                          aria-label={`Output ${i + 1} amount in DOGE`}
                          value={v}
                          onChange={e => {
                            const a = [...customAmounts];
                            a[i] = e.target.value;
                            setCustomAmounts(a);
                            setSplitEst(null);
                          }}
                          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none"
                        />
                        {customAmounts.length > 2 && (
                          <button
                            type="button"
                            title={t('utxo.split.removeOutput')}
                            onClick={() => { setCustomAmounts(customAmounts.filter((_, j) => j !== i)); setSplitEst(null); }}
                            className="text-white/30 hover:text-red-400"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {customAmounts.length < 50 && (
                      <button
                        type="button"
                        onClick={() => setCustomAmounts([...customAmounts, ''])}
                        className="mt-1 text-xs text-[#D4A017]/70 hover:text-[#D4A017]"
                      >
                        {t('utxo.split.addOutput')}
                      </button>
                    )}
                  </div>
                )}

                {/* Estimate button */}
                {!splitEst && (
                  <button
                    type="button"
                    onClick={calcSplitEst}
                    className="mb-4 w-full rounded-lg border border-[#D4A017]/40 py-2 text-sm text-[#D4A017] hover:bg-[#D4A017]/10"
                  >
                    {t('utxo.split.calculate')}
                  </button>
                )}

                {/* Estimate results */}
                {splitEst && (
                  <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-white/50">{t('utxo.fee')}</span>
                      <span className="text-yellow-300">
                        <DogeAmount sats={splitEst.feeSatoshis} /> <span className="text-white/30 text-[10px]">({(splitEst.feeSatoshis / 1e8).toFixed(4)} DOGE)</span>
                      </span>
                    </div>
                    <div className="flex justify-between"><span className="text-white/50">{t('utxo.outputs')}</span><span className="text-white">{splitEst.outputs.length}</span></div>
                    <div className="max-h-40 overflow-y-auto">
                      {splitEst.outputs.map((v, i) => (
                        <div key={i} className="flex justify-between pl-3 text-[11px]">
                          <span className="text-white/30">{t('utxo.outputN', { n: String(i + 1) })}</span>
                          <span className="font-mono text-white/60"><DogeAmount sats={v} decimals={8} /></span>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={calcSplitEst}
                      className="mt-1 text-[10px] text-white/30 hover:text-white/60"
                    >
                      {t('utxo.split.recalculate')}
                    </button>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowSplit(false); setSplitUtxo(null); setSplitEst(null); setSplitTxid(null); }}
                    disabled={splitting}
                    className="flex-1 rounded-lg border border-white/10 py-2 text-sm text-white/60 hover:bg-white/5 disabled:opacity-50"
                  >
                    {t('utxo.split.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={executeSplit}
                    disabled={splitting || !splitEst}
                    className="flex-1 rounded-lg bg-[#D4A017] py-2 text-sm font-semibold text-black hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {splitting ? t('utxo.split.broadcasting') : t('utxo.split.confirm')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UtxoManagement;
