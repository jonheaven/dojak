import type { ReactNode } from 'react';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

export function SiteShell({
  children,
  headerDark = false,
  className = 'bg-white text-zinc-950'
}: {
  children: ReactNode;
  headerDark?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative min-h-screen overflow-x-hidden ${className}`}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[#D4A017] focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-zinc-950"
      >
        Skip to content
      </a>
      <SiteHeader dark={headerDark} />
      <div id="main">{children}</div>
      <SiteFooter />
    </div>
  );
}
