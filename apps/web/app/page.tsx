'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#download', label: 'Download' },
  { href: '#community', label: 'Community' },
  { href: 'https://github.com/dojak-wallet', label: 'GitHub' }
];

const features = [
  'Native Dogecoin send/receive/balance in one clean flow',
  'Identical 402 px UI across extension + Android + iOS',
  'True self-custody: your keys, your DOGE, always',
  'Fast, low-fee transactions optimized for daily use',
  'Modern mobile-first design tuned for 402 px logical points',
  'Open source UniSat fork with inscriptions-ready foundation',
  'Secure storage with straightforward recovery backup flow',
  'Cross-platform consistency with no fragmented wallet UX'
];

const testimonials = [
  '“Finally a wallet that feels the same on my phone and browser. Big shibe win.”',
  '“Setup was crazy fast, and I stayed in control of my keys from day one.”',
  '“The 402 px layout just clicks — clean, focused, and easy for daily DOGE sends.”',
  '“Moved from a cluttered wallet and never looked back. Dojak just works.”'
];

const faqs = [
  {
    q: 'Is Dojak self-custodial?',
    a: 'Yes. Your private keys stay with you. Dojak never controls your DOGE, so only you can authorize transactions.'
  },
  {
    q: 'What makes Dojak different from other DOGE wallets?',
    a: 'Dojak is focused on one consistent 402 px product experience across extension and mobile, instead of split designs per platform.'
  },
  {
    q: 'Is Dojak open source?',
    a: 'Yes. Dojak is built from an open source UniSat wallet foundation and adapted for Dogecoin-first performance and UX.'
  },
  {
    q: 'Why does the 402 px design matter?',
    a: 'A shared 402 px canvas means the extension popup feels like the mobile app. You get less relearning and faster confidence.'
  }
];

const downloadCards = [
  {
    title: 'Chrome & Brave Extension',
    subtitle: 'A popup that feels like a native app at 402 px.',
    cta: 'Add to Chrome / Brave',
    href: 'https://chrome.google.com/webstore'
  },
  {
    title: 'Android App',
    subtitle: 'Google Play release track ready for DOGE shibes.',
    cta: 'Get on Google Play',
    href: 'https://play.google.com/store'
  },
  {
    title: 'iOS App',
    subtitle: 'App Store listing in progress. Join the early list now.',
    cta: 'Download on App Store',
    href: 'https://apps.apple.com'
  }
];

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="bg-dojak-bg text-zinc-100 selection:bg-dojak-yellow/30">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="#" className="text-xl font-black tracking-tight text-dojak-yellow">
            Dojak 🐶
          </Link>
          <button
            className="rounded-md border border-white/20 px-3 py-2 text-sm md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            Menu
          </button>
          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <Link key={link.label} href={link.href} className="text-sm text-zinc-300 hover:text-dojak-yellow">
                {link.label}
              </Link>
            ))}
            <Link
              href="https://chrome.google.com/webstore"
              className="rounded-xl border border-dojak-yellow/60 bg-dojak-yellow px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
            >
              Add to Chrome
            </Link>
          </nav>
        </div>
        {menuOpen && (
          <nav className="border-t border-white/10 px-4 py-3 md:hidden">
            <div className="flex flex-col gap-3">
              {navLinks.map((link) => (
                <Link key={link.label} href={link.href} className="text-sm text-zinc-200" onClick={() => setMenuOpen(false)}>
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>

      <section className="bg-hero-radial">
        <div className="mx-auto grid min-h-[90vh] max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-dojak-yellow">Your keys, your DOGE</p>
            <h1 className="text-4xl font-black leading-tight md:text-6xl">Dojak — The Dogecoin Wallet That Just Works</h1>
            <p className="mt-5 max-w-xl text-zinc-300 md:text-lg">
              Secure self-custodial wallet. Same beautiful 402 px experience on Chrome/Brave extension, Android, and iOS.
              Built from UniSat for pure DOGE power.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="https://chrome.google.com/webstore" className="btn-primary">Add to Chrome / Brave</Link>
              <Link href="https://play.google.com/store" className="btn-secondary">Get on Google Play</Link>
              <Link href="https://apps.apple.com" className="btn-secondary">Download on App Store</Link>
            </div>
            <div className="mt-4 flex gap-4 text-sm">
              <Link href="https://github.com/dojak-wallet" className="text-zinc-300 underline-offset-4 hover:underline">View on GitHub</Link>
              <Link href="#features" className="text-zinc-300 underline-offset-4 hover:underline">Learn More</Link>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[402px] rounded-3xl border border-dojak-yellow/30 bg-black/40 p-4 shadow-glow">
            <Image
              src="/wallet-mockup.svg"
              width={402}
              height={760}
              alt="Dojak 402 px wallet interface mockup"
              priority
              className="h-auto w-full"
            />
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-black/40">
        <p className="mx-auto max-w-6xl px-4 py-4 text-center text-sm font-medium text-zinc-200">
          #1 Dogecoin Wallet for Shibes • Open Source • Self-Custodial • Trusted by the DOGE community • Built from UniSat 🚀
        </p>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-bold md:text-4xl">Why shibes choose Dojak</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article key={feature} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5">
              <p className="text-sm text-zinc-100">{feature}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="download" className="border-y border-white/10 bg-zinc-950/70">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-3xl font-bold md:text-4xl">Download Dojak on every platform</h2>
          <p className="mt-3 max-w-2xl text-zinc-300">One wallet, same feel everywhere. Use quick links or scan placeholder QR blocks.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {downloadCards.map((item) => (
              <article key={item.title} className="rounded-2xl border border-dojak-yellow/20 bg-black/40 p-5">
                <div className="mb-5 h-24 w-24 rounded-lg border border-dashed border-white/20 bg-zinc-900" aria-label="QR placeholder" />
                <h3 className="text-xl font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-zinc-300">{item.subtitle}</p>
                <Link href={item.href} className="btn-primary mt-5 inline-flex">{item.cta}</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-bold md:text-4xl">How Dojak works</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {['1. Install', '2. Create or Import wallet', '3. Send, receive & hodl DOGE 🌕'].map((step) => (
            <article key={step} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6">
              <p className="text-lg font-semibold">{step}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="community" className="border-y border-white/10 bg-zinc-950/70">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-3xl font-bold md:text-4xl">Loved by the DOGE community</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {testimonials.map((quote) => (
              <blockquote key={quote} className="rounded-2xl border border-white/10 bg-black/40 p-6 text-zinc-200">
                {quote}
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-20">
        <h2 className="text-3xl font-bold md:text-4xl">FAQ</h2>
        <div className="mt-6 space-y-3">
          {faqs.map((item) => (
            <details key={item.q} className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
              <summary className="cursor-pointer list-none font-semibold">{item.q}</summary>
              <p className="mt-3 text-sm text-zinc-300">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 bg-black/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-zinc-300 md:flex-row md:items-center md:justify-between">
          <p>Made with ❤️ for the DOGE army.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="https://github.com/dojak-wallet">GitHub</Link>
            <Link href="#">Privacy</Link>
            <Link href="#">Terms</Link>
            <Link href="#">Docs</Link>
            <Link href="#">X</Link>
            <Link href="#">Telegram</Link>
            <Link href="#">Discord</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
