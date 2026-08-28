'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  DOJAKWEB_FEE_MAX_KOINU_PER_BYTE,
  DOJAKWEB_FEE_MIN_KOINU_PER_BYTE,
  DOJAKWEB_FEE_PRESET_RATES,
  DOJAKWEB_TX_FEE_PREF_EVENT,
  clampDojakwebFeeRateKoinuPerByte,
  estimateP2pkhFeeDoge,
  formatDojakwebFeeRate,
  readDojakwebTxFeePreference,
  resolveDojakwebFeeRateKoinuPerByte,
  writeDojakwebTxFeePreference,
  type DojakwebTxFeePreference,
  type DojakwebTxFeePreset,
} from '../../lib/fees/txFeePreference';
import { useDojakwebTheme } from '../../contexts/DojakwebThemeContext';
import { cn } from '@/lib/utils';

const PRESETS: Array<{ id: DojakwebTxFeePreset; label: string }> = [
  { id: 'normal', label: 'Normal' },
  { id: 'fast', label: 'Fast' },
  { id: 'priority', label: 'Priority' },
  { id: 'custom', label: 'Custom' },
];

export type NetworkFeeControlProps = {
  className?: string;
  /** Optional OP_RETURN script length for fee estimate. */
  opReturnScriptLen?: number;
  inputs?: number;
  outputs?: number;
  /** Called whenever the resolved rate (koinu/byte) changes. */
  onRateKoinuPerByteChange?: (rate: number) => void;
  /** Compact label for host modals. */
  title?: string;
  /** Tighter layout — no helper copy (wallet send / approval / games flyout). */
  compact?: boolean;
  /** Wallet chassis / casino dark chrome vs dune-modal design tokens. */
  tone?: 'app' | 'wallet';
  disabled?: boolean;
};

/**
 * Shared Normal / Fast / Priority / Custom fee picker for Dojakweb hosts
 * (dogenals Ðunes, dogecoin.games bets, alkanes, Local Browser Wallet).
 *
 * Presets are multipliers on the live Command.dog estimatesmartfee — never a
 * static 1000 koinu/B “Normal” that underpays during fee wars.
 */
export function NetworkFeeControl({
  className,
  opReturnScriptLen = 0,
  inputs = 1,
  outputs = 3,
  onRateKoinuPerByteChange,
  title = 'Network fee',
  compact = false,
  tone = 'app',
  disabled = false,
}: NetworkFeeControlProps) {
  const { theme } = useDojakwebTheme();
  const walletDark = tone === 'wallet' && theme !== 'light';
  const [pref, setPref] = useState<DojakwebTxFeePreference>(() => readDojakwebTxFeePreference());
  const [liveRate, setLiveRate] = useState(() => dojakwebFeeRateKoinuPerByteFromPreferenceSafe(pref));

  useEffect(() => {
    const sync = () => setPref(readDojakwebTxFeePreference());
    window.addEventListener(DOJAKWEB_TX_FEE_PREF_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(DOJAKWEB_TX_FEE_PREF_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void resolveDojakwebFeeRateKoinuPerByte(pref).then((rate) => {
      if (!cancelled) setLiveRate(rate);
    });
    return () => {
      cancelled = true;
    };
  }, [pref]);

  const estimate = useMemo(
    () =>
      estimateP2pkhFeeDoge({
        rateKoinuPerByte: liveRate,
        opReturnScriptLen,
        inputs,
        outputs,
      }),
    [inputs, opReturnScriptLen, outputs, liveRate],
  );

  useEffect(() => {
    onRateKoinuPerByteChange?.(liveRate);
  }, [onRateKoinuPerByteChange, liveRate]);

  const setPreset = (preset: DojakwebTxFeePreset) => {
    if (disabled) return;
    const next: DojakwebTxFeePreference = {
      preset,
      customRateKoinuPerByte:
        preset === 'custom' ? pref.customRateKoinuPerByte ?? liveRate : undefined,
    };
    writeDojakwebTxFeePreference(next);
    setPref(next);
  };

  const setCustom = (value: string) => {
    if (disabled) return;
    const next: DojakwebTxFeePreference = {
      preset: 'custom',
      customRateKoinuPerByte: clampDojakwebFeeRateKoinuPerByte(Number(value)),
    };
    writeDojakwebTxFeePreference(next);
    setPref(next);
  };

  const wallet = tone === 'wallet';
  const showHeader = Boolean(title);

  return (
    <div
      className={cn(
        'rounded-lg border px-2.5 py-2',
        wallet
          ? walletDark
            ? 'border-white/10 bg-white/[0.04]'
            : 'border-zinc-200 bg-zinc-50'
          : 'border-border-primary bg-bg-secondary/40',
        disabled && 'pointer-events-none opacity-60',
        className,
      )}
    >
      {showHeader ? (
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            'text-[10px] font-semibold uppercase tracking-wide',
            wallet ? (walletDark ? 'text-white/45' : 'text-zinc-500') : 'text-text-secondary',
          )}
        >
          {title}
        </span>
        <span
          className={cn(
            'inline-flex flex-wrap items-center justify-end gap-1 text-[10px] font-semibold tabular-nums',
            wallet
              ? walletDark
                ? 'text-[#FCD34D]'
                : 'text-amber-700'
              : 'text-amber-600 dark:text-amber-300',
          )}
        >
          <span>{formatDojakwebFeeRate(liveRate)}</span>
          <span aria-hidden>·</span>
          <span>~{estimate.toFixed(estimate >= 0.01 ? 3 : 4)} Ð</span>
        </span>
      </div>
      ) : null}
      <div className="grid grid-cols-4 gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            onClick={() => setPreset(p.id)}
            className={cn(
              'min-h-[32px] rounded-md border px-1 text-[11px] font-semibold transition',
              pref.preset === p.id
                ? wallet
                  ? walletDark
                    ? 'border-[#D4A017]/70 bg-[#D4A017]/15 text-white'
                    : 'border-amber-500/70 bg-amber-500/15 text-zinc-900'
                  : 'border-amber-500/60 bg-amber-500/15 text-text-primary'
                : wallet
                  ? walletDark
                    ? 'border-white/10 text-white/50 hover:border-[#D4A017]/40 hover:text-white'
                    : 'border-zinc-200 text-zinc-500 hover:border-amber-400 hover:text-zinc-900'
                  : 'border-border-primary text-text-secondary hover:border-amber-500/40 hover:text-text-primary',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {pref.preset === 'custom' ? (
        <label
          className={cn(
            'mt-2 flex items-center gap-2 text-[11px]',
            wallet ? (walletDark ? 'text-white/50' : 'text-zinc-500') : 'text-text-secondary',
          )}
        >
          <span className="shrink-0">koinu/B</span>
          <input
            type="number"
            min={DOJAKWEB_FEE_MIN_KOINU_PER_BYTE}
            max={DOJAKWEB_FEE_MAX_KOINU_PER_BYTE}
            step={500}
            value={liveRate}
            disabled={disabled}
            onChange={(e) => setCustom(e.target.value)}
            className={cn(
              'min-h-[34px] w-full rounded-md border px-2 text-sm font-semibold tabular-nums outline-none',
              wallet
                ? walletDark
                  ? 'border-white/10 bg-black/40 text-white focus:border-[#D4A017]/60'
                  : 'border-zinc-200 bg-white text-zinc-900 focus:border-amber-500'
                : 'border-border-primary bg-bg-primary text-text-primary focus:border-amber-500/60',
            )}
          />
        </label>
      ) : null}
      {compact ? null : (
        <p
          className={cn(
            'mt-1.5 text-[10px] leading-snug',
            wallet ? (walletDark ? 'text-white/40' : 'text-zinc-500') : 'text-text-secondary',
          )}
        >
          Rates track live Core estimatesmartfee (via command.dog). Underpaying is blocked at
          sign/broadcast. Pick Fast or Priority when the mempool is hot.
        </p>
      )}
    </div>
  );
}

function dojakwebFeeRateKoinuPerByteFromPreferenceSafe(pref: DojakwebTxFeePreference): number {
  if (pref.preset === 'custom') {
    return clampDojakwebFeeRateKoinuPerByte(
      pref.customRateKoinuPerByte ?? DOJAKWEB_FEE_PRESET_RATES.fast,
    );
  }
  return DOJAKWEB_FEE_PRESET_RATES[pref.preset];
}

export default NetworkFeeControl;
