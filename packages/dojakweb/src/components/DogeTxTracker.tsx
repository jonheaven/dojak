'use client';

import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { DogeTxLink } from './DogeTxLink';
import {
  useDogeTxConfirmations,
  type UseDogeTxConfirmationsOptions,
} from '../hooks/useDogeTxConfirmations';

export type DogeTxTrackerProps = {
  txid: string;
  /** Prefix before the explorer link while unconfirmed (default "Sent"). */
  label?: string;
  /** Prefix once 1+ confirmations (default "Confirmed"). */
  confirmedLabel?: string;
  /** When false, only spinner/check + link (no Sent./Confirmed. text). */
  showLabel?: boolean;
  targetConfirmations?: number;
  enabled?: boolean;
  onConfirmed?: UseDogeTxConfirmationsOptions['onConfirmed'];
  className?: string;
  linkClassName?: string;
  full?: boolean;
  children?: React.ReactNode;
};

/**
 * Compact post-broadcast UX: spin next to the explorer link until 1 confirmation,
 * then a check. Reuses {@link useDogeTxConfirmations} / command.dog + indexer merge.
 */
export function DogeTxTracker({
  txid,
  label = 'Sent',
  confirmedLabel = 'Confirmed',
  showLabel = true,
  targetConfirmations = 1,
  enabled = true,
  onConfirmed,
  className,
  linkClassName,
  full = false,
  children,
}: DogeTxTrackerProps) {
  const { confirmed, confirmations, phase } = useDogeTxConfirmations(txid, {
    targetConfirmations,
    enabled,
    onConfirmed,
  });

  const statusTitle = confirmed
    ? `${confirmations ?? targetConfirmations}+ confirmation${
        (confirmations ?? targetConfirmations) === 1 ? '' : 's'
      }`
    : phase === 'timeout'
      ? 'Still waiting — open the explorer if public APIs lag'
      : phase === 'error'
        ? 'Could not read confirmations — check the explorer'
        : 'In mempool — waiting for first confirmation';

  return (
    <span
      className={cn('inline-flex max-w-full items-center gap-1.5 align-middle text-sm', className)}
      title={statusTitle}
    >
      {confirmed ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
      ) : (
        <Loader2
          className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-500"
          aria-hidden
          aria-label="Waiting for confirmation"
        />
      )}
      {showLabel ? (
        <span className="shrink-0">{confirmed ? `${confirmedLabel}.` : `${label}.`}</span>
      ) : null}
      <DogeTxLink txid={txid} full={full} className={cn('min-w-0', linkClassName)}>
        {children}
      </DogeTxLink>
    </span>
  );
}
