import React from 'react';
import { useDojakwebFiatOptional } from '../contexts/DojakwebFiatContext';
import { DogeCurrencyIcon, type DogeCurrencyIconSize } from './DogeCurrencyIcon';

interface DogeAmountProps {
  /** Amount in DOGE (decimal). Use either `doge` or `sats`, not both. */
  doge?: number;
  /** Amount in satoshis (koinu). Converted to DOGE automatically. */
  sats?: number;
  /** Number of decimal places to display. Defaults to 2. */
  decimals?: number;
  /** Size of the doge.svg unit mark (Ð if the image fails). Defaults to 'sm'. */
  iconSize?: 'sm' | 'md' | 'lg';
  /** When true and Dojakweb fiat provider is present, append fiat hint in brackets (see host sync keys). */
  showFiat?: boolean;
}

const SATS_PER_DOGE = 100_000_000;
const MAX_AUTO_DECIMALS = 8;

/**
 * Avoid showing Ð0.00 for positive dust (e.g. 100_000 koinu = 0.001 DOGE) when decimals is 2.
 */
function formatDogeForDisplay(amount: number, decimals: number): string {
  if (!Number.isFinite(amount)) return (0).toFixed(decimals);
  const coarse = amount.toFixed(decimals);
  if (amount > 0 && Number(coarse) === 0) {
    for (let d = decimals + 1; d <= MAX_AUTO_DECIMALS; d++) {
      const finer = amount.toFixed(d);
      if (Number(finer) > 0) {
        return finer.replace(/\.?0+$/, '') || finer;
      }
    }
    return amount.toFixed(MAX_AUTO_DECIMALS).replace(/\.?0+$/, '') || coarse;
  }
  return coarse;
}

const dogeIconSizeMap: Record<NonNullable<DogeAmountProps['iconSize']>, DogeCurrencyIconSize> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
};

export function DogeAmount({ doge, sats, decimals = 2, iconSize = 'sm', showFiat = false }: DogeAmountProps) {
  const fiat = useDojakwebFiatOptional();
  const amount = doge !== undefined ? doge : (sats ?? 0) / SATS_PER_DOGE;
  const formatted = formatDogeForDisplay(amount, decimals);
  const usd = showFiat && fiat ? fiat.convertUsd(amount) : null;
  const local = showFiat && fiat && fiat.currency !== 'USD' ? fiat.convert(amount) : null;

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
      <span className="inline-flex items-baseline gap-0.5">
        <DogeCurrencyIcon size={dogeIconSizeMap[iconSize]} className="relative top-[0.08em]" />
        <span>{formatted}</span>
      </span>
      {showFiat && fiat && usd != null ? (
        <span className="text-[0.75em] font-normal text-white/50">
          ({fiat.formatFiat(usd, 'USD')}
          {local != null && fiat.currency !== 'USD' ? ` · ${fiat.formatFiat(local)}` : ''})
        </span>
      ) : null}
    </span>
  );
}
