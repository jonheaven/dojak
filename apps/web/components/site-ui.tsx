import Link from 'next/link';
import type { ReactNode } from 'react';

export function Pill({ children, inverted = false }: { children: ReactNode; inverted?: boolean }) {
  return <span className={inverted ? 'site-pill-inverted' : 'site-pill'}>{children}</span>;
}

export function CTA({
  href,
  label,
  primary = false
}: {
  href: string;
  label: string;
  primary?: boolean;
}) {
  const external = href.startsWith('http');
  return (
    <Link
      href={href}
      className={primary ? 'site-btn-primary' : 'site-btn-secondary'}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
    >
      {label}
    </Link>
  );
}

export function PageBack({ href = '/', label = '← Back to Dojak Home' }: { href?: string; label?: string }) {
  return (
    <Link href={href} className="site-link text-sm font-medium">
      {label}
    </Link>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: ReactNode;
}) {
  return (
    <header className="site-card mt-6 p-8 md:p-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A67C0F]">{eyebrow}</p>
      <h1 className="mt-3 text-balance text-4xl font-black tracking-tight text-zinc-950 md:text-5xl">{title}</h1>
      <p className="mt-4 max-w-3xl text-pretty text-base leading-7 text-zinc-600">{description}</p>
    </header>
  );
}
