import type { Metadata } from 'next';
import Link from 'next/link';
import { CTA, PageBack, PageHeader } from '../../components/site-ui';

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
    name: 'Ðignal',
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
    <main className="min-h-screen bg-white text-zinc-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 site-grid site-grid-fade" />
      <div className="relative mx-auto max-w-5xl px-4 py-14">
        <PageBack />
        <PageHeader
          eyebrow="Protocol Wall"
          title="Dojak × Dogenals: flagship wallet map"
          description={
            <>
              Dogenals references here point to the canonical standards corpus at{' '}
              <code className="site-code">dogenals.org</code>. Dojak is the first-party wallet product implementation
              layer built on that open protocol foundation.
            </>
          }
        />

        <section className="mt-10">
          <h2 className="text-2xl font-bold">How protocol standards map to user experience</h2>
          <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-200">
            <div className="hidden grid-cols-3 bg-[#D4A017] text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-950 md:grid">
              <div className="p-4">Standard</div>
              <div className="border-l border-zinc-950/10 p-4">Chain role</div>
              <div className="border-l border-zinc-950/10 p-4">Dojak surface</div>
            </div>
            {protocolRows.map((row, index) => (
              <div
                key={row.name}
                className={`grid grid-cols-1 gap-px md:grid-cols-3 ${index > 0 ? 'border-t border-zinc-200' : ''}`}
              >
                <div className="bg-zinc-50 p-4 font-bold md:bg-white">{row.name}</div>
                <div className="border-t border-zinc-200 p-4 text-sm text-zinc-600 md:border-l md:border-t-0">{row.role}</div>
                <div className="border-t border-zinc-200 p-4 text-sm text-zinc-600 md:border-l md:border-t-0">
                  {row.walletSurface}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <article className="site-card p-6">
            <h3 className="text-xl font-bold">Open standard commitment</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              The protocol rules remain open and implementation-neutral at dogenals.org, so any wallet, indexer, or
              marketplace can implement independently without private coordination.
            </p>
          </article>
          <article className="site-card border-[#D4A017] bg-[#D4A017] p-6 text-zinc-950">
            <h3 className="text-xl font-bold">Flagship product commitment</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-800">
              Dojak is where the premium UX ships first: cross-platform consistency, faster feature cycles, and
              community-native product voice for Dogecoin users.
            </p>
          </article>
        </section>

        <section className="mt-8 rounded-2xl border-2 border-[#D4A017] bg-[#D4A017]/5 p-6 md:p-8">
          <h3 className="text-xl font-bold">Why protocol-aware wallets are safer</h3>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            A wallet that does not understand Dogenals protocol semantics may treat all UTXOs as generic spendable outputs.
            That can accidentally spend UTXOs tied to inscriptions, metadata, listings, or signaling state. The flagship
            Dojak approach is to make protocol-sensitive outputs visible and protected in transaction-building flows.
          </p>
        </section>

        <section className="site-card mt-8 p-6 md:p-8">
          <h3 className="text-xl font-bold">Safe Spend Policy (auditor-facing)</h3>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-600">
            <li>Default coin selection excludes UTXOs linked to Dogenals protocol state.</li>
            <li>Override path requires explicit, contextual user confirmation.</li>
            <li>Send builder surfaces impact warnings before signature requests.</li>
            <li>
              Policy language maps to canonical standards behavior at{' '}
              <code className="site-code">dogenals.org</code>.
            </li>
          </ul>
        </section>

        <section className="mt-10 rounded-2xl border border-zinc-200 bg-zinc-50 p-8 text-center">
          <h2 className="text-2xl font-black md:text-3xl">Build on the open standard. Ship with flagship UX.</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="https://dogenals.org"
              target="_blank"
              rel="noreferrer"
              className="site-btn-secondary"
            >
              Open Dogenals Spec
            </Link>
            <CTA href="/#download" label="Get Dojak" primary />
          </div>
        </section>
      </div>
    </main>
  );
}
