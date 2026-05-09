'use client';

import { Loader2 } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export interface TxConfirmationPollProgressProps {
  /** When false, nothing is rendered. */
  active: boolean;
  /** Seconds until the next poll; null while a poll request is in flight before the first sleep schedule. */
  nextCheckSec: number | null;
  /** Interval between polls in seconds (from last `onBeforeSleep`). */
  intervalSec: number | null;
  /** Shown in the footnote — Dogecoin block target, not the poll timer. */
  typicalBlockHintSec?: number;
  /** `doginals` matches amber / dark inscribe panels; `default` uses theme tokens (Dogetag, etc.). */
  variant?: 'default' | 'doginals';
  /** When explorers still show 0 conf but a block explorer may already show the tx mined. */
  explorerLagHint?: boolean;
  className?: string;
}

/**
 * Shared UX for “waiting for 1+ confirmations”: shows live countdown until the next explorer read
 * and explains why intervals differ (RPC vs browser-only).
 */
export function TxConfirmationPollProgress({
  active,
  nextCheckSec,
  intervalSec,
  typicalBlockHintSec = 60,
  variant = 'default',
  explorerLagHint = false,
  className,
}: TxConfirmationPollProgressProps) {
  if (!active) return null;

  const inCountdown = nextCheckSec !== null && nextCheckSec > 0;
  const dueNow = nextCheckSec !== null && nextCheckSec === 0;

  return (
    <Alert
      className={cn(
        'mt-2 border p-3 shadow-none',
        variant === 'doginals' &&
          'border-amber-500/25 bg-amber-500/10 text-amber-100 [&>svg]:text-amber-300',
        variant === 'default' && 'border-border bg-muted/40 text-foreground',
        className,
      )}
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      <AlertDescription
        className={cn(
          'space-y-1.5 pl-7 text-xs leading-snug',
          variant === 'doginals' && 'text-amber-100/95',
        )}
      >
        <div className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-medium">
          {inCountdown ? (
            <>
              Next explorer check in{' '}
              <span
                className={cn(
                  'tabular-nums',
                  variant === 'doginals' ? 'text-white' : 'text-foreground',
                )}
              >
                {nextCheckSec}s
              </span>
              {intervalSec != null ? (
                <>
                  {' '}
                  <span className="font-normal opacity-90">
                    (every{' '}
                    <span
                      className={cn(
                        'tabular-nums font-semibold',
                        variant === 'doginals' ? 'text-white' : 'text-foreground',
                      )}
                    >
                      {intervalSec}s
                    </span>
                    {' — '}
                    faster with Wallet → RPC + proxy; longer in the browser to avoid hammering free APIs)
                  </span>
                </>
              ) : null}
            </>
          ) : dueNow ? (
            <span className="font-normal">Next check due — querying indexers…</span>
          ) : (
            <span className="font-normal">Querying indexers for confirmations…</span>
          )}
        </div>
        {explorerLagHint ? (
          <p
            className={cn(
              'text-[10px] font-normal leading-snug',
              variant === 'doginals' && 'text-amber-200/85',
              variant === 'default' && 'text-muted-foreground',
            )}
          >
            If SoChain or your wallet already shows this tx mined, public APIs can lag — use{' '}
            <strong className={variant === 'doginals' ? 'text-amber-50' : 'text-foreground'}>Refresh chain status</strong>{' '}
            or wait for the countdown above.
          </p>
        ) : null}
        <p
          className={cn(
            'text-[10px] font-normal leading-snug opacity-90',
            variant === 'doginals' && 'text-amber-200/80',
            variant === 'default' && 'text-muted-foreground',
          )}
        >
          Dogecoin targets ~{typicalBlockHintSec}s blocks; first confirmation is often within one or two blocks and is
          not tied to this poll timer.
        </p>
      </AlertDescription>
    </Alert>
  );
}
