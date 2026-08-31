import {
  Fingerprint,
  Layers3,
  MessageCircleHeart,
  PlugZap,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { Pill } from './site-ui';

const scenes = [
  {
    eyebrow: 'Safe Spend',
    title: 'Send DOGE without burning Doginals.',
    body: 'Protocol-linked UTXOs are tagged and kept out of default coin selection. Explicit confirmation before anything inscription- or offer-sensitive is spent — with human-readable warnings.',
    icon: ShieldCheck,
    points: ['Inscription carriers protected by default', 'Listing / offer outs flagged', 'Aligned with dogenals.org semantics']
  },
  {
    eyebrow: 'Full L1 stack',
    title: 'One vault for the whole Dogecoin orbit.',
    body: 'DOGE, Doginals, DRC-20, Dunes, Treats, Charms, Alkanes — balances and transfers in the toolbar, not five half-broken apps.',
    icon: Layers3,
    points: ['Doginals view + transfer', 'DRC-20 tickers', 'Dunes · Treats · Charms · Alkanes']
  },
  {
    eyebrow: 'Ð𝕏 on 𝕏',
    title: 'Tip creators. Bind your handle on-chain.',
    body: 'Native tip controls on posts and profiles. Pay a linked @handle. Bind your 𝕏 identity with tweet proof + compact on-chain DX — without giving anyone your seed.',
    icon: MessageCircleHeart,
    points: ['Tip button on posts', 'Ð𝕏 chip on profiles', 'Pay by linked handle only']
  },
  {
    eyebrow: 'dApps',
    title: 'Connect with window.dojak.',
    body: 'Sites detect isDojak, request accounts, sign PSBTs, send DOGE and inscriptions. Side panel + popup so you approve without leaving the page.',
    icon: PlugZap,
    points: ['requestAccounts · signPsbt', 'sendBitcoin · sendInscription', 'Explicit approval every time']
  }
];

export function FeatureScenes() {
  return (
    <div className="space-y-6">
      {scenes.map((scene, index) => (
        <article
          key={scene.title}
          className={`grid items-center gap-8 overflow-hidden rounded-3xl border border-zinc-200 bg-white p-6 shadow-card md:grid-cols-2 md:p-10 ${
            index % 2 === 1 ? 'md:[&>*:first-child]:order-2' : ''
          }`}
        >
          <div>
            <Pill>{scene.eyebrow}</Pill>
            <h3 className="mt-4 font-display text-2xl font-black tracking-tight md:text-3xl">{scene.title}</h3>
            <p className="mt-3 text-sm leading-7 text-zinc-600 md:text-base">{scene.body}</p>
            <ul className="mt-5 space-y-2">
              {scene.points.map((point) => (
                <li key={point} className="flex items-start gap-2 text-sm font-medium text-zinc-800">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A017]" aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative flex min-h-[220px] items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-950 p-8 text-white">
            <div className="absolute inset-0 site-grid opacity-30" aria-hidden />
            <div className="absolute inset-0 hero-glow opacity-80" aria-hidden />
            <div className="relative flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#D4A017]/50 bg-[#D4A017]/15">
                <scene.icon className="h-8 w-8 text-[#D4A017]" aria-hidden />
              </div>
              <p className="max-w-[16rem] font-serif text-lg italic text-zinc-200">{scene.eyebrow}</p>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
                <Fingerprint className="h-3.5 w-3.5 text-[#D4A017]" aria-hidden />
                On-device keys
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
