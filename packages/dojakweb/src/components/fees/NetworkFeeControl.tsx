'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
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
};

/**
 * Shared Normal / Fast / Priority / Custom fee picker for Dojakweb hosts
 * (dogenals Ðunes, dogecoin.games bets, alkanes, etc.).
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
}: NetworkFeeControlProps) {
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
    const next: DojakwebTxFeePreference = {
      preset,
      customRateKoinuPerByte:
        preset === 'custom'
          ? pref.customRateKoinuPerByte ?? liveRate
          : undefined,
    };
    writeDojakwebTxFeePreference(next);
    setPref(next);
  };

  const setCustom = (value: string) => {
    const next: DojakwebTxFeePreference = {
      preset: 'custom',
      customRateKoinuPerByte: clampDojakwebFeeRateKoinuPerByte(Number(value)),
    };
    writeDojakwebTxFeePreference(next);
    setPref(next);
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-border-primary bg-bg-secondary/40 px-2.5 py-2',
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
          {title}
        </span>
        <span className="inline-flex flex-wrap items-center justify-end gap-1 text-[10px] font-semibold tabular-nums text-amber-600 dark:text-amber-300">
          <span>{formatDojakwebFeeRate(liveRate)}</span>
          <span aria-hidden>·</span>
          <span>~{estimate.toFixed(estimate >= 0.01 ? 3 : 4)} Ð</span>
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={cn(
              'min-h-[32px] rounded-md border px-1 text-[11px] font-semibold transition',
              pref.preset === p.id
                ? 'border-amber-500/60 bg-amber-500/15 text-text-primary'
                : 'border-border-primary text-text-secondary hover:border-amber-500/40 hover:text-text-primary',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {pref.preset === 'custom' ? (
        <label className="mt-2 flex items-center gap-2 text-[11px] text-text-secondary">
          <span className="shrink-0">koinu/B</span>
          <input
            type="number"
            min={DOJAKWEB_FEE_PRESET_RATES.normal}
            max={500_000}
            step={500}
            value={liveRate}
            onChange={(e) => setCustom(e.target.value)}
            className="min-h-[34px] w-full rounded-md border border-border-primary bg-bg-primary px-2 text-sm font-semibold tabular-nums text-text-primary outline-none focus:border-amber-500/60"
          />
        </label>
      ) : null}
      <p className="mt-1.5 text-[10px] leading-snug text-text-secondary">
        Rates track live Core estimatesmartfee (via command.dog). Underpaying is blocked at
        sign/broadcast — stuck mempool etches should not happen again.
      </p>
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
