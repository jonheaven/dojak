import type { Metadata } from 'next';
import Link from 'next/link';
import { CTA, PageBack, PageHeader } from '../../components/site-ui';

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
    <main className="min-h-screen bg-white text-zinc-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 site-grid site-grid-fade" />
      <div className="relative mx-auto max-w-4xl px-4 py-14">
        <PageBack />
        <PageHeader
          eyebrow="Technical FAQ"
          title="Deep protocol details for power users"
          description={
            <>
              Geek-mode companion to the normie-friendly homepage. All protocol references map to{' '}
              <code className="site-code">dogenals.org</code>.
            </>
          }
        />

        <div className="mt-10 space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="site-card p-6 md:p-8">
              <h2 className="text-xl font-bold md:text-2xl">{section.title}</h2>
              <div className="mt-5 space-y-3">
                {section.items.map((item) => (
                  <article key={item.q} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 md:p-5">
                    <h3 className="text-sm font-bold md:text-base">{item.q}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">{item.a}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <CTA href="/" label="Back to Home" primary />
          <CTA href="/dogenals" label="Protocol Wall" />
        </div>
      </div>
    </main>
  );
}
