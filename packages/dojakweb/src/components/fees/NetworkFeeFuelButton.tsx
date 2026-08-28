'use client';

import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { Fuel } from 'lucide-react';
import { NetworkFeeControl } from './NetworkFeeControl';
import { useDojakwebTheme } from '../../contexts/DojakwebThemeContext';
import {
  DOJAKWEB_TX_FEE_PREF_EVENT,
  formatDojakwebFeeRate,
  readDojakwebTxFeePreference,
  resolveDojakwebFeeRateKoinuPerByte,
} from '../../lib/fees/txFeePreference';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

export type NetworkFeeFuelButtonProps = {
  className?: string;
  /** Extra classes on the flyout panel. */
  panelClassName?: string;
};

/**
 * Compact Fuel (gas tank) control — wallet dashboard chrome and host bars.
 * Writes the shared `dojakweb:txFeePreference:v1` key.
 */
export function NetworkFeeFuelButton({ className, panelClassName }: NetworkFeeFuelButtonProps) {
  const { theme } = useDojakwebTheme();
  const isDark = theme !== 'light';
  const [rateLabel, setRateLabel] = useState('…');

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      void resolveDojakwebFeeRateKoinuPerByte(readDojakwebTxFeePreference()).then((rate) => {
        if (!cancelled) setRateLabel(formatDojakwebFeeRate(rate));
      });
    };
    sync();
    window.addEventListener(DOJAKWEB_TX_FEE_PREF_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      cancelled = true;
      window.removeEventListener(DOJAKWEB_TX_FEE_PREF_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return (
    <Popover className="relative">
      <PopoverButton
        type="button"
        title={`Network fee ${rateLabel}`}
        aria-label={`Network fee ${rateLabel}`}
        className={cn(
          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition',
          className,
        )}
      >
        <Fuel className="h-3.5 w-3.5" aria-hidden />
      </PopoverButton>
      <PopoverPanel
        portal
        anchor={{ to: 'bottom end', gap: 6, padding: 12 }}
        className={cn(
          'z-[10140] w-[min(18.5rem,calc(100vw-1.25rem))] rounded-xl border p-2.5 shadow-2xl outline-none',
          isDark ? 'border-white/10 bg-zinc-900' : 'border-zinc-200 bg-white',
          panelClassName,
        )}
      >
        <NetworkFeeControl compact tone="wallet" />
        <p
          className={cn(
            'mt-1.5 px-0.5 text-[10px] leading-snug',
            isDark ? 'text-white/40' : 'text-zinc-500',
          )}
        >
          Applies to Local Browser Wallet txs on this site.
        </p>
      </PopoverPanel>
    </Popover>
  );
}

export default NetworkFeeFuelButton;
