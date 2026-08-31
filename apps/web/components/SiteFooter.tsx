import Image from 'next/image';
import Link from 'next/link';
import { LINKS } from '../lib/site';

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 text-zinc-400">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="flex items-center gap-2 text-lg font-black text-white">
            <Image src="/icons/icon-32.png" alt="" width={24} height={24} className="rounded" />
            Dojak
          </p>
          <p className="mt-3 max-w-sm text-sm leading-6">
            The self-custodial Dogecoin wallet for DOGE, Doginals, DRC-20, Dunes, and the full Dogenals stack.
            Keys stay on your device. Built for the shibes.
          </p>
          <p className="mt-4 font-serif text-sm italic text-zinc-500">Add it. Own it. Browse free.</p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Product</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/download" className="hover:text-[#D4A017]">
                Download
              </Link>
            </li>
            <li>
              <Link href="/#features" className="hover:text-[#D4A017]">
                Features
              </Link>
            </li>
            <li>
              <Link href="/security" className="hover:text-[#D4A017]">
                Security
              </Link>
            </li>
            <li>
              <Link href="/developers" className="hover:text-[#D4A017]">
                Developers
              </Link>
            </li>
            <li>
              <Link href="/faq" className="hover:text-[#D4A017]">
                FAQ
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Trust</p>
          <ul className="mt-3 space-y-2 text-sm">
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
            <li>
              <Link href="/dogenals" className="hover:text-[#D4A017]">
                Protocol Wall
              </Link>
            </li>
            <li>
              <a href={LINKS.dogenals} target="_blank" rel="noreferrer" className="hover:text-[#D4A017]">
                dogenals.org
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Orbit</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a href={LINKS.dogenalsCom} target="_blank" rel="noreferrer" className="hover:text-[#D4A017]">
                dogenals.com
              </a>
            </li>
            <li>
              <a href={LINKS.explorer} target="_blank" rel="noreferrer" className="hover:text-[#D4A017]">
                Ðexplorer
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
          <span className="font-serif italic text-zinc-400">Much wallet. Very self-custody.</span>
        </div>
      </div>
    </footer>
  );
}
