'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowUpRight,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Zap
} from 'lucide-react';
import { BrowserChipRow, InstallCta } from '../components/InstallCta';
import { BuilderSnippet } from '../components/BuilderSnippet';
import { CompareTable } from '../components/CompareTable';
import { FaqAccordion } from '../components/FaqAccordion';
import { FeatureScenes } from '../components/FeatureScenes';
import { HeroVideo } from '../components/HeroVideo';
import { ProtocolMarquee } from '../components/ProtocolMarquee';
import { SiteShell } from '../components/SiteShell';
import { StickyCta } from '../components/StickyCta';
import { WalletPopupMock } from '../components/WalletPopupMock';
import { CTA, Pill, SectionHeading, StatusBadge } from '../components/site-ui';
import { HOME_FAQS, LINKS } from '../lib/site';

const steps = [
  {
    n: '01',
    title: 'Install',
    body: 'Add Dojak from Chrome, Brave, or Edge. Side panel + popup — ready for Dogecoin L1.'
  },
  {
    n: '02',
    title: 'Create or import',
    body: 'Encrypted vault on-device. Seed or WIF. Multi-account. Keys never leave your browser.'
  },
  {
    n: '03',
    title: 'Approve every send',
    body: 'Sign DOGE, Doginals, DRC-20, or a PSBT on the surface that holds the keys.'
  },
  {
    n: '04',
    title: 'Browse the orbit',
    body: 'Inscribe, tip on 𝕏, trade, and connect dApps via window.dojak — open standards underneath.'
  }
];

const platforms = [
  {
    name: 'Browser Extension',
    badge: 'Live' as const,
    tone: 'live' as const,
    install: 'Chrome · Brave · Edge',
    body: 'Primary surface. Protocol-aware UTXO protection, Ð𝕏 tips, window.dojak connect.',
    cta: 'Install Extension',
    href: LINKS.chromeStore,
    primary: true
  },
  {
    name: 'Android',
    badge: 'Early Access' as const,
    tone: 'early' as const,
    install: 'Google Play',
    body: 'Mobile signing path in early access. Pair / approve flows expanding.',
    cta: 'Get Android',
    href: LINKS.android,
    primary: false
  },
  {
    name: 'iOS',
    badge: 'Coming Soon' as const,
    tone: 'soon' as const,
    install: 'App Store',
    body: 'Self-custodial mobile wallet on the release track. Join the waitlist.',
    cta: 'iOS Waitlist',
    href: LINKS.ios,
    primary: false
  },
  {
    name: 'Web Wallet',
    badge: 'Local-Only' as const,
    tone: 'local' as const,
    install: 'Browser demo',
    body: 'Local-first keys in the browser. Great for demos — extension remains primary.',
    cta: 'Open Web Demo',
    href: LINKS.webWallet,
    primary: false
  }
];

export default function HomePage() {
  return (
    <SiteShell>
      <StickyCta />

      {/* Hero */}
      <section className="relative isolate min-h-[min(92vh,900px)] overflow-hidden bg-zinc-950 text-white">
        <HeroVideo className="absolute inset-0" />
        <div className="relative z-10 mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-14 md:grid-cols-[1.1fr_0.9fr] md:items-center md:pb-20 md:pt-16">
          <div className="site-fade-up space-y-6">
            <Pill inverted>Flagship Dogecoin Wallet · Extension · Apps</Pill>
            <h1 className="font-display text-balance text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-[4.35rem]">
              The Dogecoin wallet{' '}
              <em className="font-serif font-normal not-italic text-[#D4A017] sm:italic">done right.</em>
            </h1>
            <p className="max-w-xl text-pretty text-base leading-7 text-zinc-200 md:text-lg">
              Self-custodial extension and apps for DOGE, Doginals, DRC-20, Dunes, and the full Dogenals stack.
              Protocol-aware spends. Tip on 𝕏. Connect any dApp with{' '}
              <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.9em]">window.dojak</code>.
            </p>
            <p className="font-serif text-lg italic text-zinc-300 md:text-xl">
              Add it. Own it. Browse free.
            </p>
            <div id="download">
              <InstallCta secondaryClassName="!border-white/40 !bg-white/10 !text-white hover:!border-[#D4A017] hover:!bg-[#D4A017]/20" />
            </div>
            <BrowserChipRow className="!text-zinc-400" />
            <p className="max-w-lg text-sm leading-6 text-zinc-400">
              Keys encrypted on your device. No custodial parking lot. Open standards at dogenals.org —
              open-source wallet on GitHub.
            </p>
          </div>

          <div className="site-fade-up-delay">
            <WalletPopupMock />
          </div>
        </div>
      </section>

      <ProtocolMarquee />

      {/* Trust strip */}
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-3 px-4 py-5 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 sm:grid-cols-2 lg:grid-cols-4">
          <span>Self-custody · on-device keys</span>
          <span>Protocol-aware UTXO protection</span>
          <span>Open standards · dogenals.org</span>
          <span>Pure Dogecoin L1 · no bridge</span>
        </div>
      </section>

      {/* Why */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <SectionHeading
          eyebrow="Why Dojak"
          title="Built for Dogecoin — not bolted onto Bitcoin UX."
          description="Most wallets treat Doginals like spare change. Dojak is protocol-native from the toolbar to coin selection."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: LockKeyhole,
              title: 'Safe Spend by default',
              body: 'Inscription- and offer-linked outs stay out of ordinary sends until you explicitly confirm.'
            },
            {
              icon: Zap,
              title: 'One provider for dApps',
              body: 'window.dojak for connect, sign, and send — the Dogecoin-native path across the orbit.'
            },
            {
              icon: Sparkles,
              title: 'Culture + standards',
              body: 'Open MIT protocols at dogenals.org. Flagship product UX that feels like Doge deserves.'
            }
          ].map((card) => (
            <article key={card.title} className="site-card site-card-hover p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-[#D4A017]/70 bg-[#D4A017]/10">
                <card.icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="text-lg font-bold">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="site-section-alt">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <SectionHeading
            eyebrow="Features"
            title="Everything you need. Nothing that can freeze your stack."
            description="Extension-first product surfaces — honest about what ships today and what is on the track."
          />
          <div className="mt-10">
            <FeatureScenes />
          </div>
        </div>
      </section>

      {/* Onboarding */}
      <section id="onboarding" className="mx-auto max-w-6xl px-4 py-20">
        <SectionHeading
          eyebrow="Get started"
          title="Four steps. Zero detours."
          description="Crystal-clear path from install to browsing the Dogecoin web — with keys where they belong."
        />
        <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <li key={step.n} className="site-card site-card-hover relative flex flex-col p-6">
              <span className="font-mono text-3xl font-black text-[#D4A017]/90">{step.n}</span>
              <h3 className="mt-3 text-lg font-bold">{step.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-zinc-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Compare */}
      <section className="site-section-alt">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <SectionHeading
            eyebrow="Compare"
            title="Not another generic crypto shell."
            description="Honest capability map versus generic self-custody wallets and custodial apps."
          />
          <div className="mt-10 overflow-x-auto">
            <div className="min-w-[640px]">
              <CompareTable />
            </div>
          </div>
        </div>
      </section>

      {/* Platforms */}
      <section id="platforms" className="mx-auto max-w-6xl px-4 py-20">
        <SectionHeading
          eyebrow="Multi-platform"
          title="One wallet. Every surface."
          description="Honest status. Real links. Extension is the front door today — mobile and web complete the orbit."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {platforms.map((item) => (
            <article key={item.name} className="site-card flex flex-col p-5">
              <StatusBadge tone={item.tone}>{item.badge}</StatusBadge>
              <h3 className="mt-4 text-xl font-bold">{item.name}</h3>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{item.install}</p>
              <p className="mt-3 flex-1 text-sm leading-6 text-zinc-600">{item.body}</p>
              <div className="mt-5">
                <CTA href={item.href} label={item.cta} primary={item.primary} className="w-full" />
              </div>
            </article>
          ))}
        </div>
        <div className="mt-8">
          <CTA href={LINKS.download} label="Open download hub →" />
        </div>
      </section>

      {/* Builders */}
      <section id="builders" className="site-section-alt">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-start">
            <div>
              <SectionHeading
                eyebrow="For builders"
                title="Plug into window.dojak"
                description={
                  <>
                    Detect <code className="site-code">isDojak</code>, request accounts, sign, push. Same
                    Dogecoin-native language across dogenals.com, dogecoin.games, and the orbit.
                  </>
                }
              />
              <div className="mt-6 flex flex-wrap gap-3">
                <CTA href={LINKS.developers} label="Developer docs" primary />
                <CTA href={LINKS.githubSpec} label="Open Dogenals Spec" />
                <CTA href="/dogenals" label="Protocol Wall" />
              </div>
            </div>
            <BuilderSnippet />
          </div>
        </div>
      </section>

      {/* Trust */}
      <section id="security" className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid gap-6 md:grid-cols-2">
          <article className="site-card p-8">
            <Pill>Trust model</Pill>
            <h3 className="mt-4 text-2xl font-bold">Self-custody. Open standards. No sleight of hand.</h3>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-zinc-600">
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A017]" />
                Keys never leave your device — extension vault or mobile.
              </li>
              <li className="flex gap-2">
                <Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A017]" />
                Protocol-aware spend safety for Doginals / Dogenals state.
              </li>
              <li className="flex gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A017]" />
                Open standards at dogenals.org · MIT wallet on GitHub.
              </li>
              <li className="flex gap-2">
                <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A017]" />
                Pure Dogecoin L1 — no bridge required for the core experience.
              </li>
            </ul>
            <div className="mt-6">
              <CTA href={LINKS.security} label="Read security details →" />
            </div>
          </article>
          <article className="site-card border-[#D4A017] bg-[#D4A017] p-8 text-zinc-950">
            <Pill inverted>Genesis · culture</Pill>
            <h3 className="mt-4 text-2xl font-bold">Built for the shibes.</h3>
            <p className="mt-4 font-mono text-3xl font-black">6,142,069</p>
            <p className="mt-1 text-sm text-zinc-800">Dogenals era activation context</p>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-zinc-800">
              <li>Much secure. Very based. Feels good man.</li>
              <li>X / Ðoge𝕏ID social-native identity path.</li>
              <li>Currency should be fun — and feel like yours.</li>
            </ul>
            <div className="mt-6 overflow-hidden rounded-xl border border-zinc-950/10 bg-white/40 p-3">
              <Image
                src="/brand/dojak.png"
                alt="Dojak Cheems mascot"
                width={480}
                height={480}
                className="mx-auto h-40 w-auto object-contain"
              />
            </div>
          </article>
        </div>

        <article className="mt-6 rounded-2xl border-2 border-[#D4A017] bg-[#D4A017]/5 p-8">
          <Pill>Safe Spend Policy</Pill>
          <h3 className="mt-4 text-2xl font-bold">Protocol-sensitive UTXOs are protected by default.</h3>
          <ul className="mt-5 grid gap-3 text-sm leading-6 text-zinc-600 md:grid-cols-2">
            <li>Tag protocol-linked UTXOs; exclude from default coin selection.</li>
            <li>Require explicit confirmation before spending sensitive outs.</li>
            <li>Human-readable warnings when a send could hit listings or inscriptions.</li>
            <li>
              Deterministic behavior aligned with <code className="site-code">dogenals.org</code>.
            </li>
          </ul>
        </article>
      </section>

      {/* FAQ */}
      <section id="faq" className="site-section-alt">
        <div className="mx-auto max-w-3xl px-4 py-20">
          <SectionHeading
            eyebrow="FAQ"
            title="Quick answers"
            description="Normie-friendly here. Deep details live in the technical FAQ."
          />
          <div className="mt-5">
            <CTA href="/faq" label="Open Technical FAQ" />
          </div>
          <div className="mt-8">
            <FaqAccordion items={HOME_FAQS} />
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="border-t border-zinc-200 bg-zinc-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <Image src="/icons/icon-96.png" alt="" width={72} height={72} className="mx-auto rounded-2xl" />
          <h2 className="mt-6 font-display text-3xl font-black tracking-tight md:text-5xl">
            Add it. Own it. Browse free.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-400">
            Install from your browser store. Keep keys on-device. Sign on the surface that holds them. One wallet.
            One orbit. Dogecoin without detours.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <CTA href={LINKS.download} label="Get Dojak" primary />
            <CTA
              href={LINKS.webWallet}
              label="Try Web Wallet"
              className="!border-white/30 !bg-transparent !text-white hover:!border-[#D4A017]"
            />
            <CTA
              href="/faq"
              label="Geek FAQ"
              className="!border-white/30 !bg-transparent !text-white hover:!border-[#D4A017]"
            />
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {[
              { href: LINKS.explorer, label: 'Ðexplorer' },
              { href: LINKS.dogenals, label: 'dogenals.org' },
              { href: LINKS.dogenalsCom, label: 'dogenals.com' },
              { href: '/dogenals', label: 'Protocol Wall' }
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                target={l.href.startsWith('http') ? '_blank' : undefined}
                rel={l.href.startsWith('http') ? 'noreferrer' : undefined}
                className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3.5 py-2 text-sm font-semibold text-zinc-200 transition hover:border-[#D4A017]"
              >
                {l.label}
                <ArrowUpRight className="h-3.5 w-3.5 text-zinc-500" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
