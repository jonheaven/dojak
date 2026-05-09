import { cn } from '@/lib/utils';
import { useWalletStore } from '@/stores/walletStore';

/** Segmented control: Dogecoin L1 ↔ DogeOS (unified mode only). */
export function NetworkSwitcher({ className }: { className?: string }) {
  const dogeosEnabled = useWalletStore((s) => s.dogeosEnabled);
  const pureDogeosMode = useWalletStore((s) => s.pureDogeosMode);
  const currentNetwork = useWalletStore((s) => s.currentNetwork);
  const setCurrentNetwork = useWalletStore((s) => s.setCurrentNetwork);

  if (!dogeosEnabled || pureDogeosMode) return null;

  return (
    <div
      className={cn(
        'flex w-full max-w-xs rounded-full border border-white/15 bg-black/40 p-0.5 shadow-inner',
        className
      )}
      role="tablist"
      aria-label="Active chain"
    >
      {(['dogecoin', 'dogeos'] as const).map((id) => {
        const active = currentNetwork === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setCurrentNetwork(id)}
            className={cn(
              'flex-1 rounded-full px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide transition',
              active && id === 'dogecoin' && 'bg-gradient-to-r from-amber-500/90 to-orange-600/85 text-black shadow-sm',
              active && id === 'dogeos' && 'bg-gradient-to-r from-violet-600/95 to-sky-600/90 text-white shadow-sm',
              !active && 'text-white/45 hover:text-white/75'
            )}
          >
            {id === 'dogecoin' ? 'Dogecoin' : 'DogeOS'}
          </button>
        );
      })}
    </div>
  );
}
