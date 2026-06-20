'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowUpRight,
  Gauge,
  LockKeyhole,
  Menu,
  ShieldCheck,
  Sparkles,
  Smartphone,
  UserRound,
  X,
  Zap
} from 'lucide-react';
import { DojakMascot } from '../components/DojakMascot';
import { CTA, Pill } from '../components/site-ui';

type NavLink = { href: string; label: string };

const navLinks: NavLink[] = [
  { href: '#features', label: 'Features' },
  { href: '#dogenals', label: 'Dogenals' },
  { href: '/dogenals', label: 'Protocol Wall' },
  { href: '#platforms', label: 'Platforms' },
  { href: '#security', label: 'Security' }
];

const featureCards = [
  {
    title: 'Self-custodial by default',
    body: 'Local-first key flows. Your seed and signing stay with you, never on our servers.',
    icon: ShieldCheck
  },
  {
    title: 'Dogenals-native UX',
    body: 'Built for Dogecoin L1 standards from dogenals.org, not generic cross-chain abstractions.',
    icon: Zap
  },
  {
    title: 'Built-in X identity',
    body: 'Connect your handle to on-chain profile and reputation primitives for social-native wallet experiences.',
    icon: UserRound
  },
  {
    title: 'One wallet, many form factors',
    body: 'Browser extension, mobile apps, and web wallet with a coherent product language.',
    icon: Smartphone
  },
  {
    title: 'Fast indexer era',
    body: 'Designed for the Dogenals reboot and high-signal data surfaces across tags, offers, and metadata.',
    icon: Gauge
  },
  {
    title: 'Protocol-aware UTXO safety',
    body: 'Dogenals-aware spend controls help avoid accidentally spending UTXOs tied to inscriptions, offers, or other protocol state.',
    icon: LockKeyhole
  },
  {
    title: 'Open standards + private product',
    body: 'The protocol layer is public; the Dojak app layer is proprietary and polished for production.',
    icon: Sparkles
  }
];

const platformCards = [
  {
    name: 'Browser Extension',
    cta: 'Install Extension',
    href: 'https://chromewebstore.google.com/',
    badge: 'Live',
    install: 'Chrome Web Store',
    safety: 'Protocol-aware UTXO protection + self-custody',
    status: 'Best for most users right now'
  },
  {
    name: 'iOS',
    cta: 'Get iOS App',
    href: 'https://apps.apple.com/',
    badge: 'Coming Soon',
    install: 'Apple App Store',
    safety: 'Self-custodial mobile wallet architecture',
    status: 'Join waitlist / release track'
  },
  {
    name: 'Android',
    cta: 'Get Android App',
    href: 'https://play.google.com/store/apps',
    badge: 'Early Access',
    install: 'Google Play',
    safety: 'Self-custodial + protocol-aware spend flow',
    status: 'Use now in early access'
  },
  {
    name: 'Web Wallet',
    cta: 'Try Web Wallet',
    href: '#',
    badge: 'Local-Only Mode',
    install: 'No install needed',
    safety: 'Local-first key handling in browser',
    status: 'Quick onboarding and recovery flows'
  }
];

const statCards = [
  { label: 'Genesis block', value: '6,142,069', note: 'Dogenals era activation point' },
  { label: 'Core protocols', value: '15+', note: 'ÐMS, ÐMP, Ðignal, Ð𝕏 and more' },
  { label: 'Chain model', value: 'Dogecoin L1', note: 'No bridge, no wrapped dependency' },
  { label: 'Spec source', value: 'dogenals.org', note: 'Canonical standards tree' }
];

const faqs = [
  {
    question: 'Is Dojak open source?',
    answer:
      'Dogenals standards at dogenals.org are open and MIT-licensed. Dojak wallet apps are proprietary products implementing those standards.'
  },
  {
    question: 'How is this different from generic multi-chain wallets?',
    answer:
      'Dojak is intentionally Dogecoin-native and Dogenals-native, with product decisions tuned for Doge users, social behavior, and inscriptions.'
  },
  {
    question: 'Does the web wallet hold server-side keys?',
    answer:
      'No. The web wallet flow is local-first and self-custodial. Signing and private material stay client-side.'
  },
  {
    question: 'Why does protocol support matter for wallet safety?',
    answer:
      'Wallets that are not Dogenals-aware can treat all UTXOs as generic spendable coins, which risks unintentionally spending protocol-linked outputs. Dojak is built to surface and protect protocol-sensitive UTXOs in user flows.'
  },
  {
    question: 'What does X identity mean here?',
    answer:
      'It maps to the Ð𝕏 ecosystem direction: optional handle-linked identity and reputation primitives for safer social interactions.'
  }
];

export default function HomePage() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [faqOpen, setFaqOpen] = useState(0);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-white text-zinc-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] site-grid site-grid-fade hero-glow" />

      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2.5 text-lg font-black tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-[#D4A017] bg-[#D4A017]/10">
              <span className="text-xs font-black text-zinc-950">Ð</span>
            </span>
            Dojak
          </Link>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 md:hidden"
            onClick={() => setMobileMenu((prev) => !prev)}
            aria-expanded={mobileMenu}
            aria-label="Toggle menu"
          >
            {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="site-link text-sm font-medium"
              >
                {item.label}
              </Link>
            ))}
            <CTA href="#download" label="Get Dojak" primary />
          </nav>
        </div>
        {mobileMenu ? (
          <div className="border-t border-zinc-200 px-4 py-4 md:hidden">
            <div className="mx-auto flex max-w-6xl flex-col gap-2">
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenu(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  {item.label}
                </Link>
              ))}
              <div className="pt-2">
                <CTA href="#download" label="Get Dojak" primary />
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <section className="relative mx-auto grid min-h-[85vh] max-w-6xl gap-12 px-4 py-16 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-24">
        <div className="space-y-7">
          <Pill>Flagship Dogenals Wallet</Pill>
          <h1 className="text-balance text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
            The wallet Doge deserves.
            <span className="mt-2 block font-serif italic font-normal text-zinc-500">
              Black and white. Self-custodial. Protocol-native.
            </span>
          </h1>
          <p className="max-w-xl text-pretty text-base leading-7 text-zinc-600 md:text-lg">
            Dojak is the Dogecoin wallet for the Dogenals era — simple for normies, powerful for pros, and safe for
            protocol-aware UTXO spending. Built on open standards from{' '}
            <code className="site-code">dogenals.org</code>.
          </p>
          <div id="download" className="flex flex-wrap gap-3">
            <CTA href="https://chromewebstore.google.com/" label="Install Extension" primary />
            <CTA href="#" label="Try Web Wallet" />
            <CTA href="https://play.google.com/store/apps" label="Android" />
            <CTA href="https://apps.apple.com/" label="iOS" />
          </div>
          <p className="text-sm text-zinc-500">
            Self-custodial · Protocol-aware safety · Dogecoin L1 native · X-linked reputation
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-[400px]">
          <div className="site-card overflow-hidden p-6 md:p-8">
            <div className="mascot-float mx-auto flex h-52 w-52 items-center justify-center rounded-full border-2 border-[#D4A017] bg-white text-zinc-950 shadow-[0_0_0_8px_rgba(212,160,23,0.08)]">
              <DojakMascot className="h-44 w-44" />
            </div>
            <div className="mt-6 space-y-2.5">
              {[
                'Connect X → claim shibe status',
                'Inscribe, trade, and manage Dogenals',
                'Your keys. Your Dojak. Your chain.'
              ].map((line) => (
                <div
                  key={line}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-800"
                >
                  <span>{line}</span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="site-section-alt">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 sm:grid-cols-2 lg:grid-cols-4">
          <span>Open standards: dogenals.org</span>
          <span>No server sees your seed</span>
          <span>Protocol-aware UTXO protection</span>
          <span>Dogecoin L1 native</span>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-20">
        <div className="max-w-2xl">
          <Pill>Core Product Value</Pill>
          <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">Premium wallet UX. Pure Doge energy.</h2>
          <p className="mt-3 text-zinc-600">Clean interface, serious security, built for the chain you actually use.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((item) => (
            <article key={item.title} className="site-card site-card-hover p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-[#D4A017]/70 bg-[#D4A017]/10">
                <item.icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="text-lg font-bold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="dogenals" className="site-section-alt">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <Pill>Dogenals</Pill>
          <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">Rebooted for 2026.</h2>
          <p className="mt-3 max-w-3xl text-zinc-600">
            The standards tree at <code className="site-code">dogenals.org</code> defines the chain contract. Dojak ships
            a polished implementation layer on top: fast indexing, social-native identity surfaces, and streamlined flows
            for tags, offers, and collectables.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statCards.map((item) => (
              <article key={item.label} className="site-card p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{item.label}</p>
                <p className="mt-2 font-mono text-2xl font-black text-[#A67C0F]">{item.value}</p>
                <p className="mt-1 text-sm text-zinc-600">{item.note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="platforms" className="mx-auto max-w-6xl px-4 py-20">
        <Pill>Multi-Platform</Pill>
        <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">One wallet. Every surface.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {platformCards.map((item) => (
            <article key={item.name} className="site-card flex flex-col p-5">
              <span className="inline-flex w-fit rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                {item.badge}
              </span>
              <h3 className="mt-4 text-xl font-bold">{item.name}</h3>
              <div className="mt-3 flex-1 space-y-2 text-sm text-zinc-600">
                <p>
                  <span className="font-semibold text-zinc-950">Install:</span> {item.install}
                </p>
                <p>
                  <span className="font-semibold text-zinc-950">Safety:</span> {item.safety}
                </p>
                <p>
                  <span className="font-semibold text-zinc-950">Works now:</span> {item.status}
                </p>
              </div>
              <div className="mt-5">
                <CTA href={item.href} label={item.cta} primary={item.name === 'Browser Extension'} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="site-section-alt">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <Pill>Why Switch Now</Pill>
          <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">Don&apos;t get stranded on legacy rails.</h2>
          <p className="mt-4 max-w-3xl text-zinc-600">
            Existing ecosystem wallets helped spark adoption, but the standards era is moving fast. Dojak is where the
            flagship Dogenals protocol wallet experience is being shaped: new spec alignment, modern UX, and first-party
            velocity.
          </p>
          <p className="mt-3 max-w-3xl text-zinc-600">
            If a wallet is not protocol-aware, it can accidentally spend UTXOs that should be preserved for Dogenals state.
            That is a user-safety issue, not just a feature gap.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <CTA href="/dogenals" label="See the Protocol Wall" primary />
            <CTA href="https://github.com/jonheaven/dogenals" label="Review Open Spec" />
          </div>
        </div>
      </section>

      <section id="security" className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid gap-6 md:grid-cols-2">
          <article className="site-card p-8">
            <Pill>Security</Pill>
            <h3 className="mt-4 text-2xl font-bold">Trust signals that matter.</h3>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-zinc-600">
              <li className="flex gap-2">
                <span className="font-bold text-zinc-950">—</span> Self-custody by default. No custodial key escrow.
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-zinc-950">—</span> Local-first web wallet mode for controlled signing.
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-zinc-950">—</span> Open protocol standards at dogenals.org.
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-zinc-950">—</span> Dogecoin L1-native model without bridge risk.
              </li>
            </ul>
          </article>
          <article className="site-card border-[#D4A017] bg-[#D4A017] p-8 text-zinc-950">
            <Pill inverted>Community</Pill>
            <h3 className="mt-4 text-2xl font-bold">Built for shibes.</h3>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-zinc-800">
              <li className="flex gap-2">
                <span className="font-bold">—</span> Much secure. Very based. Feels good man.
              </li>
              <li className="flex gap-2">
                <span className="font-bold">—</span> Identity + reputation path via Ð𝕏 direction.
              </li>
              <li className="flex gap-2">
                <span className="font-bold">—</span> UX language for normies, depth for power users.
              </li>
              <li className="flex gap-2">
                <span className="font-bold">—</span> Product voice that sounds like Dogecoin culture.
              </li>
            </ul>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <article className="rounded-2xl border-2 border-[#D4A017] bg-[#D4A017]/5 p-8">
          <Pill>Safe Spend Policy</Pill>
          <h3 className="mt-4 text-2xl font-bold">Protocol-sensitive UTXOs are protected by default.</h3>
          <ul className="mt-5 space-y-3 text-sm leading-6 text-zinc-600">
            <li>Tag protocol-linked UTXOs and exclude them from default coin selection.</li>
            <li>Require explicit user confirmation before spending protocol-sensitive outputs.</li>
            <li>Show human-readable warnings when a send could impact listings, inscriptions, or other Dogenals state.</li>
            <li>
              Preserve deterministic behavior aligned with the standards in{' '}
              <code className="site-code">dogenals.org</code>.
            </li>
          </ul>
        </article>
      </section>

      <section id="faq" className="site-section-alt">
        <div className="mx-auto max-w-3xl px-4 py-20">
          <Pill>FAQ</Pill>
          <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">Quick answers</h2>
          <p className="mt-3 text-zinc-600">
            Normie-friendly here. Deep blockchain details live in the technical FAQ.
          </p>
          <div className="mt-5">
            <CTA href="/faq" label="Open Technical FAQ" />
          </div>
          <div className="mt-8 space-y-2">
            {faqs.map((item, index) => {
              const open = faqOpen === index;
              return (
                <article key={item.question} className="site-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setFaqOpen((prev) => (prev === index ? -1 : index))}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    aria-expanded={open}
                  >
                    <span className="font-semibold">{item.question}</span>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#D4A017]/50 bg-[#D4A017]/10 text-sm font-bold text-zinc-900">
                      {open ? '−' : '+'}
                    </span>
                  </button>
                  {open ? (
                    <p className="border-t border-zinc-200 px-5 py-4 text-sm leading-6 text-zinc-600">{item.answer}</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-200">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <DojakMascot className="mx-auto h-20 w-20 text-zinc-950 opacity-80" />
          <h2 className="mt-6 text-3xl font-black tracking-tight md:text-5xl">
            Built for the shibes.
            <span className="mt-2 block font-serif text-2xl font-normal italic text-zinc-500 md:text-3xl">
              Designed to make the Doge father proud.
            </span>
          </h2>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <CTA href="https://chromewebstore.google.com/" label="Install Extension" primary />
            <CTA href="#" label="Try Web Wallet" />
            <CTA href="/faq" label="Geek FAQ" />
            <CTA href="https://github.com/jonheaven/dogenals" label="Read Dogenals Spec" />
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-zinc-500 sm:flex-row">
          <span className="font-semibold text-zinc-950">Dojak</span>
          <span>Self-custodial Dogecoin wallet · Dogenals-native · dogenals.org</span>
        </div>
      </footer>
    </main>
  );
}
