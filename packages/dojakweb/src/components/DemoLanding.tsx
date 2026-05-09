import React, { useEffect, useState } from 'react';
import { BookOpenText, Code2, Globe, Layers, ShieldCheck, Wallet } from 'lucide-react';
import {
  fetchCommandDogNostrRelayInfo,
  getCommandDogNostrWsUrl,
  isCommandDogNostrConfigured,
} from '../utils/commandDogNostr';

type DemoLandingProps = {
  onConnectWallet: () => void;
  onOpenDmp?: () => void;
  onOpenWallet?: () => void;
  onOpenTools?: (tool?: string) => void;
  onOpenDogetags?: () => void;
  onOpenNostr?: () => void;
};

const valueProps = [
  {
    title: 'First-party wallet UX stack',
    detail: 'Connect, signing, address state, and wallet management flows built for the Dojak product—not redistributed as a public SDK.',
    icon: Layers,
  },
  {
    title: 'Supports how Dogecoin users already sign',
    detail: 'Use local encrypted browser wallets, browser extensions (MyDoge / Dojak / Spooky), and Ledger hardware flows in one API.',
    icon: Wallet,
  },
  {
    title: 'Security-first defaults',
    detail: 'Local wallets are password-encrypted in-browser, while hardware-signing keeps private keys isolated from the web app runtime.',
    icon: ShieldCheck,
  },
];

const useCases = [
  'Dojak-owned surfaces that need the full browser + extension + Ledger matrix',
  'Doginals / Dogenals flows exercised here before shipping in the main product',
  'Engineering demos and QA against the same `@dojak/web` code the extension/web stack uses',
];

const faq = [
  {
    question: 'Where is the open Dogenals standard?',
    answer:
      'Normative protocols live in the public dogenals repo under spec/ (GitHub: jonheaven/dogenals). That is what third parties implement. Dojakweb is proprietary product code built on the standard—not a redistributable library.',
  },
  {
    question: 'Is Dojakweb an npm library for other projects?',
    answer:
      'No. @dojak/web is a private workspace package inside the Dojak monorepo. External teams should read the open spec and ship their own wallet—not install this package.',
  },
  {
    question: 'Can first-party hosts use their own backend/indexer?',
    answer:
      'Yes. Wallet settings can target your own APIs for balances, UTXOs, inscriptions, and DRC-20 data.',
  },
  {
    question: 'Does this demo reflect the internal module APIs?',
    answer:
      'Yes. This app uses the same providers, connect components, and contexts as other first-party Dojak surfaces wired to @dojak/web.',
  },
];

function ActionButton({
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-border-primary bg-bg-secondary p-4 text-left transition hover:border-[#FCD34D]/50 hover:bg-bg-tertiary dark:border-white/10 dark:bg-black/20 dark:hover:border-[#FCD34D]/40 dark:hover:bg-black/30"
    >
      <div className="text-sm font-bold text-text-primary dark:text-white">{label}</div>
      <div className="mt-1 text-xs leading-5 text-text-secondary dark:text-white/65">{description}</div>
    </button>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#FCD34D]">{title}</div>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary dark:text-white/70">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

export function DemoLanding({
  onConnectWallet,
  onOpenDmp,
  onOpenWallet,
  onOpenTools,
  onOpenDogetags,
  onOpenNostr,
}: DemoLandingProps) {
  const [nostrProbe, setNostrProbe] = useState<'idle' | 'checking' | 'online' | 'offline' | 'unset'>('idle');

  useEffect(() => {
    if (!isCommandDogNostrConfigured()) {
      setNostrProbe('unset');
      return;
    }
    let cancelled = false;
    setNostrProbe('checking');
    void (async () => {
      const r = await fetchCommandDogNostrRelayInfo();
      if (cancelled) return;
      setNostrProbe(r.ok ? 'online' : 'offline');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openTools = (tool?: string) => {
    if (onOpenTools) {
      onOpenTools(tool);
      return;
    }
    const suffix = tool ? `?tool=${encodeURIComponent(tool)}` : '';
    window.location.assign(`/tools${suffix}`);
  };

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[28px] border border-border-primary bg-[radial-gradient(circle_at_top_right,rgba(252,211,77,0.35),transparent_32%),linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--muted))_100%)] p-6 shadow-xl dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_right,_rgba(252,211,77,0.18),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.05)_0%,_rgba(0,0,0,0.2)_100%)] dark:shadow-2xl">
        <div className="absolute inset-0 pointer-events-none opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FCD34D]/30 bg-[#FCD34D]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#FCD34D]">
              <Code2 className="h-3.5 w-3.5" />
              Demo DApp
            </div>
            <h1 className="max-w-3xl text-4xl font-black tracking-tight text-text-primary sm:text-5xl dark:text-white">
              Exercise the Dojak wallet stack.
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-text-secondary sm:text-base dark:text-white/72">
              This app runs the same private modular <code className="text-xs">@dojak/web</code> package we reuse across our proprietary
              dApps—local browser wallet, extension adapters, and Ledger flows—while on-chain behavior follows the **open** Dogenals standard
              (<code className="text-xs">dogenals/spec</code>). Not a redistributable SDK for third parties; they implement the spec in their own codebases.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onConnectWallet}
                className="inline-flex items-center justify-center rounded-2xl bg-[#FCD34D] px-5 py-3 text-sm font-bold text-black transition hover:bg-[#fde68a]"
              >
                Connect Wallet
              </button>
              <button
                type="button"
                onClick={() => openTools()}
                className="inline-flex items-center justify-center rounded-2xl border border-border-primary bg-bg-secondary px-5 py-3 text-sm font-semibold text-text-primary transition hover:border-primary/40 hover:bg-bg-tertiary dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/20 dark:hover:bg-white/10"
              >
                Open Tools
              </button>
              <button
                type="button"
                onClick={() => onOpenDmp?.()}
                className="inline-flex items-center justify-center rounded-2xl border border-border-primary bg-bg-secondary px-5 py-3 text-sm font-semibold text-text-primary transition hover:border-primary/40 hover:bg-bg-tertiary dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/20 dark:hover:bg-white/10"
              >
                Open ÐMP
              </button>
              <button
                type="button"
                onClick={() => onOpenWallet?.()}
                className="inline-flex items-center justify-center rounded-2xl border border-border-primary bg-bg-secondary px-5 py-3 text-sm font-semibold text-text-primary transition hover:border-primary/40 hover:bg-bg-tertiary dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/20 dark:hover:bg-white/10"
              >
                Open Wallet
              </button>
              <button
                type="button"
                onClick={() => onOpenDogetags?.()}
                className="inline-flex items-center justify-center rounded-2xl border border-border-primary bg-bg-secondary px-5 py-3 text-sm font-semibold text-text-primary transition hover:border-primary/40 hover:bg-bg-tertiary dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/20 dark:hover:bg-white/10"
              >
                Open ÐogeTags
              </button>
              {onOpenNostr ? (
                <button
                  type="button"
                  onClick={() => onOpenNostr()}
                  className="inline-flex items-center justify-center rounded-2xl border border-border-primary bg-bg-secondary px-5 py-3 text-sm font-semibold text-text-primary transition hover:border-primary/40 hover:bg-bg-tertiary dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/20 dark:hover:bg-white/10"
                >
                  Nostr relay
                </button>
              ) : null}
            </div>
          </div>

          <div className="space-y-3 rounded-3xl border border-border-primary bg-bg-secondary/90 p-5 dark:border-white/10 dark:bg-black/30">
            <div className="flex items-center gap-2 text-sm font-bold text-text-primary dark:text-white">
              <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
              Current State
            </div>
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border border-border-primary bg-bg-primary p-3 dark:border-white/10 dark:bg-black/25">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-tertiary dark:text-white/45">Wallet</div>
                <div className="mt-1 text-text-primary dark:text-white">Connect a wallet to show state</div>
              </div>
              <div className="rounded-xl border border-border-primary bg-bg-primary p-3 dark:border-white/10 dark:bg-black/25">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-tertiary dark:text-white/45">Tools access</div>
                <div className="mt-1 text-text-primary dark:text-white">Available via Tools in the sidebar or `/tools`.</div>
              </div>
              <div className="rounded-xl border border-border-primary bg-bg-primary p-3 dark:border-white/10 dark:bg-black/25">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-tertiary dark:text-white/45">Best use</div>
                <div className="mt-1 text-text-primary dark:text-white">QA wallet flows here, then use Tools for PSDT inspection.</div>
              </div>
              <div className="rounded-xl border border-border-primary bg-bg-primary p-3 dark:border-white/10 dark:bg-black/25">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-tertiary dark:text-white/45">Command.dog Nostr</div>
                <div className="mt-1 text-xs leading-5 text-text-primary dark:text-white">
                  {nostrProbe === 'unset' ? (
                    <span className="text-text-secondary dark:text-white/65">
                      Not wired in this build (set <code className="text-[10px]">VITE_COMMAND_DOG_NOSTR_URL</code> for production).
                    </span>
                  ) : nostrProbe === 'checking' ? (
                    <span className="text-text-secondary dark:text-white/65">Checking relay…</span>
                  ) : nostrProbe === 'online' ? (
                    <span className="text-emerald-700 dark:text-emerald-300">
                      Relay online (NIP-11). WS:{' '}
                      <code className="break-all text-[10px] text-text-primary dark:text-white/90">{getCommandDogNostrWsUrl()}</code>
                    </span>
                  ) : nostrProbe === 'offline' ? (
                    <span className="text-amber-800 dark:text-amber-200">
                      Configured but unreachable — start <code className="text-[10px]">nostr-rs-relay</code> or check the dev proxy port.
                    </span>
                  ) : (
                    <span className="text-text-secondary dark:text-white/65">—</span>
                  )}
                </div>
                {onOpenNostr && nostrProbe !== 'unset' ? (
                  <button
                    type="button"
                    onClick={() => onOpenNostr()}
                    className="mt-2 text-xs font-semibold text-[#FCD34D] underline-offset-2 hover:underline"
                  >
                    Open Nostr page
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Section
        title="Capabilities"
        subtitle="A categorized tour of the wallet stack already wired into the app."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {valueProps.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="rounded-3xl border border-border-primary bg-card p-6 shadow-md dark:border-white/10 dark:bg-[#0A0A0A] dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
              >
                <div className="inline-flex rounded-xl border border-border-primary bg-bg-secondary p-2 dark:border-white/10 dark:bg-white/5">
                  <Icon className="h-5 w-5 text-[#FCD34D]" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-text-primary dark:text-white">{item.title}</h2>
                <p className="mt-2 text-sm leading-7 text-text-secondary dark:text-[#D4D4D4]">{item.detail}</p>
              </article>
            );
          })}
        </div>
      </Section>

      <Section
        title="Self Test Suite"
        subtitle="Quickly jump into the workflows that matter when you are verifying wallet behavior, integration points, or support cases."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ActionButton
            label="PSDT Analyzer"
            description="Paste raw PSDT/base64/hex and inspect every field."
            onClick={() => openTools('psbt')}
          />
          <ActionButton
            label="UTXO Manager"
            description="Review lock state, merge/split candidates, and spendable balance."
            onClick={() => openTools('manager')}
          />
          <ActionButton
            label="Validators"
            description="Run seller listing safety checks and inspect errors before buy attempts."
            onClick={() => openTools('validators')}
          />
          <ActionButton
            label="Buy inscription"
            description="Paste dogepsdt / listing PSDT from a QR or link, validate, sign as buyer, broadcast."
            onClick={() => openTools('buy')}
          />
        </div>
      </Section>

      <Section
        title="Wallet Support Matrix"
        subtitle="High-signal summary of what the app integration currently claims and tests."
      >
        <div className="overflow-hidden rounded-2xl border border-border-primary bg-bg-secondary dark:border-white/10 dark:bg-black/25">
          <div className="grid grid-cols-[1.3fr_repeat(5,minmax(0,1fr))] gap-px bg-border-primary/30 text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary dark:bg-white/5 dark:text-white/55">
            <div className="bg-bg-tertiary p-3 dark:bg-black/40">Feature</div>
            <div className="bg-bg-tertiary p-3 dark:bg-black/40">Browser</div>
            <div className="bg-bg-tertiary p-3 dark:bg-black/40">MyDoge</div>
            <div className="bg-bg-tertiary p-3 dark:bg-black/40">Spooky</div>
            <div className="bg-bg-tertiary p-3 dark:bg-black/40">Dojak</div>
            <div className="bg-bg-tertiary p-3 dark:bg-black/40">Ledger</div>
          </div>
          <div className="divide-y divide-border-primary dark:divide-white/5">
            {[
              { feature: 'Connect / disconnect', browser: 'yes', mydoge: 'yes', spooky: 'yes', dojak: 'yes', ledger: 'yes' },
              { feature: 'Sign messages', browser: 'yes', mydoge: 'yes', spooky: 'yes', dojak: 'yes', ledger: 'yes' },
              { feature: 'Sign PSDTs', browser: 'yes', mydoge: 'yes', spooky: 'yes', dojak: 'yes', ledger: 'partial' },
              { feature: 'PSDT probes', browser: 'yes', mydoge: 'yes', spooky: 'yes', dojak: 'yes', ledger: 'no' },
              { feature: 'In-browser UTXO tools', browser: 'yes', mydoge: 'yes', spooky: 'yes', dojak: 'yes', ledger: 'yes' },
              { feature: 'Message / PSDT debug logging', browser: 'yes', mydoge: 'yes', spooky: 'yes', dojak: 'yes', ledger: 'yes' },
            ].map((row) => (
              <div key={row.feature} className="grid grid-cols-[1.3fr_repeat(5,minmax(0,1fr))] gap-px bg-border-primary/20 dark:bg-white/5">
                <div className="bg-bg-primary p-3 text-sm text-text-primary dark:bg-black/20 dark:text-white">{row.feature}</div>
                <div className="bg-bg-primary p-3 text-sm text-text-secondary dark:bg-black/20 dark:text-white/80">{row.browser}</div>
                <div className="bg-bg-primary p-3 text-sm text-text-secondary dark:bg-black/20 dark:text-white/80">{row.mydoge}</div>
                <div className="bg-bg-primary p-3 text-sm text-text-secondary dark:bg-black/20 dark:text-white/80">{row.spooky}</div>
                <div className="bg-bg-primary p-3 text-sm text-text-secondary dark:bg-black/20 dark:text-white/80">{row.dojak}</div>
                <div className="bg-bg-primary p-3 text-sm text-text-secondary dark:bg-black/20 dark:text-white/80">{row.ledger}</div>
              </div>
            ))}
          </div>
          <div className="border-t border-border-primary bg-bg-secondary p-4 text-xs text-text-secondary dark:border-white/10 dark:bg-black/30 dark:text-white/60">
            This matrix reflects the integration points wired into the app. The live tests below prove the currently
            connected wallet.
          </div>
        </div>
      </Section>

      <Section
        title="Internal QA surface"
        subtitle="This Vite app is for engineering and support—not a template for external npm consumers."
      >
        <article className="rounded-3xl border border-border-primary bg-card p-6 shadow-md dark:border-white/10 dark:bg-[#0A0A0A] dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-[#FCD34D]" />
            <h2 className="text-xl font-bold text-text-primary dark:text-white">Who this is for</h2>
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-text-secondary sm:text-base dark:text-[#D4D4D4]">
            {useCases.map((item) => (
              <li key={item} className="rounded-xl border border-border-primary bg-bg-secondary px-3 py-2 dark:border-white/10 dark:bg-white/5">
                {item}
              </li>
            ))}
          </ul>
        </article>
      </Section>

      <Section
        title="FAQ / docs notes"
        subtitle="The demo page doubles as a short integration guide."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {faq.map((item) => (
            <article key={item.question} className="rounded-2xl border border-border-primary bg-bg-secondary p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <h3 className="text-sm font-semibold text-text-primary sm:text-base dark:text-white">{item.question}</h3>
              <p className="mt-2 text-sm leading-7 text-text-secondary dark:text-[#D4D4D4]">{item.answer}</p>
            </article>
          ))}
        </div>
        <article className="rounded-3xl border border-border-primary bg-card p-6 shadow-md sm:p-8 dark:border-white/10 dark:bg-[#0A0A0A] dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <div className="flex items-center gap-2">
            <BookOpenText className="h-5 w-5 text-[#FCD34D]" />
            <h2 className="text-xl font-bold text-text-primary dark:text-white">Tools</h2>
          </div>
          <p className="mt-4 text-sm leading-7 text-text-secondary dark:text-[#D4D4D4]">
            The PSDT analyzer, validator checks, UTXO inspector, and probe tools live in the same app shell. Use the
            sidebar to jump between the demo homepage and the tools area.
          </p>
        </article>
      </Section>
    </div>
  );
}

export default DemoLanding;
