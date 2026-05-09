import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export interface BalanceCardProps {
  title: string;
  subtitle?: string;
  amountDisplay: string;
  icon: ReactNode;
  variant: 'l1' | 'dogeos';
  className?: string;
}

/** Premium balance card for L1 or DogeOS (shadcn Card). */
export function BalanceCard({ title, subtitle, amountDisplay, icon, variant, className }: BalanceCardProps) {
  const l1 = variant === 'l1';
  return (
    <Card
      className={cn(
        'overflow-hidden border shadow-md transition-shadow hover:shadow-lg',
        l1
          ? 'border-amber-500/25 bg-gradient-to-br from-amber-950/40 via-zinc-950 to-zinc-950'
          : 'border-indigo-500/30 bg-gradient-to-br from-violet-950/50 via-zinc-950 to-sky-950/30',
        className
      )}
    >
      <CardContent className="space-y-2 p-4 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">{title}</p>
            {subtitle ? <p className="mt-0.5 text-[11px] text-white/40">{subtitle}</p> : null}
          </div>
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
              l1 ? 'border-amber-400/30 bg-amber-500/15 text-amber-200' : 'border-indigo-400/35 bg-indigo-500/15 text-indigo-100'
            )}
          >
            {icon}
          </div>
        </div>
        <p className="font-mono text-lg font-semibold tracking-tight text-white">{amountDisplay}</p>
      </CardContent>
    </Card>
  );
}
