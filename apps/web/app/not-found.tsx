import { SiteShell } from '../components/SiteShell';
import { CTA } from '../components/site-ui';
import { LINKS } from '../lib/site';

export default function NotFound() {
  return (
    <SiteShell>
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A67C0F]">404</p>
        <h1 className="mt-3 font-display text-4xl font-black tracking-tight md:text-5xl">
          Such empty. Very lost.
        </h1>
        <p className="mt-4 text-zinc-600">
          That page is not in the vault. Head home or grab the wallet while you&apos;re here.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <CTA href="/" label="Back home" primary />
          <CTA href={LINKS.download} label="Download Dojak" />
        </div>
      </div>
    </SiteShell>
  );
}
