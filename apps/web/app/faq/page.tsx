import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Dojak Technical FAQ',
  description:
    'Deep technical FAQ for Dojak and Dogenals implementers: UTXO safety, protocol semantics, indexing, trust model, and interoperability details.'
};

const sections = [
  {
    title: 'Protocol + Standards',
    items: [
      {
        q: 'What is canonical when we say "Dogenals" on this site?',
        a: 'Canonical means the standards corpus published at dogenals.org. Product and UI language map to that standards tree.'
      },
      {
        q: 'Is Dojak itself the standard?',
        a: 'No. Dojak is a first-party proprietary wallet product implementation. The standard remains open and implementation-neutral at dogenals.org.'
      },
      {
        q: 'Are Dogenals protocols chain-native or bridge-dependent?',
        a: 'The standards target Dogecoin L1-native behavior. The core positioning is no bridge dependency for canonical state.'
      }
    ]
  },
  {
    title: 'UTXO Safety + Spending',
    items: [
      {
        q: 'Why can non-protocol-aware wallets be dangerous for users?',
        a: 'If a wallet treats all UTXOs as generic spendable coins, it can accidentally spend outputs carrying protocol-sensitive state (inscriptions, offers, metadata links, and related commitments).'
      },
      {
        q: 'What is Dojak Safe Spend Policy in practical terms?',
        a: 'Default coin selection excludes protocol-sensitive UTXOs, override paths require explicit confirmation, and send flows show impact warnings before signature steps.'
      },
      {
        q: 'Does this eliminate all user risk?',
        a: 'No wallet can eliminate all risk, but protocol-aware UTXO classification and explicit confirmations materially reduce accidental state-damaging spends.'
      }
    ]
  },
  {
    title: 'Indexer + Interoperability',
    items: [
      {
        q: 'How should indexers/wallets interoperate?',
        a: 'Independent implementations should follow normative rules and vectors at dogenals.org so separate indexers can converge on consistent protocol state.'
      },
      {
        q: 'Do users need to understand terms like UTXO/PSDT/DMP?',
        a: 'Normie flows should hide jargon. Advanced surfaces can expose these terms for power users, auditors, and builders.'
      },
      {
        q: 'What happens if standards evolve?',
        a: 'Because the standards are public, versioned, and reviewable, product behavior can evolve transparently while preserving independent implementation paths.'
      }
    ]
  },
  {
    title: 'Trust + Product Boundaries',
    items: [
      {
        q: 'Is this site trying to lock builders into one wallet?',
        a: 'No. The standards are intentionally open so anyone can build. The site positions Dojak as the flagship UX implementation, not the only valid implementation.'
      },
      {
        q: 'How should users interpret "open standards + proprietary app"?',
        a: 'The protocol layer is open/public; the product layer (design, integrations, delivery quality) is proprietary. This keeps interoperability open while shipping a polished first-party experience.'
      },
      {
        q: 'What is the audience split for content?',
        a: 'Homepage messaging is intentionally normie-first to onboard mainstream users. This technical FAQ exists for deep-dive readers, builders, and auditors.'
      }
    ]
  }
];

export default function TechnicalFaqPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-14">
        <Link href="/" className="text-sm font-semibold text-[#FCD34D] hover:underline">
          ← Back to Dojak Home
        </Link>
        <header className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FCD34D]">Technical FAQ</p>
          <h1 className="mt-3 text-balance text-4xl font-black md:text-5xl">Deep protocol details for power users</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            This page is the geek-mode companion to the normie-friendly homepage. All protocol references map to{' '}
            <code className="rounded bg-white/10 px-1 py-0.5 text-xs">dogenals.org</code>.
          </p>
        </header>

        <div className="mt-8 space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-2xl font-bold text-[#FCD34D]">{section.title}</h2>
              <div className="mt-4 space-y-4">
                {section.items.map((item) => (
                  <article key={item.q} className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <h3 className="text-sm font-semibold md:text-base">{item.q}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-300">{item.a}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
