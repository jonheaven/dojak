import { Check, Minus, X } from 'lucide-react';

type Cell = 'yes' | 'no' | 'partial';

const rows: Array<{ feature: string; dojak: Cell; generic: Cell; custodial: Cell }> = [
  { feature: 'Self-custody keys', dojak: 'yes', generic: 'yes', custodial: 'no' },
  { feature: 'Native Dogecoin L1', dojak: 'yes', generic: 'partial', custodial: 'partial' },
  { feature: 'Doginals / inscription awareness', dojak: 'yes', generic: 'no', custodial: 'partial' },
  { feature: 'Protocol-aware UTXO protection', dojak: 'yes', generic: 'no', custodial: 'no' },
  { feature: 'DRC-20 · Dunes · Alkanes', dojak: 'yes', generic: 'no', custodial: 'partial' },
  { feature: 'Ð𝕏 tip + profile bind on 𝕏', dojak: 'yes', generic: 'no', custodial: 'no' },
  { feature: 'window.dojak dApp provider', dojak: 'yes', generic: 'no', custodial: 'no' },
  { feature: 'Open Dogenals standards', dojak: 'yes', generic: 'no', custodial: 'no' }
];

function CellIcon({ value }: { value: Cell }) {
  if (value === 'yes') return <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Yes" />;
  if (value === 'partial') return <Minus className="mx-auto h-4 w-4 text-amber-600" aria-label="Partial" />;
  return <X className="mx-auto h-4 w-4 text-zinc-400" aria-label="No" />;
}

export function CompareTable() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-card">
      <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] border-b border-zinc-200 bg-zinc-50 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">
        <div className="px-4 py-3">Capability</div>
        <div className="border-l border-zinc-200 px-2 py-3 text-center text-[#A67C0F]">Dojak</div>
        <div className="border-l border-zinc-200 px-2 py-3 text-center">Generic wallet</div>
        <div className="border-l border-zinc-200 px-2 py-3 text-center">Custodial app</div>
      </div>
      {rows.map((row, i) => (
        <div
          key={row.feature}
          className={`grid grid-cols-[1.4fr_1fr_1fr_1fr] text-sm ${
            i > 0 ? 'border-t border-zinc-100' : ''
          }`}
        >
          <div className="px-4 py-3.5 font-medium text-zinc-800">{row.feature}</div>
          <div className="border-l border-zinc-100 bg-[#D4A017]/5 px-2 py-3.5">
            <CellIcon value={row.dojak} />
          </div>
          <div className="border-l border-zinc-100 px-2 py-3.5">
            <CellIcon value={row.generic} />
          </div>
          <div className="border-l border-zinc-100 px-2 py-3.5">
            <CellIcon value={row.custodial} />
          </div>
        </div>
      ))}
    </div>
  );
}
