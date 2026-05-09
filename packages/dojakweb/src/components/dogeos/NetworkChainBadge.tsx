import { cn } from '@/lib/utils';

type Network = 'dogecoin' | 'dogeos';

export interface NetworkChainBadgeProps {
  network: Network;
  className?: string;
  label?: string;
}

/** Prominent chain pill: gold for Dogecoin L1, blue/violet for DogeOS. */
export function NetworkChainBadge({ network, className, label }: NetworkChainBadgeProps) {
  const isL1 = network === 'dogecoin';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]',
        isL1
          ? 'border-amber-400/50 bg-gradient-to-r from-amber-500/25 to-orange-600/20 text-amber-100'
          : 'border-indigo-400/45 bg-gradient-to-r from-violet-600/30 to-sky-500/25 text-indigo-100',
        className
      )}
    >
      <span
        className={cn('h-2 w-2 shrink-0 rounded-full', isL1 ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]' : 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.85)]')}
        aria-hidden
      />
      {label ?? (isL1 ? 'Dogecoin L1' : 'DogeOS')}
    </span>
  );
}
