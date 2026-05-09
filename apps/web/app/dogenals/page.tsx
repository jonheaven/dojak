import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Dojak Protocol Wall — Dogenals Flagship Wallet',
  description:
    'Dojak protocol wall: how the flagship wallet maps to open standards at dogenals.org across DMS, DMP, DWhisper, DX, and Dogecoin L1-native flows.'
};

const protocolRows = [
  {
    name: 'ÐMS',
    role: 'Portable metadata, attestations, richer asset context',
    walletSurface: 'Asset details, collection cards, wallet-level metadata rendering'
  },
  {
    name: 'ÐMP + DogeTag Offers',
    role: 'Marketplace intent signaling and settlement conventions',
    walletSurface: 'Offer notifications, listing actions, buy/sell UX hooks'
  },
  {
    name: 'ÐWhisper',
    role: 'Encrypted message signaling on Dogecoin',
    walletSurface: 'Private negotiation and message-center flows'
  },
  {
    name: 'Ð𝕏 / Ðoge𝕏ID direction',
    role: 'Optional social identity and reputation primitives',
    walletSurface: 'Connect X, profile badges, trust context'
  },
  {
    name: 'DogeTokens / DogeRelics families',
    role: 'Token + collectible protocol families under one standards umbrella',
    walletSurface: 'Unified portfolio and transaction UX'
  }
];

export default function DogenalsPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <Link href="/" className="text-sm font-semibold text-[#FCD34D] hover:underline">
          ← Back to Dojak Home
        </Link>

        <header className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FCD34D]">Protocol Wall</p>
          <h1 className="mt-3 text-balance text-4xl font-black md:text-5xl">Dojak x Dogenals: flagship wallet map</h1>
          <p className="mt-4 max-w-3xl text-zinc-300">
            Dogenals references here point to the canonical standards corpus at{' '}
            <code className="rounded bg-white/10 px-1 py-0.5 text-xs">dogenals.org</code>. Dojak is the first-party wallet product
            implementation layer built on that open protocol foundation.
          </p>
        </header>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">How protocol standards map to user experience</h2>
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-1 gap-px bg-white/10 md:grid-cols-3">
              <div className="bg-[#101010] p-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Standard</div>
              <div className="bg-[#101010] p-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Chain role</div>
              <div className="bg-[#101010] p-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Dojak surface</div>
            </div>
            {protocolRows.map((row) => (
              <div key={row.name} className="grid grid-cols-1 gap-px border-t border-white/10 md:grid-cols-3">
                <div className="bg-black/40 p-4 font-semibold text-[#FCD34D]">{row.name}</div>
                <div className="bg-black/30 p-4 text-sm text-zinc-300">{row.role}</div>
                <div className="bg-black/30 p-4 text-sm text-zinc-300">{row.walletSurface}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="text-xl font-semibold">Open standard commitment</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              The protocol rules remain open and implementation-neutral at dogenals.org, so any wallet, indexer, or marketplace can
              implement independently without private coordination.
            </p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="text-xl font-semibold">Flagship product commitment</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              Dojak is where the premium UX ships first: cross-platform consistency, faster feature cycles, and community-native product
              voice for Dogecoin users.
            </p>
          </article>
        </section>

        <section className="mt-8 rounded-2xl border border-[#F2A900]/35 bg-[#F2A900]/10 p-6">
          <h3 className="text-xl font-semibold text-[#FCD34D]">Why protocol-aware wallets are safer</h3>
          <p className="mt-3 text-sm leading-6 text-zinc-200">
            A wallet that does not understand Dogenals protocol semantics may treat all UTXOs as generic spendable outputs.
            That can accidentally spend UTXOs tied to inscriptions, metadata, listings, or signaling state. The flagship Dojak
            approach is to make protocol-sensitive outputs visible and protected in transaction-building flows.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="text-xl font-semibold">Safe Spend Policy (auditor-facing)</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">
            <li>• Default coin selection excludes UTXOs linked to Dogenals protocol state.</li>
            <li>• Override path requires explicit, contextual user confirmation.</li>
            <li>• Send builder surfaces impact warnings before signature requests.</li>
            <li>• Policy language maps to canonical standards behavior at <code className="rounded bg-white/10 px-1 py-0.5 text-xs">dogenals.org</code>.</li>
          </ul>
        </section>

        <section className="mt-10 rounded-3xl border border-[#F2A900]/30 bg-gradient-to-r from-[#F2A900]/10 via-[#FF8C42]/10 to-[#C084FC]/10 p-8 text-center">
          <h2 className="text-3xl font-black">Build on the open standard. Ship with flagship UX.</h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="https://dogenals.org"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-5 text-sm font-semibold hover:border-[#F2A900]/60"
            >
              Open Dogenals Spec
            </Link>
            <Link
              href="/#download"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-[#F2A900] to-[#FF8C42] px-5 text-sm font-bold text-black"
            >
              Get Dojak
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
