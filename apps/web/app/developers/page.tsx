import type { Metadata } from 'next';
import { BuilderSnippet } from '../../components/BuilderSnippet';
import { SiteShell } from '../../components/SiteShell';
import { CTA, PageHeader, Pill } from '../../components/site-ui';
import { LINKS } from '../../lib/site';

export const metadata: Metadata = {
  title: 'Developers — window.dojak Provider',
  description:
    'Integrate Dojak Wallet into Dogecoin dApps: detect isDojak, requestAccounts, signPsbt, sendBitcoin, sendInscription. Open standards at dogenals.org.',
  alternates: { canonical: 'https://dojak.app/developers' }
};

const methods = [
  {
    name: 'window.dojak.isDojak',
    detail: 'Boolean presence check before prompting the user.'
  },
  {
    name: 'requestAccounts()',
    detail: 'Ask the user to connect. Returns Dogecoin addresses after approval.'
  },
  {
    name: 'signPsbt(psbtHex)',
    detail: 'Request a PSBT signature from the vault that holds the keys.'
  },
  {
    name: 'sendBitcoin(to, satoshis)',
    detail: 'Native DOGE send with explicit fee / confirmation UI.'
  },
  {
    name: 'sendInscription(...)',
    detail: 'Transfer Doginals with protocol-aware coin selection and warnings.'
  },
  {
    name: 'signMessage(...)',
    detail: 'Prove address ownership for login / attestations.'
  }
];

export default function DevelopersPage() {
  return (
    <SiteShell>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 site-grid site-grid-fade" />
      <div className="relative mx-auto max-w-5xl px-4 py-14">
        <PageHeader
          eyebrow="Developers"
          title="Dogecoin-native dApp connect"
          description={
            <>
              Detect <code className="site-code">window.dojak</code>, request accounts, sign, and push. Users approve
              from the extension or mobile surface that holds the keys.
            </>
          }
        />

        <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.05fr] lg:items-start">
          <div>
            <Pill>Quick start</Pill>
            <h2 className="mt-4 text-2xl font-bold">Copy-paste provider snippet</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Same pattern across dogenals.com, dogecoin.games, and first-party orbit apps. Prefer the injected
              provider over asking users to paste seeds into your site.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <CTA href={LINKS.githubSpec} label="Dogenals Spec" primary />
              <CTA href="/dogenals" label="Protocol Wall" />
              <CTA href={LINKS.dogenals} label="dogenals.org" />
            </div>
          </div>
          <BuilderSnippet />
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold">Provider surface</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {methods.map((m) => (
              <article key={m.name} className="site-card p-5">
                <code className="font-mono text-sm font-bold text-zinc-950">{m.name}</code>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{m.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <article className="site-card p-6">
            <h3 className="text-xl font-bold">Open standard commitment</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Protocol rules remain open and implementation-neutral at dogenals.org. Any wallet or indexer can
              implement independently — Dojak is the flagship UX, not a private dialect.
            </p>
          </article>
          <article className="site-card border-[#D4A017] bg-[#D4A017] p-6 text-zinc-950">
            <h3 className="text-xl font-bold">First-party embed</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-800">
              Studio apps may embed <code className="rounded bg-black/10 px-1">@dojak/web</code> for in-page vault
              UX. Third parties should implement against the public spec and detect{' '}
              <code className="rounded bg-black/10 px-1">window.dojak</code> from the extension.
            </p>
          </article>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <CTA href={LINKS.download} label="Install extension to test" primary />
          <CTA href="/faq" label="Technical FAQ" />
        </div>
      </div>
    </SiteShell>
  );
}
