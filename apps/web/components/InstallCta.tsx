'use client';

import { useEffect, useMemo, useState } from 'react';
import { Chrome, Globe, Smartphone } from 'lucide-react';
import { LINKS } from '../lib/site';
import { CTA } from './site-ui';

type BrowserKind = 'chrome' | 'brave' | 'edge' | 'firefox' | 'safari' | 'mobile' | 'other';

function detectBrowser(): BrowserKind {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
  if (/Edg\//i.test(ua)) return 'edge';
  if (/Brave/i.test(ua) || (navigator as Navigator & { brave?: unknown }).brave) return 'brave';
  if (/Firefox/i.test(ua)) return 'firefox';
  if (/Safari/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua)) return 'safari';
  if (/Chrome|Chromium/i.test(ua)) return 'chrome';
  return 'other';
}

const LABELS: Record<BrowserKind, { label: string; href: string; secondaryLabel: string; secondaryHref: string }> = {
  chrome: {
    label: 'Install for Chrome',
    href: LINKS.chromeStore,
    secondaryLabel: 'Get Mobile',
    secondaryHref: LINKS.mobileWaitlist
  },
  brave: {
    label: 'Install for Brave',
    href: LINKS.brave,
    secondaryLabel: 'Get Mobile',
    secondaryHref: LINKS.mobileWaitlist
  },
  edge: {
    label: 'Install for Edge',
    href: LINKS.edge,
    secondaryLabel: 'Get Mobile',
    secondaryHref: LINKS.mobileWaitlist
  },
  firefox: {
    label: 'Firefox — coming soon',
    href: LINKS.firefox,
    secondaryLabel: 'Try Chrome build',
    secondaryHref: LINKS.chromeStore
  },
  safari: {
    label: 'Get iOS Waitlist',
    href: LINKS.ios,
    secondaryLabel: 'Open Web Demo',
    secondaryHref: LINKS.webWallet
  },
  mobile: {
    label: 'Get Mobile Apps',
    href: LINKS.mobileWaitlist,
    secondaryLabel: 'Open Web Demo',
    secondaryHref: LINKS.webWallet
  },
  other: {
    label: 'Install Extension',
    href: LINKS.chromeStore,
    secondaryLabel: 'All platforms',
    secondaryHref: LINKS.download
  }
};

export function InstallCta({
  className = '',
  secondaryClassName = ''
}: {
  className?: string;
  secondaryClassName?: string;
}) {
  const [kind, setKind] = useState<BrowserKind>('other');

  useEffect(() => {
    setKind(detectBrowser());
  }, []);

  const copy = useMemo(() => LABELS[kind], [kind]);

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <CTA href={copy.href} label={copy.label} primary />
      <CTA href={copy.secondaryHref} label={copy.secondaryLabel} className={secondaryClassName} />
    </div>
  );
}

export function BrowserChipRow({ className = '' }: { className?: string }) {
  const chips = [
    { icon: Chrome, label: 'Chrome' },
    { icon: Globe, label: 'Brave' },
    { icon: Globe, label: 'Edge' },
    { icon: Smartphone, label: 'Android · iOS' }
  ];
  return (
    <div className={`flex flex-wrap items-center gap-3 text-sm text-zinc-500 ${className}`}>
      {chips.map((chip, i) => (
        <span key={chip.label} className="inline-flex items-center gap-1.5">
          {i > 0 ? <span className="mr-1 text-zinc-300">·</span> : null}
          <chip.icon className="h-3.5 w-3.5" aria-hidden />
          {chip.label}
        </span>
      ))}
    </div>
  );
}
