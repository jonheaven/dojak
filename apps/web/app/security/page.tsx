import type { Metadata } from 'next';
import {
  Fingerprint,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  EyeOff,
  FileWarning
} from 'lucide-react';
import { SiteShell } from '../../components/SiteShell';
import { CTA, PageHeader, Pill } from '../../components/site-ui';
import { LINKS } from '../../lib/site';

export const metadata: Metadata = {
  title: 'Security — Dojak Wallet',
  description:
    'How Dojak keeps Dogecoin self-custodial: on-device encrypted keys, Safe Spend UTXO protection, explicit approvals, and open Dogenals standards.',
  alternates: { canonical: 'https://dojak.app/security' }
};

const pillars = [
  {
    icon: KeyRound,
    title: 'Keys never leave your device',
    body: 'Seed phrases and WIFs are encrypted in extension storage on your machine. We cannot export, freeze, or recover your funds. Uninstalling deletes the local vault — back up first.'
  },
  {
    icon: ShieldCheck,
    title: 'Safe Spend Policy',
    body: 'Protocol-linked UTXOs (inscriptions, listings, related state) are excluded from default coin selection. Override requires explicit confirmation with human-readable impact warnings.'
  },
  {
    icon: Fingerprint,
    title: 'Explicit approval every time',
    body: 'Connect, tip, send, and sign flows surface clear prompts. Connected-site permissions are revocable. Nothing silent-signs in the background.'
  },
  {
    icon: EyeOff,
    title: 'No seed on our servers',
    body: 'Dojak does not run user accounts, KYC, or custodial balances. Indexer and broadcast APIs see public chain queries you trigger — never your mnemonic.'
  }
];

export default function SecurityPage() {
  return (
    <SiteShell>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 site-grid site-grid-fade" />
      <div className="relative mx-auto max-w-5xl px-4 py-14">
        <PageHeader
          eyebrow="Security"
          title="Self-custody with protocol-aware guards"
          description="Dogecoin inscriptions break naive wallets. Dojak is designed so a normal send cannot quietly eat a Doginal — while keeping you in sole control of the keys."
        />

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          {pillars.map((item) => (
            <article key={item.title} className="site-card p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-[#D4A017]/70 bg-[#D4A017]/10">
                <item.icon className="h-5 w-5" aria-hidden />
              </div>
              <h2 className="text-lg font-bold">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{item.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border-2 border-[#D4A017] bg-[#D4A017]/5 p-6 md:p-8">
          <Pill>Safe Spend · auditor view</Pill>
          <h2 className="mt-4 text-2xl font-bold">What “protocol-aware” means in practice</h2>
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

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="site-card p-6">
            <div className="mb-3 flex items-center gap-2 text-[#A67C0F]">
              <ShieldAlert className="h-5 w-5" />
              <h2 className="text-lg font-bold text-zinc-950">What we cannot promise</h2>
            </div>
            <p className="text-sm leading-6 text-zinc-600">
              No wallet eliminates phishing, malware, or user error. Always verify addresses, dApp origins, and
              fee amounts. Back up your seed offline. Never paste it into a website — including ones that look like
              Dojak.
            </p>
          </article>
          <article className="site-card p-6">
            <div className="mb-3 flex items-center gap-2 text-[#A67C0F]">
              <FileWarning className="h-5 w-5" />
              <h2 className="text-lg font-bold text-zinc-950">Open standard · open-source wallet</h2>
            </div>
            <p className="text-sm leading-6 text-zinc-600">
              Protocol rules are public at dogenals.org. Dojak is MIT-licensed at github.com/jonheaven/dojak —
              auditors can compare wallet bytes to the published spec.
            </p>
          </article>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <CTA href={LINKS.download} label="Install Dojak" primary />
          <CTA href="/privacy" label="Privacy Policy" />
          <CTA href="/faq" label="Technical FAQ" />
          <CTA href={LINKS.dogenals} label="dogenals.org" />
        </div>
      </div>
    </SiteShell>
  );
}
