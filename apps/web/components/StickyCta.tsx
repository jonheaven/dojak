'use client';

import { useEffect, useState } from 'react';
import { LINKS } from '../lib/site';
import { CTA } from './site-ui';

/** Compact install bar after scrolling past the hero. */
export function StickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 640);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3 text-white backdrop-blur-xl transition duration-300 md:hidden ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">Get Dojak</p>
          <p className="truncate text-xs text-zinc-400">Extension · mobile · web</p>
        </div>
        <CTA href={LINKS.download} label="Install" primary className="shrink-0 !min-h-10 !px-4" />
      </div>
    </div>
  );
}
