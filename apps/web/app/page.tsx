'use client';

import Link from 'next/link';
import { useState } from 'react';

const LINKS = {
  github: 'https://github.com/dojak-wallet',
  chrome: 'https://chromewebstore.google.com/',
  android: 'https://play.google.com/store/apps/details?id=app.dojak.wallet',
  ios: 'https://apps.apple.com/us/app/dojak-wallet/id0000000000',
  docs: 'https://github.com/dojak-wallet/dojak',
  x: 'https://x.com/dojakwallet',
  telegram: 'https://t.me/dojakwallet',
  discord: 'https://discord.gg/dojak'
};

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#platforms', label: 'Platforms' },
  { href: '#download', label: 'Download' },
  { href: '#community', label: 'Community' },
  { href: LINKS.github, label: 'GitHub' }
];

const features = [
  {
    title: 'Identical 402 px everywhere',
    body: 'The exact same wallet flow in Chrome/Brave popup (fixed 402 px) and full native mobile apps.'
  },
  {
    title: 'UniSat fork, DOGE-optimized',
    body: 'Built from a proven UniSat foundation and tuned specifically for pure Dogecoin UX and performance.'
  },
  {
    title: 'True self-custodial',
    body: 'Your keys, your DOGE — Dojak never takes custody and cannot move your funds.'
  },
  {
    title: 'Wallet MVP ready',
    body: 'Home, Receive, Send, and Settings tabs match shared @dojak/ui components across every surface.'
  }
];

const platforms = [
  {
    icon: '🧩',
    title: 'Chrome + Brave extension popup',
    body: 'Fixed 402 px popup that feels native, fast, and focused for quick DOGE transactions.'
  },
  {
    icon: '📱',
    title: 'Android + iOS native apps',
    body: 'Full native app shells with the same Home / Receive / Send interface and wallet behavior.'
  },
  {
    icon: '🛡️',
    title: 'One product, no fragmented UX',
    body: 'No relearning per platform — one consistent self-custodial wallet experience for every shibe.'
  }
];

const testimonials = [
  '“The fixed 402 px layout is perfect — the extension popup feels exactly like the app in my pocket.”',
  '“Switched from another wallet because Dojak keeps Home/Receive/Send identical on every device.”',
  '“Extension convenience + native mobile polish is the combo I wanted for daily DOGE.”',
  '“Finally, true self-custody with a clean design that does not change between Chrome and iOS.”'
];

const faqs = [
  {
    q: 'Why does the 402 px design improve wallet UX?',
    a: 'The fixed 402 px canvas keeps core actions in predictable places, so the extension popup feels native and mobile usage feels instantly familiar.'
  },
  {
    q: 'Extension vs app: which should I use?',
    a: 'Use the extension for browser-first flows and fast swaps between dApps and DOGE transfers. Use mobile for on-the-go payments. The UI and actions remain identical.'
  },
  {
    q: 'Is Dojak open source?',
    a: 'Yes. Dojak is open source and built from a UniSat fork optimized for pure Dogecoin. You can review the repo and follow progress publicly on GitHub.'
  },
  {
    q: 'Is Dojak truly self-custodial?',
    a: 'Yes. You control your recovery phrase and private keys. Dojak cannot custody or recover your DOGE for you.'
  }
];

const downloadCards = [
  {
    icon: '🌐',
    title: 'Chrome & Brave',
    subtitle: 'Fixed 402 px popup wallet for daily DOGE sending and receiving.',
    cta: 'Add to Chrome',
    href: LINKS.chrome,
    qrLabel: 'Chrome QR'
  },
  {
    icon: '🤖',
    title: 'Android',
    subtitle: 'Native app shell with the exact same Home / Receive / Send UX.',
    cta: 'Google Play',
    href: LINKS.android,
    qrLabel: 'Android QR'
  },
  {
    icon: '🍎',
    title: 'iOS',
    subtitle: 'Native iPhone experience with shared wallet MVP components.',
    cta: 'App Store',
    href: LINKS.ios,
    qrLabel: 'iOS QR'
  }
];

function QRPlaceholder({ label }: { label: string }) {
  return (
    <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-dojak-yellow/40 bg-zinc-950" aria-label={label}>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:12px_12px]" />
      <span className="absolute inset-x-0 bottom-1 text-center text-[10px] font-semibold tracking-widest text-dojak-yellow">QR</span>
    </div>
  );
}

function WalletPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[402px] rounded-[28px] border border-dojak-yellow/30 bg-[#10131c] p-4 shadow-glow">
      <div className="rounded-2xl border border-white/10 bg-[#0b0f19] p-4">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>Wallet</span>
          <span className="rounded-full bg-dojak-yellow/20 px-2 py-0.5 text-dojak-yellow">402 px</span>
        </div>
        <p className="mt-4 text-3xl font-black">1,245.08 DOGE</p>
        <p className="mt-1 text-sm text-zinc-400">≈ $223.90 USD</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button className="rounded-xl bg-dojak-yellow px-3 py-2 text-sm font-semibold text-black">Receive</button>
          <button className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold">Send</button>
        </div>

        <div className="mt-5 space-y-2">
          {["+ 75 DOGE from ShibeFriend", '- 32 DOGE to doge1q...9n2r', '+ 120 DOGE from Mining Payout'].map((tx) => (
            <div key={tx} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300">
              {tx}
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2 text-center text-[11px]">
          {['Home', 'Receive', 'Send', 'Settings'].map((tab, idx) => (
            <span
              key={tab}
              className={`rounded-lg px-2 py-2 ${idx === 0 ? 'bg-dojak-yellow text-black font-semibold' : 'bg-white/5 text-zinc-300'}`}
            >
              {tab}
            </span>
          ))}
        </div>
      </div>

      <span className="pointer-events-none absolute -left-5 top-10 text-2xl opacity-70">🪙</span>
      <span className="pointer-events-none absolute -right-4 top-24 text-xl opacity-70">🪙</span>
      <span className="pointer-events-none absolute -right-3 bottom-20 text-2xl opacity-70">🪙</span>
    </div>
  );
}

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="bg-dojak-bg text-zinc-100 selection:bg-dojak-yellow/30">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-dojak-bg/90 backdrop-blur">
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
            <Link href={LINKS.chrome} className="btn-primary !px-5 !py-3">
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
              <Link href={LINKS.chrome} className="btn-primary inline-flex w-fit">
                Add to Chrome
              </Link>
            </div>
          </nav>
        )}
      </header>

      <section className="relative overflow-hidden bg-hero-radial">
        <div className="pointer-events-none absolute -left-28 top-20 h-72 w-72 rounded-full bg-dojak-yellow/10 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-dojak-orange/15 blur-3xl" />
        <div className="mx-auto grid min-h-[90vh] max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-dojak-yellow">Your keys, your DOGE</p>
            <h1 className="text-4xl font-black leading-tight md:text-6xl">
              Same beautiful 402 px UI everywhere — extension popup that feels native.
            </h1>
            <p className="mt-5 max-w-xl text-zinc-300 md:text-lg">
              Dojak delivers the exact Home / Receive / Send experience across Chrome/Brave and full native mobile apps.
              Built from a UniSat fork optimized for pure Dogecoin and true self-custody.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <Link href={LINKS.chrome} className="btn-primary justify-center text-center !px-5 !py-3.5">
                Add to Chrome
              </Link>
              <Link href={LINKS.android} className="btn-primary justify-center text-center !px-5 !py-3.5">
                Google Play
              </Link>
              <Link href={LINKS.ios} className="btn-primary justify-center text-center !px-5 !py-3.5">
                App Store
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <Link href={LINKS.github} className="text-zinc-300 underline-offset-4 hover:underline">
                View on GitHub
              </Link>
              <Link href="#features" className="text-zinc-300 underline-offset-4 hover:underline">
                Learn More
              </Link>
            </div>
          </div>

          <WalletPreview />
        </div>
      </section>

      <section className="border-y border-white/10 bg-black/40">
        <p className="mx-auto max-w-6xl px-4 py-4 text-center text-sm font-medium text-zinc-200">
          Identical on Chrome/Brave popup (fixed 402 px) + native mobile • UniSat fork optimized for pure Dogecoin •
          True self-custodial — your keys, your DOGE
        </p>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-bold md:text-4xl">Why shibes choose Dojak</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5">
              <h3 className="text-base font-semibold text-dojak-yellow">{feature.title}</h3>
              <p className="mt-2 text-sm text-zinc-200">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="platforms" className="border-y border-white/10 bg-zinc-950/70">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-3xl font-bold md:text-4xl">One wallet. Every platform. Same 402 px feel.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {platforms.map((item) => (
              <article key={item.title} className="rounded-2xl border border-dojak-yellow/20 bg-black/40 p-6">
                <span className="text-2xl">{item.icon}</span>
                <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-zinc-300">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="download" className="border-y border-white/10 bg-zinc-950/70">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-3xl font-bold md:text-4xl">Download Dojak on every platform</h2>
          <p className="mt-3 max-w-2xl text-zinc-300">
            Bigger yellow CTAs, platform icons, and quick QR placeholders for Android and iOS.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {downloadCards.map((item) => (
              <article key={item.title} className="rounded-2xl border border-dojak-yellow/25 bg-black/45 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm text-dojak-yellow">
                  <span className="text-lg">{item.icon}</span>
                  <span className="font-semibold">{item.title}</span>
                </div>
                <QRPlaceholder label={item.qrLabel} />
                <p className="mt-4 text-sm text-zinc-300">{item.subtitle}</p>
                <Link href={item.href} className="btn-primary mt-5 inline-flex w-full items-center justify-center !py-3.5 text-base">
                  {item.cta}
                </Link>
              </article>
            ))}
          </div>
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
            <Link href={LINKS.github}>GitHub</Link>
            <Link href={LINKS.docs}>Docs</Link>
            <Link href={LINKS.x}>X</Link>
            <Link href={LINKS.telegram}>Telegram</Link>
            <Link href={LINKS.discord}>Discord</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
