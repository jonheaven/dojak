'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { LINKS, NAV_LINKS } from '../lib/site';
import { CTA } from './site-ui';

export function SiteHeader({ dark = false }: { dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const shell = dark
    ? 'border-white/10 bg-zinc-950/85 text-white'
    : 'border-zinc-200 bg-white/90 text-zinc-950';
  const linkClass = dark
    ? 'text-sm font-medium text-zinc-300 transition hover:text-white'
    : 'site-link text-sm font-medium';
  const menuBtn = dark
    ? 'border-white/20 text-white hover:border-[#D4A017]'
    : 'border-zinc-300 text-zinc-950';

  return (
    <header className={`sticky top-0 z-50 border-b backdrop-blur-xl ${shell}`}>
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
          className={`flex h-10 w-10 items-center justify-center rounded-lg border md:hidden ${menuBtn}`}
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass}>
              {item.label}
            </Link>
          ))}
          <CTA href={LINKS.download} label="Get Dojak" primary />
        </nav>
      </div>

      {open ? (
        <div className={`border-t px-4 py-4 md:hidden ${dark ? 'border-white/10' : 'border-zinc-200'}`}>
          <div className="mx-auto flex max-w-6xl flex-col gap-1">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                  dark ? 'text-zinc-200 hover:bg-white/5' : 'text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-2">
              <CTA href={LINKS.download} label="Get Dojak" primary className="w-full" />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
