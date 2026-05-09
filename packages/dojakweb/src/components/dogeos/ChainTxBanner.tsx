'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { NetworkChainBadge } from './NetworkChainBadge';

type Chain = 'dogecoin' | 'dogeos';

export interface ChainTxBannerProps {
  chain: Chain;
  children: ReactNode;
  className?: string;
}

/** Prominent chain notice for transaction / signing surfaces (L1 gold vs DogeOS indigo). */
export function ChainTxBanner({ chain, children, className }: ChainTxBannerProps) {
  const l1 = chain === 'dogecoin';
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col gap-2 rounded-xl border px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3',
        l1
          ? 'border-amber-500/35 bg-gradient-to-r from-amber-950/50 to-zinc-950/80'
          : 'border-indigo-400/35 bg-gradient-to-r from-violet-950/45 to-sky-950/30',
        className,
      )}
    >
      <NetworkChainBadge network={chain} className="shrink-0" />
      <div className={cn('min-w-0 text-xs leading-relaxed', l1 ? 'text-amber-50/90' : 'text-indigo-100/90')}>
        {children}
      </div>
    </div>
  );
}
