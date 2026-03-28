'use client';

import { Button, Card } from '@dojak/ui';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

type NavLink = { href: string; label: string; external?: boolean };
type DownloadItem = {
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  badge: string;
};

type FAQ = {
  question: string;
  answer: string;
};

const navLinks: NavLink[] = [
  { href: '#features', label: 'Features' },
  { href: '#download', label: 'Download' },
  { href: '#community', label: 'Community' },
  { href: 'https://github.com/dojak-wallet', label: 'GitHub', external: true }
];

const featureCards = [
  {
    title: 'Native DOGE Support',
    body: 'Purpose-built for Dogecoin: send, receive, and monitor balance in one clean flow.'
  },
  {
    title: 'Identical 402 px Experience',
    body: 'One interface that feels familiar everywhere: Chrome/Brave popup, Android, and iOS.'
  },
  {
    title: 'True Self-Custody',
    body: 'Your keys, your DOGE. No custodial lock-ins, no hidden control over your funds.'
  },
  {
    title: 'Fast, Low-Fee Transactions',
    body: 'Built for daily usage with responsive send flows and transparent fee choices.'
  },
  {
    title: 'Modern, Clean Design',
    body: 'Focused UI that helps newcomers and power users move quickly with confidence.'
  },
  {
    title: 'Open Source UniSat Fork',
    body: 'Transparent codebase inherited from proven wallet architecture with Dogecoin-first direction.'
  },
  {
    title: 'Easy Recovery',
    body: 'Simple import and backup-friendly flows so you stay secure and in control long-term.'
  },
  {
    title: 'Cross-Platform Consistency',
    body: 'No feature drift between apps. Learn once, use anywhere, and onboard faster.'
  }
];

const downloadCards: DownloadItem[] = [
  {
    title: 'Chrome + Brave Extension',
    subtitle: '402 px popup that feels native and lightning fast for daily DOGE actions.',
    cta: 'Add to Chrome / Brave',
    href: 'https://chromewebstore.google.com/',
    badge: 'Most Popular'
  },
  {
    title: 'Android App',
    subtitle: 'Full Dojak wallet flow on Android with the same exact familiar layout.',
    cta: 'Get on Google Play',
    href: 'https://play.google.com/store/apps',
    badge: 'Google Play'
  },
  {
    title: 'iOS App',
    subtitle: 'App Store release track. Join the launch list and be first when it drops.',
    cta: 'Download on App Store',
    href: 'https://apps.apple.com/',
    badge: 'Coming Soon'
  }
];

const testimonials = [
  {
    quote: 'I can jump from Brave to my phone and everything feels exactly the same. Zero confusion.',
    author: 'Rex, DOGE miner'
  },
  {
    quote: 'Dojak made self-custody simple for me. Setup was fast, and I finally feel in control of my keys.',
    author: 'Mina, everyday shibe'
  },
  {
    quote: 'The send flow is clean, fee options are clear, and the 402 px design is insanely practical.',
    author: 'Cole, crypto builder'
  },
  {
    quote: 'Open source and DOGE-first with a polished UI? This is the wallet I recommend to friends.',
    author: 'Nia, DOGE community mod'
  }
];

const faqs: FAQ[] = [
  {
    question: 'What does self-custodial mean in Dojak?',
    answer:
      'Dojak gives you full ownership of your private keys. We do not hold your funds, and only you can authorize transactions.'
  },
  {
    question: 'Why is the 402 px layout important?',
    answer:
      'It creates one consistent experience across extension popup and mobile apps, reducing friction and onboarding time.'
  },
  {
    question: 'How is Dojak different from other Dogecoin wallets?',
    answer:
      'Dojak is Dogecoin-first, self-custodial, and intentionally consistent across devices with modern UX and clear transaction controls.'
  },
  {
    question: 'Is Dojak open source?',
    answer:
      'Yes. Dojak is built from an open source UniSat fork and developed in the open with community-friendly transparency.'
  },
  {
    question: 'Is Dojak secure?',
    answer:
      'Dojak focuses on local key control, clear signing flows, and a reduced-complexity interface to help prevent mistakes.'
  }
];

const howItWorks = [
  {
    title: '1. Install Dojak',
    body: 'Add the extension or download mobile. You are live in under two minutes.'
  },
  {
    title: '2. Create or import wallet',
    body: 'Start fresh or restore from your phrase while keeping complete control over keys.'
  },
  {
    title: '3. Send, receive & hodl DOGE',
    body: 'Track balances, scan QR, and move DOGE confidently—whether at home or on the go.'
  }
];

function CtaButton({ href, text, primary = false }: { href: string; text: string; primary?: boolean }) {
  return (
    <Link href={href} target="_blank" rel="noreferrer" className="inline-flex">
      <Button
        text={text}
        preset={primary ? 'primary' : 'default'}
        style={
          primary
            ? { minHeight: 48, borderRadius: 14, minWidth: 190, paddingLeft: 18, paddingRight: 18 }
            : {
                minHeight: 48,
                borderRadius: 14,
                minWidth: 190,
                paddingLeft: 18,
                paddingRight: 18,
                border: '1px solid rgba(244,196,48,0.4)',
                background: 'rgba(24,24,24,0.85)'
              }
        }
        textStyle={primary ? { color: '#0a0a0a', fontWeight: 700 } : { color: '#f5f5f5', fontWeight: 600 }}
      />
    </Link>
  );
}

export default function HomePage() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  const trustBarText = useMemo(
    () => '#1 Choice for Shibes • Open Source • Self-Custodial • Trusted by the DOGE Community • Built from UniSat 🐶🚀',
    []
  );

  return (
    <main className="min-h-screen bg-dojak-bg text-zinc-100 selection:bg-dojak-yellow/30">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 md:py-4">
          <Link href="#" className="flex items-center gap-2 text-lg font-black tracking-tight text-dojak-yellow md:text-xl">
            <span className="text-2xl leading-none">🐶</span>
            Dojak
          </Link>

          <button
            type="button"
            className="rounded-lg border border-white/20 px-3 py-2 text-sm md:hidden"
            onClick={() => setMobileMenu((prev) => !prev)}
            aria-label="Toggle navigation"
            aria-expanded={mobileMenu}
          >
            Menu
          </button>

          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noreferrer' : undefined}
                className="text-sm font-medium text-zinc-300 transition hover:text-dojak-yellow"
              >
                {link.label}
              </Link>
            ))}
            <CtaButton href="https://chromewebstore.google.com/" text="Add to Chrome" primary />
          </nav>
        </div>

        {mobileMenu && (
          <nav className="border-t border-white/10 bg-black/40 px-4 py-4 md:hidden">
            <div className="mx-auto flex max-w-6xl flex-col gap-3">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noreferrer' : undefined}
                  className="rounded-lg px-2 py-1.5 text-sm text-zinc-200 transition hover:bg-white/5"
                  onClick={() => setMobileMenu(false)}
                >
                  {link.label}
                </Link>
              ))}
              <CtaButton href="https://chromewebstore.google.com/" text="Add to Chrome" primary />
            </div>
          </nav>
        )}
      </header>

      <section className="hero-mesh relative overflow-hidden">
        <div className="mx-auto grid min-h-[88vh] w-full max-w-6xl gap-12 px-4 py-16 md:grid-cols-[1.05fr_0.95fr] md:items-center md:py-24">
          <div className="relative z-10">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-dojak-yellow md:text-sm">Your keys, your DOGE</p>
            <h1 className="text-balance text-4xl font-black leading-tight md:text-6xl">
              Dojak — The Dogecoin Wallet That Just Works
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-base text-zinc-300 md:text-lg">
              Secure self-custodial wallet with the same beautiful 402 px UI on Chrome/Brave extension, Android, and iOS.
              Built from UniSat for pure DOGE power.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <CtaButton href="https://chromewebstore.google.com/" text="Add to Chrome / Brave" primary />
              <CtaButton href="https://play.google.com/store/apps" text="Get on Google Play" />
              <CtaButton href="https://apps.apple.com/" text="Download on App Store" />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-zinc-300">
              <Link href="https://github.com/dojak-wallet" target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                View on GitHub
              </Link>
              <Link href="#download" className="underline-offset-4 hover:underline">
                Compare platforms
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[430px]">
            <div className="absolute inset-0 rounded-[32px] bg-gradient-to-br from-dojak-yellow/30 via-dojak-orange/15 to-transparent blur-2xl" />
            <div className="relative rounded-[32px] border border-dojak-yellow/35 bg-black/65 p-4 shadow-glow">
              <Image
                src="/wallet-mockup.svg"
                width={402}
                height={760}
                alt="Dojak 402 px wallet UI mockup"
                priority
                className="h-auto w-full rounded-[20px]"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-black/45">
        <p className="mx-auto max-w-6xl px-4 py-4 text-center text-sm font-medium text-zinc-100">{trustBarText}</p>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold md:text-4xl">Features that make Dojak feel effortless</h2>
          <p className="mt-3 text-zinc-300">Built for speed, confidence, and consistency for every shibe in the DOGE army.</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((feature) => (
            <Card
              key={feature.title}
              style={{
                borderRadius: 18,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(16,16,16,0.8)',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                flexDirection: 'column',
                minHeight: 180
              }}
            >
              <h3 className="text-lg font-semibold text-zinc-100">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-300">{feature.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section id="download" className="border-y border-white/10 bg-zinc-950/70">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-3xl font-bold md:text-4xl">Download Dojak on every platform</h2>
          <p className="mt-3 max-w-2xl text-zinc-300">
            Use quick links now and scan platform QR placeholders. One wallet experience, no relearning.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {downloadCards.map((item) => (
              <article key={item.title} className="rounded-2xl border border-dojak-yellow/20 bg-black/45 p-5">
                <span className="inline-flex rounded-full border border-dojak-yellow/40 bg-dojak-yellow/10 px-2.5 py-1 text-xs font-semibold text-dojak-yellow">
                  {item.badge}
                </span>
                <div
                  className="mt-4 h-24 w-24 rounded-lg border border-dashed border-white/25 bg-zinc-900/80"
                  aria-label="QR placeholder"
                />
                <h3 className="mt-4 text-xl font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-zinc-300">{item.subtitle}</p>
                <div className="mt-5">
                  <CtaButton href={item.href} text={item.cta} primary />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-bold md:text-4xl">How it works</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {howItWorks.map((step) => (
            <article key={step.title} className="rounded-2xl border border-white/10 bg-zinc-900/65 p-6">
              <h3 className="text-lg font-semibold text-dojak-yellow">{step.title}</h3>
              <p className="mt-3 text-sm text-zinc-300">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="community" className="border-y border-white/10 bg-zinc-950/70">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-3xl font-bold md:text-4xl">Loved by the DOGE community</h2>
          <p className="mt-3 max-w-2xl text-zinc-300">Real feedback from shibes who wanted a wallet that feels modern and trustworthy.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {testimonials.map((item) => (
              <blockquote key={item.author} className="rounded-2xl border border-white/10 bg-black/40 p-6">
                <p className="text-zinc-200">“{item.quote}”</p>
                <footer className="mt-4 text-sm font-medium text-dojak-yellow">— {item.author}</footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-20">
        <h2 className="text-3xl font-bold md:text-4xl">FAQ</h2>
        <div className="mt-6 space-y-3">
          {faqs.map((item, index) => {
            const isOpen = openFaq === index;

            return (
              <article key={item.question} className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/70">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
                  onClick={() => setOpenFaq((prev) => (prev === index ? -1 : index))}
                  aria-expanded={isOpen}
                >
                  <span className="font-semibold">{item.question}</span>
                  <span className="text-dojak-yellow">{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && <p className="border-t border-white/10 px-4 py-4 text-sm text-zinc-300">{item.answer}</p>}
              </article>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-white/10 bg-black/65">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-10 text-sm text-zinc-300 md:flex-row md:items-center md:justify-between">
          <p>Made with ❤️ for the DOGE army.</p>

          <div className="flex flex-wrap gap-4">
            <Link href="https://github.com/dojak-wallet" target="_blank" rel="noreferrer" className="hover:text-dojak-yellow">
              GitHub
            </Link>
            <Link href="#" className="hover:text-dojak-yellow">
              Privacy
            </Link>
            <Link href="#" className="hover:text-dojak-yellow">
              Terms
            </Link>
            <Link href="#" className="hover:text-dojak-yellow">
              Docs
            </Link>
            <Link href="#" className="hover:text-dojak-yellow">
              X
            </Link>
            <Link href="#" className="hover:text-dojak-yellow">
              Telegram
            </Link>
            <Link href="#" className="hover:text-dojak-yellow">
              Discord
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
