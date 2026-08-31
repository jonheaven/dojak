import Image from 'next/image';
import { ArrowDownLeft, ArrowUpRight, Image as ImageIcon, ShieldCheck } from 'lucide-react';

/** Marketing mock of the extension popup — not a live wallet. */
export function WalletPopupMock({ className = '' }: { className?: string }) {
  return (
    <div className={`relative mx-auto w-full max-w-[340px] ${className}`}>
      <div className="absolute -inset-6 rounded-[2rem] bg-[#D4A017]/15 blur-3xl" aria-hidden />
      <div className="relative overflow-hidden rounded-[1.35rem] border border-white/15 bg-zinc-950 shadow-[0_28px_80px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Image src="/icons/icon-32.png" alt="" width={22} height={22} className="rounded" />
            <div>
              <p className="text-xs font-bold text-white">Dojak</p>
              <p className="text-[10px] font-medium text-zinc-500">Main · Account 1</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Locked keys
          </span>
        </div>

        <div className="space-y-4 px-4 py-5">
          <div className="rounded-2xl bg-gradient-to-br from-[#D4A017] via-[#E0B33A] to-[#C49214] p-4 text-zinc-950">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-800/80">
              Total balance
            </p>
            <p className="mt-1 font-display text-3xl font-black tracking-tight">12,480 Ð</p>
            <p className="mt-0.5 text-sm font-medium text-zinc-800">Dogecoin L1 · self-custody</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Send', icon: ArrowUpRight },
              { label: 'Receive', icon: ArrowDownLeft },
              { label: 'Assets', icon: ImageIcon }
            ].map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2 py-3"
              >
                <item.icon className="h-4 w-4 text-[#D4A017]" aria-hidden />
                <span className="text-[11px] font-semibold text-zinc-200">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Portfolio</p>
            {[
              { name: 'DOGE', meta: 'Spendable', value: '11,920' },
              { name: 'Doginals', meta: '3 protected', value: '3' },
              { name: 'DRC-20', meta: '2 tickers', value: '2' }
            ].map((row) => (
              <div
                key={row.name}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-bold text-white">{row.name}</p>
                  <p className="text-[11px] text-zinc-500">{row.meta}</p>
                </div>
                <p className="font-mono text-sm font-semibold text-zinc-200">{row.value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-[#D4A017]/40 bg-[#D4A017]/10 px-3 py-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A017]" aria-hidden />
            <p className="text-[11px] leading-4 text-zinc-200">
              <span className="font-bold text-[#F0D078]">Safe Spend on</span> — inscription UTXOs excluded
              from default coin selection.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
