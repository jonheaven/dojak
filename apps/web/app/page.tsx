'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Gauge,
  LockKeyhole,
  PawPrint,
  ShieldCheck,
  Sparkles,
  Smartphone,
  UserRound,
  Zap
} from 'lucide-react';

type NavLink = { href: string; label: string; external?: boolean };

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

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#F2A900]/40 bg-[#F2A900]/10 px-3 py-1 text-xs font-semibold tracking-wide text-[#FCD34D]">
      {children}
    </span>
  );
}

function CTA({ href, label, primary = false }: { href: string; label: string; primary?: boolean }) {
  const className = primary
    ? 'inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-[#F2A900] to-[#FF8C42] px-5 text-sm font-bold text-black transition hover:brightness-110'
    : 'inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-5 text-sm font-semibold text-zinc-100 transition hover:border-[#F2A900]/60 hover:bg-white/10';
  return (
    <Link href={href} className={className} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
      {label}
    </Link>
  );
}

export default function HomePage() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [faqOpen, setFaqOpen] = useState(0);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#0a0a0a] text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_8%,rgba(242,169,0,0.24)_0%,transparent_32%),radial-gradient(circle_at_90%_20%,rgba(139,92,246,0.2)_0%,transparent_34%),radial-gradient(circle_at_55%_100%,rgba(255,140,66,0.2)_0%,transparent_35%)]" />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-black tracking-tight text-[#FCD34D]">
            <PawPrint className="h-5 w-5" aria-hidden />
            Dojak
          </Link>

          <button
            type="button"
            className="rounded-lg border border-white/20 px-3 py-2 text-sm md:hidden"
            onClick={() => setMobileMenu((prev) => !prev)}
            aria-expanded={mobileMenu}
            aria-label="Toggle menu"
          >
            Menu
          </button>

          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-zinc-300 transition hover:text-[#FCD34D]">
                {item.label}
              </Link>
            ))}
            <CTA href="#download" label="Get Dojak Free" primary />
          </nav>
        </div>
        {mobileMenu ? (
          <div className="border-t border-white/10 px-4 py-3 md:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-3">
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenu(false)}
                  className="rounded-lg px-2 py-1.5 text-sm text-zinc-200 hover:bg-white/5"
                >
                  {item.label}
                </Link>
              ))}
              <CTA href="#download" label="Get Dojak Free" primary />
            </div>
          </div>
        ) : null}
      </header>

      <section className="relative mx-auto grid min-h-[88vh] max-w-7xl gap-10 px-4 py-16 md:grid-cols-[1.15fr_0.85fr] md:items-center md:py-24">
        <div className="space-y-6">
          <Pill>Flagship Dogenals Wallet</Pill>
          <h1 className="text-balance text-4xl font-black leading-tight sm:text-5xl md:text-6xl">
            The Wallet Doge Deserves.
            <span className="block bg-gradient-to-r from-[#FCD34D] via-[#FF8C42] to-[#C084FC] bg-clip-text text-transparent">
              Built for the next billion shibes.
            </span>
          </h1>
          <p className="max-w-2xl text-pretty text-base leading-7 text-zinc-300 md:text-lg">
            The flagship Dogecoin wallet for the Dogenals era: simple for normies, powerful for pros, and safe for protocol-aware
            UTXO spending. Built on open standards from <code className="rounded bg-white/10 px-1 py-0.5 text-xs">dogenals.org</code>.
          </p>
          <div id="download" className="flex flex-wrap gap-3">
            <CTA href="https://chromewebstore.google.com/" label="Install Extension" primary />
            <CTA href="#" label="Try Web Wallet" />
            <CTA href="https://play.google.com/store/apps" label="Android" />
            <CTA href="https://apps.apple.com/" label="iOS" />
          </div>
          <p className="text-sm text-zinc-400">Self-custodial • Protocol-aware safety • Dogecoin L1 native • X-linked reputation</p>
        </div>

        <div className="relative mx-auto w-full max-w-[430px]">
          <div className="absolute -inset-8 rounded-full bg-[#F2A900]/20 blur-3xl" />
          <div className="relative overflow-hidden rounded-[28px] border border-white/15 bg-black/40 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
            <div className="mascot-float mx-auto flex h-44 w-44 items-center justify-center rounded-full border border-[#F2A900]/50 bg-[radial-gradient(circle_at_30%_20%,#FFD700_0%,#F2A900_45%,#111111_100%)] text-7xl">
              <PawPrint className="h-20 w-20 text-black/75" aria-hidden />
            </div>
            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-zinc-200">Connect X → Claim Shibe Status</div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-zinc-200">Inscribe, trade, and manage Dogenals</div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-zinc-200">Your keys. Your Dojak. Your chain.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-black/40">
        <div className="mx-auto grid max-w-7xl gap-3 px-4 py-5 text-center text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300 sm:grid-cols-2 lg:grid-cols-4">
          <span>Open standards: dogenals.org</span>
          <span>No server sees your seed</span>
          <span>Protocol-aware UTXO protection</span>
          <span>Dogecoin L1 native</span>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-4 py-20">
        <div className="max-w-2xl">
          <Pill>Core Product Value</Pill>
          <h2 className="mt-3 text-3xl font-bold md:text-4xl">Premium wallet UX with pure Doge culture energy.</h2>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((item) => (
            <article
              key={item.title}
              className="group rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-1 hover:border-[#F2A900]/40 hover:bg-white/[0.08]"
            >
              <item.icon className="mb-3 h-6 w-6 text-[#FCD34D] transition group-hover:scale-110" aria-hidden />
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="dogenals" className="border-y border-white/10 bg-zinc-950/70">
        <div className="mx-auto max-w-7xl px-4 py-20">
          <Pill>Dogenals Section</Pill>
          <h2 className="mt-3 text-3xl font-bold md:text-4xl">Dogenals rebooted for 2026.</h2>
          <p className="mt-3 max-w-3xl text-zinc-300">
            The standards tree at <code className="rounded bg-white/10 px-1 py-0.5 text-xs">dogenals.org</code> defines the chain
            contract. Dojak ships a polished implementation layer on top: fast indexing, social-native identity surfaces, and streamlined
            flows for tags, offers, and collectables.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statCards.map((item) => (
              <article key={item.label} className="rounded-2xl border border-white/10 bg-black/40 p-5">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">{item.label}</p>
                <p className="mt-2 text-2xl font-black text-[#FCD34D]">{item.value}</p>
                <p className="mt-1 text-sm text-zinc-300">{item.note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="platforms" className="mx-auto max-w-7xl px-4 py-20">
        <Pill>Multi-Platform</Pill>
        <h2 className="mt-3 text-3xl font-bold md:text-4xl">One wallet brand. Every major surface.</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {platformCards.map((item) => (
            <article key={item.name} className="rounded-2xl border border-[#F2A900]/20 bg-black/35 p-5">
              <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-2 py-1 text-xs text-zinc-300">{item.badge}</span>
              <h3 className="mt-4 text-xl font-semibold">{item.name}</h3>
              <div className="mt-3 space-y-2 text-sm text-zinc-300">
                <p><span className="font-semibold text-zinc-100">Install:</span> {item.install}</p>
                <p><span className="font-semibold text-zinc-100">Safety:</span> {item.safety}</p>
                <p><span className="font-semibold text-zinc-100">Works now:</span> {item.status}</p>
              </div>
              <div className="mt-5">
                <CTA href={item.href} label={item.cta} primary={item.name === 'Browser Extension'} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-black/50">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <Pill>Why Switch Now</Pill>
          <h2 className="mt-3 text-3xl font-bold md:text-4xl">Don’t get stranded on legacy Dogecoin wallet rails.</h2>
          <p className="mt-3 max-w-3xl text-zinc-300">
            Existing ecosystem wallets helped spark adoption, but the standards era is moving fast. Dojak is where the
            flagship Dogenals protocol wallet experience is being shaped: new spec alignment, modern UX, and first-party velocity.
          </p>
          <p className="mt-3 max-w-3xl text-zinc-300">
            If a wallet is not protocol-aware, it can accidentally spend UTXOs that should be preserved for Dogenals state.
            That is a user-safety issue, not just a feature gap.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <CTA href="/dogenals" label="See the Protocol Wall" primary />
            <CTA href="https://github.com/jonheaven/dogenals" label="Review Open Spec" />
          </div>
        </div>
      </section>

      <section id="security" className="border-y border-white/10 bg-zinc-950/70">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-20 md:grid-cols-2">
          <article className="rounded-3xl border border-white/10 bg-black/35 p-6">
            <Pill>Security</Pill>
            <h3 className="mt-3 text-2xl font-bold">Trust signals that are actually meaningful.</h3>
            <ul className="mt-4 space-y-3 text-sm text-zinc-300">
              <li>• Self-custody by default. No custodial key escrow.</li>
              <li>• Local-first web wallet mode for controlled signing.</li>
              <li>• Open protocol standards at dogenals.org.</li>
              <li>• Dogecoin L1-native model without bridge risk.</li>
            </ul>
          </article>
          <article className="rounded-3xl border border-white/10 bg-black/35 p-6">
            <Pill>Community Pulse</Pill>
            <h3 className="mt-3 text-2xl font-bold">Built for the shibes, not corporate vibes.</h3>
            <ul className="mt-4 space-y-3 text-sm text-zinc-300">
              <li>• Much secure. Very based. Feels good man.</li>
              <li>• Identity + reputation path via Ð𝕏 direction.</li>
              <li>• UX language for normies, depth for power users.</li>
              <li>• Product voice that sounds like Dogecoin culture.</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <article className="rounded-3xl border border-[#F2A900]/35 bg-[#F2A900]/10 p-6">
          <Pill>Safe Spend Policy</Pill>
          <h3 className="mt-3 text-2xl font-bold">Protocol-sensitive UTXOs are protected by default.</h3>
          <ul className="mt-4 space-y-3 text-sm text-zinc-200">
            <li>• Tag protocol-linked UTXOs and exclude them from default coin selection.</li>
            <li>• Require explicit user confirmation before spending protocol-sensitive outputs.</li>
            <li>• Show human-readable warnings when a send could impact listings, inscriptions, or other Dogenals state.</li>
            <li>• Preserve deterministic behavior aligned with the standards in <code className="rounded bg-white/10 px-1 py-0.5 text-xs">dogenals.org</code>.</li>
          </ul>
        </article>
      </section>

      <section id="faq" className="mx-auto max-w-4xl px-4 py-20">
        <Pill>FAQ</Pill>
        <h2 className="mt-3 text-3xl font-bold md:text-4xl">Quick answers (normie-friendly)</h2>
        <p className="mt-3 text-sm text-zinc-300">
          Want the deep blockchain details? Visit the full technical FAQ for protocol semantics, UTXO policy, and indexer behavior.
        </p>
        <div className="mt-4">
          <CTA href="/faq" label="Open Technical FAQ" />
        </div>
        <div className="mt-6 space-y-3">
          {faqs.map((item, index) => {
            const open = faqOpen === index;
            return (
              <article key={item.question} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                <button
                  type="button"
                  onClick={() => setFaqOpen((prev) => (prev === index ? -1 : index))}
                  className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                  aria-expanded={open}
                >
                  <span className="font-semibold">{item.question}</span>
                  <span className="text-[#FCD34D]">{open ? '−' : '+'}</span>
                </button>
                {open ? <p className="border-t border-white/10 px-4 py-4 text-sm text-zinc-300">{item.answer}</p> : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-14 text-center">
          <h2 className="text-3xl font-black md:text-5xl">
            Built for the shibes.
            <span className="block bg-gradient-to-r from-[#FCD34D] via-[#FF8C42] to-[#C084FC] bg-clip-text text-transparent">
              Designed to make the Doge father proud.
            </span>
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <CTA href="https://chromewebstore.google.com/" label="Install Extension" primary />
            <CTA href="#" label="Try Web Wallet" />
            <CTA href="/faq" label="Geek FAQ" />
            <CTA href="https://github.com/jonheaven/dogenals" label="Read Dogenals Spec" />
          </div>
        </div>
      </section>
    </main>
  );
}
