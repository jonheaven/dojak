'use client';

import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  PROVIDER_LABELS,
  type BroadcastAttemptUpdate,
} from '@/lib/broadcast/doge-chain-broadcast';

export interface BroadcastRelayAttemptsProps {
  attempts: BroadcastAttemptUpdate[];
  /** Card heading; with `embedded`, rendered as a small section label. */
  title?: string;
  /** `doginals`: amber file-inscribe theme. `default`: shadcn semantic tokens for Dogetag / light surfaces. */
  variant?: 'default' | 'doginals';
  /**
   * `archived` — tx is already settled on-chain; relay rows are a muted log (emphasis moves to confirmations elsewhere).
   */
  tone?: 'standard' | 'archived';
  /** Tighter spacing and smaller type (e.g. Dogetag CPFP details). */
  dense?: boolean;
  /**
   * No outer Card — use inside an existing panel (inscribe stage row, etc.).
   */
  embedded?: boolean;
  className?: string;
}

function providerBadgeClass(variant: 'default' | 'doginals', archived: boolean): string {
  if (archived) {
    return variant === 'doginals'
      ? 'border-white/12 bg-white/[0.04] text-white/45 shadow-none'
      : 'border-border/60 bg-muted/30 text-muted-foreground shadow-none';
  }
  if (variant === 'doginals') {
    return 'border-amber-400/35 bg-amber-400/10 text-amber-100 shadow-none';
  }
  return 'font-medium shadow-none';
}

/**
 * One consistent relay row for Tatum, Blockchair, BlockCypher, or local RPC — same copy and layout everywhere.
 */
export function BroadcastRelayAttempts({
  attempts,
  title = 'Broadcast relays',
  variant = 'default',
  tone = 'standard',
  dense,
  embedded,
  className,
}: BroadcastRelayAttemptsProps) {
  if (!attempts.length) return null;

  const archived = tone === 'archived';

  const body = (
    <ul className={cn('m-0 list-none space-y-3 p-0', dense && 'space-y-2', archived && dense && 'space-y-1.5')}>
      {attempts.map((a) => (
        <li key={a.provider} className="min-w-0">
          <div className="flex flex-wrap items-start gap-2">
            <Badge
              variant="outline"
              className={cn(
                'shrink-0',
                providerBadgeClass(variant, archived),
                dense && 'px-1.5 py-0 text-[10px]',
                archived && 'text-[10px]',
              )}
            >
              {PROVIDER_LABELS[a.provider]}
            </Badge>
            <div className="min-w-0 flex-1 space-y-1">
              {a.status === 'trying' && (
                <div
                  className={cn(
                    'flex items-center gap-2 text-sm',
                    dense && 'text-xs',
                    variant === 'doginals' ? 'text-amber-100/90' : 'text-muted-foreground',
                  )}
                >
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin opacity-80" aria-hidden />
                  <span>Contacting relay…</span>
                </div>
              )}
              {a.status === 'verifying' && (
                <div
                  className={cn(
                    'flex items-center gap-2 text-sm',
                    dense && 'text-xs',
                    variant === 'doginals' ? 'text-amber-100/90' : 'text-muted-foreground',
                  )}
                >
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin opacity-80" aria-hidden />
                  <span>Verifying propagation (mempool / explorers)…</span>
                </div>
              )}
              {(a.status === 'success' || a.status === 'already_exists') && (
                <div
                  className={cn(
                    'space-y-1',
                    archived ? 'text-[11px] leading-snug' : 'text-sm',
                    dense && !archived && 'text-xs',
                    archived
                      ? variant === 'doginals'
                        ? 'text-white/45'
                        : 'text-muted-foreground'
                      : variant === 'doginals'
                        ? 'text-emerald-200/95'
                        : 'text-emerald-700 dark:text-emerald-300',
                  )}
                >
                  <div className="flex items-start gap-1.5">
                    {!archived ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    ) : null}
                    <span>
                      {archived ? (
                        <>
                          Relay used at broadcast: {PROVIDER_LABELS[a.provider]}
                          {a.status === 'already_exists' ? ' (tx was already known to the network)' : ''}.
                        </>
                      ) : (
                        <>
                          Successfully broadcast
                          {a.status === 'already_exists' ? ' (transaction already on the network)' : ''}.
                        </>
                      )}
                    </span>
                  </div>
                  {a.txid ? (
                    <code
                      className={cn(
                        'block w-full break-all rounded-md border font-mono leading-relaxed',
                        archived ? 'px-1.5 py-1 text-[10px]' : 'px-2 py-1.5 text-[11px]',
                        archived
                          ? variant === 'doginals'
                            ? 'border-white/[0.08] bg-black/20 text-white/40'
                            : 'border-border/50 bg-muted/20 text-muted-foreground'
                          : variant === 'doginals'
                            ? 'border-white/10 bg-black/30 text-white/85'
                            : 'border-border bg-background/80 text-foreground',
                      )}
                    >
                      {a.txid}
                    </code>
                  ) : null}
                  {a.relayTxidMismatch ? (
                    <Alert
                      variant="default"
                      className={cn(
                        'border py-2 pr-2 shadow-none',
                        variant === 'doginals'
                          ? 'border-amber-400/35 bg-amber-500/10 text-amber-50 [&>svg]:text-amber-300'
                          : 'border-amber-500/40 bg-amber-500/[0.07] text-foreground [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400',
                        dense && 'py-1.5',
                      )}
                    >
                      <AlertCircle className="h-4 w-4" aria-hidden />
                      <AlertTitle className="mb-0 text-xs font-semibold">Txid corrected</AlertTitle>
                      <AlertDescription className="text-xs opacity-95">
                        The relay’s txid field did not match the hash of your signed hex; the id above is from your transaction bytes.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  {a.propagationUnverified ? (
                    <Alert
                      variant="default"
                      className={cn(
                        'border py-2 pr-2 shadow-none',
                        variant === 'doginals'
                          ? 'border-amber-400/35 bg-amber-500/10 text-amber-50 [&>svg]:text-amber-300'
                          : 'border-amber-500/40 bg-amber-500/[0.07] text-foreground [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400',
                        dense && 'py-1.5',
                      )}
                    >
                      <AlertCircle className="h-4 w-4" aria-hidden />
                      <AlertTitle className="mb-0 text-xs font-semibold">Not visible yet</AlertTitle>
                      <AlertDescription className="text-xs opacity-95">
                        Indexers still did not show this tx after waiting — it may appear shortly, or nodes may have dropped it. Try broadcasting via RPC or another relay if it stays missing.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              )}
              {a.status === 'failed' && (
                <Alert variant="destructive" className="border py-2 pr-2 shadow-none">
                  <AlertCircle className="h-4 w-4" aria-hidden />
                  <AlertTitle className="mb-0 text-xs font-semibold">Relay failed</AlertTitle>
                  <AlertDescription className="text-xs opacity-95">{a.error ?? 'Unknown error'}</AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );

  if (embedded) {
    return (
      <div
        className={cn(
          'space-y-2',
          variant === 'doginals' && !archived && 'text-amber-50',
          archived && 'opacity-95',
          className,
        )}
      >
        {title ? (
          <h4
            className={cn(
              'font-semibold uppercase tracking-wide',
              archived ? 'text-[10px] text-white/35' : 'text-[11px]',
              !archived && variant === 'doginals' && 'text-white/45',
              !archived && variant === 'default' && 'text-muted-foreground',
              archived && variant === 'default' && 'text-[11px] text-muted-foreground',
            )}
          >
            {archived ? 'Broadcast log' : title}
          </h4>
        ) : null}
        {body}
      </div>
    );
  }

  return (
    <Card
      className={cn(
        'shadow-none',
        variant === 'doginals' &&
          !archived &&
          'border-amber-500/25 bg-amber-950/35 text-amber-50 dark:bg-amber-950/40',
        variant === 'doginals' &&
          archived &&
          'border-white/10 bg-black/25 text-white/70',
        variant === 'default' && 'border-border bg-card',
        archived && variant === 'default' && 'bg-muted/25',
        dense && 'gap-0 py-0',
        className,
      )}
    >
      <CardHeader className={cn(dense ? 'space-y-0 px-3 pb-2 pt-3' : 'pb-3')}>
        <CardTitle
          className={cn(
            'text-base',
            dense && 'text-xs font-semibold uppercase tracking-wide',
            archived && 'text-xs text-muted-foreground',
            !archived && variant === 'doginals' && 'text-amber-100',
            !archived && variant === 'default' && 'text-card-foreground',
          )}
        >
          {archived ? 'Broadcast log' : title}
        </CardTitle>
      </CardHeader>
      <CardContent className={cn(dense ? 'space-y-0 px-3 pb-3 pt-0' : 'pt-0')}>{body}</CardContent>
    </Card>
  );
}
