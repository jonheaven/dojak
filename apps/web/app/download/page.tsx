import type { Metadata } from 'next';
import { Globe, Puzzle, Smartphone, MonitorSmartphone } from 'lucide-react';
import { BrowserChipRow, InstallCta } from '../../components/InstallCta';
import { SiteShell } from '../../components/SiteShell';
import { WalletPopupMock } from '../../components/WalletPopupMock';
import { CTA, PageHeader, Pill, StatusBadge } from '../../components/site-ui';
import { LINKS } from '../../lib/site';

export const metadata: Metadata = {
  title: 'Download Dojak — Chrome Extension, Mobile & Web Wallet',
  description:
    'Install the Dojak Dogecoin wallet: Chrome / Brave / Edge extension, Android early access, iOS waitlist, and local web demo. Self-custodial. Protocol-aware.',
  alternates: { canonical: 'https://dojak.app/download' },
  openGraph: {
    title: 'Download Dojak Wallet',
    description: 'Extension, mobile, and web — the Dogecoin wallet done right.',
    url: 'https://dojak.app/download'
  }
};

const surfaces = [
  {
    id: 'extension',
    name: 'Browser Extension',
    badge: 'Live' as const,
    tone: 'live' as const,
    icon: Puzzle,
    body: 'Primary product. Side panel + popup, Safe Spend, Ð𝕏 tips, window.dojak for dApps.',
    href: LINKS.chromeStore,
    cta: 'Chrome Web Store',
    note: 'Works in Chrome, Brave, and Edge (Chromium).'
  },
  {
    id: 'android',
    name: 'Android',
    badge: 'Early Access' as const,
    tone: 'early' as const,
    icon: Smartphone,
    body: 'Mobile signing path expanding. Pair and approve flows landing next.',
    href: LINKS.android,
    cta: 'Google Play',
    note: 'Early access — expect rapid iteration.'
  },
  {
    id: 'ios',
    name: 'iOS',
    badge: 'Coming Soon' as const,
    tone: 'soon' as const,
    icon: Smartphone,
    body: 'Self-custodial iOS wallet on the release track. Join the waitlist for launch updates.',
    href: LINKS.ios,
    cta: 'Join Waitlist',
    note: 'No App Store listing yet — bookmark this page.'
  },
  {
    id: 'web',
    name: 'Web Wallet',
    badge: 'Local-Only' as const,
    tone: 'local' as const,
    icon: MonitorSmartphone,
    body: 'Browser demo with local-first keys. Perfect for quick tests — extension remains the daily driver.',
    href: LINKS.webWallet,
    cta: 'Open Web Demo',
    note: 'Keys stay in the browser session / local vault of the demo.'
  },
  {
    id: 'firefox',
    name: 'Firefox',
    badge: 'Coming Soon' as const,
    tone: 'soon' as const,
    icon: Globe,
    body: 'Firefox Add-ons listing is on the track. Chromium build is recommended today.',
    href: LINKS.firefox,
    cta: 'Firefox status',
    note: 'Use Chrome / Brave / Edge until the AMO listing ships.'
  }
];

export default function DownloadPage() {
  return (
    <SiteShell>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 site-grid site-grid-fade" />
      <div className="relative mx-auto max-w-6xl px-4 py-14">
        <PageHeader
          eyebrow="Download"
          title="Get Dojak on every surface"
          description="Install the flagship Dogecoin wallet. Extension first. Mobile and web complete the orbit. Keys stay with you."
        />

        <section className="mt-10 grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <Pill>Recommended</Pill>
            <h2 className="font-display text-3xl font-black tracking-tight md:text-4xl">
              Start with the browser extension
            </h2>
            <p className="text-zinc-600">
              One click from the store. Encrypted vault. Protocol-aware coin selection. Tip on 𝕏. Connect dApps
              without a custodial detour.
            </p>
            <InstallCta />
            <BrowserChipRow />
          </div>
          <WalletPopupMock />
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-2">
          {surfaces.map((surface) => (
            <article id={surface.id} key={surface.id} className="site-card flex flex-col scroll-mt-24 p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#D4A017]/50 bg-[#D4A017]/10">
                  <surface.icon className="h-5 w-5" aria-hidden />
                </div>
                <StatusBadge tone={surface.tone}>{surface.badge}</StatusBadge>
              </div>
              <h3 className="mt-4 text-xl font-bold">{surface.name}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-zinc-600">{surface.body}</p>
              <p className="mt-3 text-xs text-zinc-500">{surface.note}</p>
              <div className="mt-5">
                <CTA href={surface.href} label={surface.cta} primary={surface.tone === 'live'} className="w-full" />
              </div>
            </article>
          ))}
        </section>

        <section id="mobile" className="mt-10 scroll-mt-24 rounded-2xl border-2 border-zinc-900 bg-zinc-950 p-8 text-white md:p-10">
          <Pill inverted>Mobile</Pill>
          <h2 className="mt-4 font-display text-2xl font-black md:text-3xl">Pocket signing on the way</h2>
          <p className="mt-3 max-w-2xl text-zinc-300">
            Android early access and iOS waitlist keep signing on the phone. Extension vault remains fully
            self-custodial if you prefer keys in the browser today.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <CTA href={LINKS.android} label="Android" primary />
            <CTA
              href={LINKS.ios}
              label="iOS Waitlist"
              className="!border-white/30 !bg-transparent !text-white hover:!border-[#D4A017]"
            />
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
