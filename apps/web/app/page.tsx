'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowUpRight,
  Boxes,
  ExternalLink,
  Globe,
  Fingerprint,
  LockKeyhole,
  Menu,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserRound,
  X,
  Zap
} from 'lucide-react';
import { BuilderSnippet } from '../components/BuilderSnippet';
import { HeroVideo } from '../components/HeroVideo';
import { CTA, Pill, StatusBadge } from '../components/site-ui';

/** Store / demo links — update when CWS ID and mobile listings are final. */
const LINKS = {
  chromeStore: 'https://chromewebstore.google.com/detail/dojak-wallet/dojak-wallet-id',
  firefox: '#download',
  brave: 'https://chromewebstore.google.com/detail/dojak-wallet/dojak-wallet-id',
  webWallet: 'https://dojakweb-demo.vercel.app',
  android: 'https://play.google.com/store/apps',
  ios: 'https://apps.apple.com/',
  dogenals: 'https://dogenals.org',
  dogenalsCom: 'https://dogenals.com',
  drok: 'https://drok.lol',
  explorer: 'https://explorer.dogenals.com',
  githubSpec: 'https://github.com/jonheaven/dogenals',
  githubWallet: 'https://github.com/jonheaven/dojak',
  x: 'https://x.com/jontype',
  mobileWaitlist: '#platforms'
} as const;

const navLinks = [
  { href: '#onboarding', label: 'Get started' },
  { href: '#unlocks', label: 'What it unlocks' },
  { href: '#platforms', label: 'Platforms' },
  { href: '#builders', label: 'Builders' },
  { href: '#security', label: 'Trust' },
  { href: '/faq', label: 'FAQ' }
];

const steps = [
  {
    n: '01',
    title: 'Install the extension',
    body: 'Add Dojak from Chrome or Brave. Side panel + popup — ready for Dogecoin L1.'
  },
  {
    n: '02',
    title: 'Create, import, or pair',
    body: 'Local encrypted vault in the extension, or pair a mobile device when available. Keys stay with you.'
  },
  {
    n: '03',
    title: 'Approve every send',
    body: 'Sign DOGE, Doginals, DRC-20, or a PSBT on the surface that holds the keys. Nothing leaves your device.'
  },
  {
    n: '04',
    title: 'Explore the Dogenals stack',
    body: 'Inscribe, trade, and plug into dApps via window.dojak — backed by open standards at dogenals.org.'
  }
];

const unlockCards = [
  {
    title: 'DOGE · Doginals · DRC-20',
    body: 'Balances, sends, inscriptions, Dunes, Charms, Treats — L1 stack in the toolbar, not a custodial parking lot.',
    icon: Boxes
  },
  {
    title: 'Protocol-aware UTXO protection',
    body: 'Dogenals-aware coin selection. Explicit confirm before spending inscription- or offer-linked outs. Human-readable warnings — a real safety edge.',
    icon: LockKeyhole,
    highlight: true
  },
  {
    title: 'dApps via window.dojak',
    body: 'Sites call requestAccounts, signMessage, signPsbt, sendBitcoin, sendInscription — one Dogecoin-native provider.',
    icon: Zap
  },
  {
    title: 'X / Ðoge𝕏ID identity',
    body: 'Social-native reputation and handle-linked identity for safer interactions across the Dogenals orbit.',
    icon: UserRound
  },
  {
    title: 'Orbit links',
    body: 'Jump to explorer, docs, dogenals.com, drok.lol — and keep signing where it belongs: with you.',
    icon: ExternalLink
  },
  {
    title: 'Open standards + polished product',
    body: 'Spec is public MIT at dogenals.org. Dojak is the proprietary, production-grade wallet layer on top.',
    icon: Sparkles
  }
];

const platforms = [
  {
    name: 'Browser Extension',
    badge: 'Live' as const,
    tone: 'live' as const,
    install: 'Chrome Web Store · Brave',
    body: 'Primary surface today. Protocol-aware UTXO protection + self-custody vault.',
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
    href: LINKS.mobileWaitlist,
    primary: false
  },
  {
    name: 'Web Wallet',
    badge: 'Local-Only' as const,
    tone: 'local' as const,
    install: 'Browser demo',
    body: 'Local-first keys in the browser. Great for quick demos — extension remains primary.',
    cta: 'Open Web Demo',
    href: LINKS.webWallet,
    primary: false
  }
];

const faqs = [
  {
    question: 'Is Dojak open source?',
    answer:
      'Dogenals standards at dogenals.org are open and MIT-licensed. Dojak wallet apps are proprietary products implementing those standards.'
  },
  {
    question: 'Where do my keys live?',
    answer:
      'On your device. Extension vault is encrypted locally. Mobile pairing (when live) keeps signing on the phone. We never escrow seeds.'
  },
  {
    question: 'How is this safer for Doginals than a generic wallet?',
    answer:
      'Non-protocol-aware wallets can treat inscription carriers as ordinary coins and spend them by accident. Dojak tags protocol-linked UTXOs, excludes them from default coin selection, and requires explicit confirmation with clear warnings.'
  },
  {
    question: 'Prefer keys in the extension instead of mobile?',
    answer:
      'Yes. Create or import a seed / WIF into the encrypted extension vault — multi-account, auto-lock, connected-site approvals. Mobile pairing is an orbit path when you want it; local vault is fully self-custodial.'
  },
  {
    question: 'What is window.dojak?',
    answer:
      'The browser provider injected by the extension. Detect isDojak, then requestAccounts, signPsbt, sendBitcoin, sendInscription, and more — Dogecoin-native for dApps.'
  },
  {
    question: 'Why genesis block 6,142,069?',
    answer:
      'That marks the Dogenals era activation context on Dogecoin L1. Dojak is built for that standards reboot — not bridge detours.'
  }
];

const orbitLinks = [
  { href: LINKS.explorer, label: 'Ðexplorer' },
  { href: LINKS.dogenals, label: 'dogenals.org' },
  { href: LINKS.dogenalsCom, label: 'dogenals.com' },
  { href: LINKS.drok, label: 'drok.lol' },
  { href: LINKS.githubSpec, label: 'Spec on GitHub' },
  { href: '/dogenals', label: 'Protocol Wall' }
];

export default function HomePage() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [faqOpen, setFaqOpen] = useState(0);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-white text-zinc-950">
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3.5">
          <Link href="/" className="flex items-center gap-2.5 text-lg font-black tracking-tight">
            <Image
              src="/icons/icon-48.png"
              alt=""
              width={32}
              height={32}
              className="rounded-lg"
              priority
            />
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

          <nav className="hidden items-center gap-7 md:flex">
            {navLinks.map((item) => (
              <Link key={item.href} href={item.href} className="site-link text-sm font-medium">
                {item.label}
              </Link>
            ))}
            <CTA href="#download" label="Get Dojak" primary />
          </nav>
        </div>
        {mobileMenu ? (
          <div className="border-t border-zinc-200 px-4 py-4 md:hidden">
            <div className="mx-auto flex max-w-6xl flex-col gap-1">
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
                <CTA href="#download" label="Get Dojak" primary className="w-full" />
              </div>
            </div>
          </div>
        ) : null}
      </header>

      {/* ── Hero ── */}
      <section className="relative isolate min-h-[min(92vh,880px)] overflow-hidden bg-zinc-950 text-white">
        <HeroVideo className="absolute inset-0" />
        <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-14 md:grid-cols-[1.15fr_0.85fr] md:items-end md:pb-20 md:pt-20">
          <div className="space-y-6">
            <Pill inverted>Flagship Dogenals Wallet · Dogecoin L1</Pill>
            <h1 className="font-display text-balance text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-[4.25rem]">
              Add it.{' '}
              <em className="font-serif font-normal not-italic text-[#D4A017] sm:italic">Own it.</em>{' '}
              Browse free.
            </h1>
            <p className="max-w-xl text-pretty text-base leading-7 text-zinc-200 md:text-lg">
              Install Dojak, keep keys on-device, approve every signature yourself. Protocol-aware for Doginals —
              so you don&apos;t accidentally spend what should stay inscribed.
            </p>
            <p className="font-serif text-lg italic text-zinc-300 md:text-xl">
              The wallet Doge deserves. Black and white. Self-custodial. Protocol-native.
            </p>
            <div id="download" className="flex flex-wrap gap-3">
              <CTA href={LINKS.chromeStore} label="Install Extension" primary />
              <CTA
                href={LINKS.mobileWaitlist}
                label="Get Mobile / Pair"
                className="!border-white/40 !bg-white/10 !text-white hover:!border-[#D4A017] hover:!bg-[#D4A017]/20"
              />
            </div>
            <p className="max-w-lg text-sm leading-6 text-zinc-400">
              Prefer a local vault in the extension? Create or import a seed — still fully self-custodial. Mobile pairing
              is the orbit path when you want keys in your pocket.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-sm">
            <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/40 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-md">
              <Image
                src="/brand/dojak.png"
                alt="Dojak wallet artwork"
                width={640}
                height={640}
                className="h-auto w-full rounded-xl object-contain"
                priority
              />
              <div className="mt-4 space-y-2">
                {[
                  'Keys never leave your device',
                  'Dogenals-aware UTXO safety',
                  'window.dojak for dApps'
                ].map((line) => (
                  <div
                    key={line}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm font-medium text-zinc-100"
                  >
                    <span>{line}</span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-[#D4A017]" aria-hidden />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-zinc-50">
        <div className="mx-auto grid max-w-6xl gap-3 px-4 py-5 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 sm:grid-cols-2 lg:grid-cols-4">
          <span>Open standards · dogenals.org</span>
          <span>No server sees your seed</span>
          <span>Protocol-aware UTXO protection</span>
          <span>Pure Dogecoin L1 · no bridge required</span>
        </div>
      </section>

      {/* ── Onboarding ── */}
      <section id="onboarding" className="mx-auto max-w-6xl px-4 py-20">
        <div className="max-w-2xl">
          <Pill>Get set up</Pill>
          <h2 className="mt-4 font-display text-3xl font-black tracking-tight md:text-4xl">
            Four steps. Zero detours.
          </h2>
          <p className="mt-3 text-zinc-600">
            Crystal-clear path from install to browsing the Dogecoin web — with keys where they belong.
          </p>
        </div>
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

      {/* ── What it unlocks ── */}
      <section id="unlocks" className="site-section-alt">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="max-w-2xl">
            <Pill>What it unlocks</Pill>
            <h2 className="mt-4 font-display text-3xl font-black tracking-tight md:text-4xl">
              The whole L1 stack in the toolbar.
            </h2>
            <p className="mt-3 text-zinc-600">
              Same Dogecoin energy you want — wired for Dogenals, safer spends, and builders.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {unlockCards.map((item) => (
              <article
                key={item.title}
                className={`site-card site-card-hover p-6 ${
                  item.highlight ? 'border-[#D4A017] ring-1 ring-[#D4A017]/25' : ''
                }`}
              >
                {item.highlight ? (
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#A67C0F]">
                    Hero safety feature
                  </p>
                ) : null}
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-[#D4A017]/70 bg-[#D4A017]/10">
                  <item.icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{item.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-2">
            {orbitLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                target={l.href.startsWith('http') ? '_blank' : undefined}
                rel={l.href.startsWith('http') ? 'noreferrer' : undefined}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-800 transition hover:border-[#D4A017]"
              >
                {l.label}
                <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Local vault callout ── */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <article className="grid gap-8 overflow-hidden rounded-2xl border-2 border-zinc-900 bg-zinc-950 text-white md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4 p-8 md:p-10">
            <Pill inverted>Also onboard</Pill>
            <h2 className="font-display text-3xl font-black tracking-tight md:text-4xl">
              Prefer keys in the extension?
            </h2>
            <p className="text-zinc-300">
              Create or import a seed / WIF into an encrypted vault. Multi-account. Auto-lock. Connected sites &amp;
              approvals. Mobile pairing is recommended when you want pocket signing — local vault is there when you want
              it.
            </p>
            <ul className="grid gap-2 text-sm text-zinc-200 sm:grid-cols-2">
              {[
                'Encrypted vault · auto-lock',
                'Multi-account switch',
                'Connected sites · approvals',
                'Protocol-aware spend guards'
              ].map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="text-[#D4A017]">—</span>
                  {line}
                </li>
              ))}
            </ul>
            <div className="pt-2">
              <CTA href={LINKS.chromeStore} label="Install & create vault" primary />
            </div>
          </div>
          <div className="relative min-h-[220px] border-t border-white/10 md:border-l md:border-t-0">
            <video
              className="absolute inset-0 h-full w-full object-cover opacity-90"
              src="/brand/dojakwallet.mp4"
              poster="/brand/dojak.png"
              muted
              playsInline
              loop
              autoPlay
              preload="metadata"
              aria-hidden
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent" />
          </div>
        </article>
      </section>

      {/* ── Platforms ── */}
      <section id="platforms" className="site-section-alt">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <Pill>Multi-platform</Pill>
          <h2 className="mt-4 font-display text-3xl font-black tracking-tight md:text-4xl">
            One wallet. Every surface.
          </h2>
          <p className="mt-3 max-w-2xl text-zinc-600">
            Honest status. Real links. Extension is the front door today — mobile and web complete the orbit.
          </p>
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
          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
            <Globe className="h-4 w-4" aria-hidden />
            <span>Chrome</span>
            <span className="text-zinc-300">·</span>
            <span>Brave</span>
            <span className="text-zinc-300">·</span>
            <span>Firefox listing when ready</span>
          </div>
        </div>
      </section>

      {/* ── Builders ── */}
      <section id="builders" className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-start">
          <div>
            <Pill>For builders</Pill>
            <h2 className="mt-4 font-display text-3xl font-black tracking-tight md:text-4xl">
              Plug into window.dojak
            </h2>
            <p className="mt-3 text-zinc-600">
              Detect <code className="site-code">isDojak</code>, request accounts, sign, push. Same Dogecoin-native
              language as the rest of the stack — users approve from the vault that holds the keys.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <CTA href={LINKS.githubSpec} label="Open Dogenals Spec" primary />
              <CTA href="/dogenals" label="Protocol Wall" />
              <CTA href={LINKS.dogenals} label="dogenals.org" />
            </div>
          </div>
          <BuilderSnippet />
        </div>
      </section>

      {/* ── Trust ── */}
      <section id="security" className="site-section-alt">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="grid gap-6 md:grid-cols-2">
            <article className="site-card p-8">
              <Pill>Why this exists</Pill>
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
                  Open standards at dogenals.org · proprietary polished product.
                </li>
                <li className="flex gap-2">
                  <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A017]" />
                  Pure Dogecoin L1 — no bridge required for the core experience.
                </li>
              </ul>
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
                Deterministic behavior aligned with{' '}
                <code className="site-code">dogenals.org</code>.
              </li>
            </ul>
          </article>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-20">
        <Pill>FAQ</Pill>
        <h2 className="mt-4 font-display text-3xl font-black tracking-tight md:text-4xl">Quick answers</h2>
        <p className="mt-3 text-zinc-600">Normie-friendly here. Deep details live in the technical FAQ.</p>
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
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#D4A017]/50 bg-[#D4A017]/10 text-sm font-bold">
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
      </section>

      {/* ── Closing CTA ── */}
      <section className="border-t border-zinc-200 bg-zinc-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <Image
            src="/icons/icon-96.png"
            alt=""
            width={72}
            height={72}
            className="mx-auto rounded-2xl"
          />
          <h2 className="mt-6 font-display text-3xl font-black tracking-tight md:text-5xl">
            Add it. Own it. Browse free.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-400">
            Install from your browser store. Keep keys on-device. Sign on the surface that holds them. One wallet. One
            orbit. Dogecoin without detours.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <CTA href={LINKS.chromeStore} label="Install Extension" primary />
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
        </div>
      </section>

      <footer className="border-t border-zinc-800 bg-zinc-950 text-zinc-400">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <p className="flex items-center gap-2 text-lg font-black text-white">
              <Image src="/icons/icon-32.png" alt="" width={24} height={24} className="rounded" />
              Dojak
            </p>
            <p className="mt-3 max-w-sm text-sm leading-6">
              Self-custodial Dogecoin + Dogenals wallet. Built for the shibes. Designed to make the Doge father proud.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Product</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="#download" className="hover:text-[#D4A017]">
                  Install
                </Link>
              </li>
              <li>
                <Link href="#platforms" className="hover:text-[#D4A017]">
                  Platforms
                </Link>
              </li>
              <li>
                <Link href="#builders" className="hover:text-[#D4A017]">
                  Builders
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-[#D4A017]">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-[#D4A017]">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-[#D4A017]">
                  Terms
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Orbit</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a href={LINKS.dogenals} target="_blank" rel="noreferrer" className="hover:text-[#D4A017]">
                  dogenals.org
                </a>
              </li>
              <li>
                <a href={LINKS.githubSpec} target="_blank" rel="noreferrer" className="hover:text-[#D4A017]">
                  GitHub · Spec
                </a>
              </li>
              <li>
                <a href={LINKS.githubWallet} target="_blank" rel="noreferrer" className="hover:text-[#D4A017]">
                  GitHub · Dojak
                </a>
              </li>
              <li>
                <a href={LINKS.x} target="_blank" rel="noreferrer" className="hover:text-[#D4A017]">
                  X · @jontype
                </a>
              </li>
              <li>
                <a href={LINKS.explorer} target="_blank" rel="noreferrer" className="hover:text-[#D4A017]">
                  Ðexplorer
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-zinc-800">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-6 text-xs text-zinc-500 sm:flex-row sm:items-center">
            <span>
              © {new Date().getFullYear()} Dojak ·{' '}
              <Link href="/privacy" className="hover:text-[#D4A017]">
                Privacy
              </Link>{' '}
              ·{' '}
              <Link href="/terms" className="hover:text-[#D4A017]">
                Terms
              </Link>
            </span>
            <span className="font-serif italic text-zinc-400">Built for the shibes.</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
