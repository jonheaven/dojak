'use client';

import { useMemo } from 'react';
import { useDojakwebI18n } from '@/contexts/DojakwebLocaleContext';
import { cn } from '@/lib/utils';
import {
  getDogeConfirmationReadSourceRows,
  type BroadcastConfig,
  type DogeConfirmationReadSourceId,
} from '@/lib/broadcast/doge-chain-broadcast';

const LABEL_KEY: Record<DogeConfirmationReadSourceId, string> = {
  rpc: 'chain.confirmReads.rpc',
  commanddog: 'chain.confirmReads.commanddog',
  blockchair: 'chain.confirmReads.blockchair',
  blockcypher: 'chain.confirmReads.blockcypher',
  tatum: 'chain.confirmReads.tatum',
};

/**
 * Live summary of which APIs contribute to {@link getBestDogeTxConfirmations} (per-tx max merge, ~28s cache).
 * Pass `previewConfig` from Wallet settings draft so the list updates before Save.
 */
export function ConfirmationReadSourcesBar({
  previewConfig,
  className,
  dense,
}: {
  previewConfig?: BroadcastConfig;
  className?: string;
  dense?: boolean;
}) {
  const { t } = useDojakwebI18n();
  const rows = useMemo(() => getDogeConfirmationReadSourceRows(previewConfig), [previewConfig]);

  return (
    <div
      className={cn(
        'rounded-xl border border-border-primary bg-bg-secondary dark:border-white/10 dark:bg-black/25',
        dense ? 'px-2.5 py-2' : 'px-3 py-2.5',
        className,
      )}
      role="region"
      aria-label={t('chain.confirmReads.title')}
    >
      <div
        className={cn('font-semibold text-text-primary dark:text-white/85', dense ? 'text-[10px] uppercase tracking-wider' : 'text-xs')}
      >
        {t('chain.confirmReads.title')}
      </div>
      <p
        className={cn(
          'text-text-tertiary dark:text-white/50',
          dense ? 'mt-0.5 text-[10px] leading-snug' : 'mt-1 text-[11px] leading-relaxed',
        )}
      >
        {t('chain.confirmReads.subtitle')}
      </p>
      <ul className={cn('m-0 flex list-none flex-wrap gap-1.5 p-0', dense ? 'mt-1.5' : 'mt-2')}>
        {rows.map((row) => (
          <li key={row.id}>
            <span
              title={
                row.offKey
                  ? t(row.offKey)
                  : row.id === 'blockchair'
                    ? t('chain.confirmReads.on.blockchair')
                    : row.id === 'commanddog'
                      ? t('chain.confirmReads.on.commanddog')
                      : undefined
              }
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 font-medium',
                dense ? 'text-[10px]' : 'text-[11px]',
                row.active
                  ? 'border-emerald-500/45 bg-emerald-500/12 text-emerald-100'
                  : 'border-border-primary bg-bg-tertiary text-text-tertiary dark:border-white/10 dark:bg-white/[0.06] dark:text-white/40',
              )}
            >
              <span className={cn('mr-1', row.active ? 'text-emerald-300' : 'text-text-tertiary dark:text-white/25')} aria-hidden>
                {row.active ? '●' : '○'}
              </span>
              {t(LABEL_KEY[row.id])}
            </span>
          </li>
        ))}
      </ul>
      <p
        className={cn(
          'text-text-tertiary dark:text-white/40',
          dense ? 'mt-1.5 text-[10px] leading-snug' : 'mt-2 text-[10px] leading-relaxed',
        )}
      >
        {t('chain.confirmReads.broadcastHint')}
      </p>
    </div>
  );
}
