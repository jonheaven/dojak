'use client';

import React from 'react';
import {
  ArrowTopRightOnSquareIcon,
  ArrowPathIcon,
  BeakerIcon,
  BoltIcon,
  CheckBadgeIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
  ShieldCheckIcon,
  TagIcon,
  WalletIcon,
  ChartBarIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline';
import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';
import { buildDummyUtxoPSDT, getAddressUtxos, selectUtxos, type OrdUtxo } from '../lib/doginal-psdt';
import type { SimpleWallet } from '../lib/simple-wallet';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

type CapabilityCard = {
  title: string;
  description: string;
  accent: string;
  icon: React.ReactNode;
  action?: { label: string; onClick: () => void };
};

type WalletSupportRow = {
  feature: string;
  browser: 'yes' | 'partial' | 'no';
  mydoge: 'yes' | 'partial' | 'no';
  spooky: 'yes' | 'partial' | 'no';
  dojak: 'yes' | 'partial' | 'no';
  ledger: 'yes' | 'partial' | 'no';
};

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
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

function CapabilityTile({ title, description, accent, icon, action }: CapabilityCard) {
  return (
    <div className="rounded-2xl border border-border-primary bg-bg-secondary p-4 shadow-sm dark:border-white/10 dark:bg-black/25 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <div className="flex items-start gap-3">
        <div className={cx('rounded-xl border border-border-primary p-2 dark:border-white/10', accent)}>{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-text-primary dark:text-white">{title}</div>
          <div className="mt-1 text-xs leading-5 text-text-secondary dark:text-white/65">{description}</div>
        </div>
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-border-primary bg-bg-tertiary px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:border-primary/40 hover:bg-bg-secondary dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/20 dark:hover:bg-white/10"
        >
          {action.label}
          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

function ActionButton({
  label,
  description,
  icon,
  onClick,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-border-primary bg-bg-secondary p-4 text-left transition hover:border-[#FCD34D]/50 hover:bg-bg-tertiary dark:border-white/10 dark:bg-black/20 dark:hover:border-[#FCD34D]/40 dark:hover:bg-black/30"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-border-primary bg-bg-primary p-2 text-[#FCD34D] dark:border-white/10 dark:bg-black/30">{icon}</div>
        <div>
          <div className="text-sm font-bold text-text-primary dark:text-white">{label}</div>
          <div className="mt-1 text-xs leading-5 text-text-secondary dark:text-white/65">{description}</div>
        </div>
      </div>
    </button>
  );
}

function SupportPill({ value }: { value: 'yes' | 'partial' | 'no' }) {
  const styles =
    value === 'yes'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
      : value === 'partial'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
        : 'border-border-primary bg-bg-tertiary text-text-tertiary dark:border-white/10 dark:bg-white/5 dark:text-white/45';
  return (
    <span className={cx('inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]', styles)}>
      {value}
    </span>
  );
}

export function DemoHub({
  wallet,
  onNavigateToSection,
}: {
  wallet: SimpleWallet | null;
  onNavigateToSection?: (section: string) => void;
}) {
  const { walletType, connected, address: connectedAddress, signMessage, signPSBTOnly } = useUnifiedWallet();
  const walletAddress = wallet?.getAddress?.() ?? null;
  const activeAddress = connectedAddress ?? walletAddress ?? null;
  const [liveMessageStatus, setLiveMessageStatus] = React.useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [livePsbtStatus, setLivePsbtStatus] = React.useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [liveMessageResult, setLiveMessageResult] = React.useState<string | null>(null);
  const [livePsbtResult, setLivePsbtResult] = React.useState<{ length: number; prefix: string; signMode: string } | null>(null);
  const [liveError, setLiveError] = React.useState<string | null>(null);

  const capabilities: CapabilityCard[] = [
    {
      title: 'Wallet support',
      description: 'Browser wallet, MyDoge, Dojak, SpookyDoge, and Ledger support with logging-rich adapter paths.',
      accent: 'bg-emerald-500/10 text-emerald-300',
      icon: <WalletIcon className="h-5 w-5" aria-hidden />,
    },
    {
      title: 'PSDT workflows',
      description: 'Listing PSDT creation, buyer PSDT assembly, signing, and QR / URI publishing for review.',
      accent: 'bg-yellow-500/10 text-yellow-300',
      icon: <PaperAirplaneIcon className="h-5 w-5" aria-hidden />,
    },
    {
      title: 'Asset surfaces',
      description: 'Wallet holdings, DRC-20 tokens, inscriptions, and transaction tracking.',
      accent: 'bg-cyan-500/10 text-cyan-300',
      icon: <CubeIcon className="h-5 w-5" aria-hidden />,
    },
    {
      title: 'Provider checks',
      description: 'Wallet settings, adapter checks, and API health views for the demo stack.',
      accent: 'bg-fuchsia-500/10 text-fuchsia-300',
      icon: <TagIcon className="h-5 w-5" aria-hidden />,
    },
    {
      title: 'Pro debug surface',
      description: 'PSDT analyzer, Coins manager, validator checks, and wallet probe hooks are available in Tools.',
      accent: 'bg-amber-500/10 text-amber-300',
      icon: <BeakerIcon className="h-5 w-5" aria-hidden />,
    },
    {
      title: 'Operational checks',
      description: 'Balance refresh, RPC reachability, and wallet health checks for support cases.',
      accent: 'bg-sky-500/10 text-sky-300',
      icon: <ChartBarIcon className="h-5 w-5" aria-hidden />,
    },
  ];

  const supportRows: WalletSupportRow[] = [
    { feature: 'Connect / disconnect', browser: 'yes', mydoge: 'yes', spooky: 'yes', dojak: 'yes', ledger: 'yes' },
    { feature: 'Sign messages', browser: 'yes', mydoge: 'yes', spooky: 'yes', dojak: 'yes', ledger: 'yes' },
    { feature: 'Sign PSDTs', browser: 'yes', mydoge: 'yes', spooky: 'yes', dojak: 'yes', ledger: 'partial' },
    { feature: 'PSDT probes', browser: 'yes', mydoge: 'yes', spooky: 'yes', dojak: 'yes', ledger: 'no' },
    { feature: 'In-browser UTXO tools', browser: 'yes', mydoge: 'yes', spooky: 'yes', dojak: 'yes', ledger: 'yes' },
    { feature: 'Message / PSDT debug logging', browser: 'yes', mydoge: 'yes', spooky: 'yes', dojak: 'yes', ledger: 'yes' },
  ];

  const runLiveMessageTest = async () => {
    setLiveError(null);
    setLiveMessageResult(null);
    setLiveMessageStatus('running');
    const payload = `Dojakweb wallet demo message\nwallet=${walletType ?? 'unknown'}\naddress=${activeAddress ?? 'n/a'}\nts=${new Date().toISOString()}`;
    console.log('[DemoHub] liveMessageTest:start', { walletType, payload });
    try {
      const signature = await signMessage(payload);
      setLiveMessageResult(signature);
      setLiveMessageStatus('done');
      console.log('[DemoHub] liveMessageTest:result', { length: signature.length, prefix: signature.slice(0, 32) });
    } catch (error) {
      console.error('[DemoHub] liveMessageTest:error', error);
      setLiveError(error instanceof Error ? error.message : 'Message signing failed');
      setLiveMessageStatus('error');
    }
  };

  const runLivePsbtTest = async () => {
    setLiveError(null);
    setLivePsbtResult(null);
    setLivePsbtStatus('running');
    console.log('[DemoHub] livePsbtTest:start', { walletType, address: activeAddress });
    try {
      if (!activeAddress) {
        throw new Error('Connect a wallet first.');
      }
      const utxos = await getAddressUtxos(activeAddress);
      console.log('[DemoHub] livePsbtTest:utxos', { count: utxos.length });
      const selected = selectUtxos(utxos, 0, 1, 1);
      const psbt = await buildDummyUtxoPSDT(activeAddress, selected as OrdUtxo[]);
      console.log('[DemoHub] livePsbtTest:psbt-built', { length: psbt.length, prefix: psbt.slice(0, 32) });
      const signed = await signPSBTOnly(psbt);
      setLivePsbtResult({
        length: signed.length,
        prefix: signed.slice(0, 32),
        signMode: walletType === 'mydoge' ? 'requestPsbt' : 'signPsbtOnly',
      });
      setLivePsbtStatus('done');
      console.log('[DemoHub] livePsbtTest:result', {
        length: signed.length,
        prefix: signed.slice(0, 32),
      });
    } catch (error) {
      console.error('[DemoHub] livePsbtTest:error', error);
      setLiveError(error instanceof Error ? error.message : 'PSDT signing failed');
      setLivePsbtStatus('error');
    }
  };

  const openTool = (tool?: string) => {
    if (!tool) {
      onNavigateToSection?.('tool-overview');
      return;
    }
    if (onNavigateToSection) {
      onNavigateToSection(`tool-${tool}`);
      return;
    }
    window.location.assign(`/tools?tool=${encodeURIComponent(tool)}`);
  };

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[28px] border border-border-primary bg-[radial-gradient(circle_at_top_right,rgba(252,211,77,0.35),transparent_32%),linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--muted))_100%)] p-6 shadow-xl dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_right,_rgba(252,211,77,0.18),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.05)_0%,_rgba(0,0,0,0.2)_100%)] dark:shadow-2xl">
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:32px_32px] pointer-events-none" />
        <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FCD34D]/30 bg-[#FCD34D]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#FCD34D]">
              <BoltIcon className="h-3.5 w-3.5" aria-hidden />
              Dojak
            </div>
            <h1 className="max-w-3xl text-4xl font-black tracking-tight text-text-primary sm:text-5xl dark:text-white">
              A full Dogecoin wallet stack and tools surface in one app.
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-text-secondary sm:text-base dark:text-white/72">
              This build is meant to showcase the entire stack: wallet onboarding, browser extension support, asset
              management, and a dedicated pro-grade tools area for PSDTs, coins, and wallet adapters.
            </p>
            <div className="flex flex-wrap gap-3">
              <ActionButton
                label="Open Tools"
                description="Inspect PSDTs, validate listings, and manage coins."
                icon={<BeakerIcon className="h-5 w-5" aria-hidden />}
                onClick={() => openTool()}
              />
              <ActionButton
                label="Open Wallet"
                description="View balances, inscriptions, tokens, and UTXO management."
                icon={<WalletIcon className="h-5 w-5" aria-hidden />}
                onClick={() => onNavigateToSection?.('wallet')}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-3xl border border-border-primary bg-bg-secondary/90 p-5 dark:border-white/10 dark:bg-black/30">
            <div className="flex items-center gap-2 text-sm font-bold text-text-primary dark:text-white">
              <CheckBadgeIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-300" aria-hidden />
              Current State
            </div>
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border border-border-primary bg-bg-primary p-3 dark:border-white/10 dark:bg-black/25">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-tertiary dark:text-white/45">Wallet</div>
                <div className="mt-1 text-text-primary dark:text-white">{activeAddress ? 'Connected' : 'Not connected'}</div>
                <div className="mt-1 break-all font-mono text-xs text-text-secondary dark:text-white/65">{activeAddress ?? 'Connect a wallet to show state'}</div>
              </div>
              <div className="rounded-xl border border-border-primary bg-bg-primary p-3 dark:border-white/10 dark:bg-black/25">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-tertiary dark:text-white/45">Tools access</div>
                <div className="mt-1 text-text-primary dark:text-white">Available via the Tools nav entry or `/tools`.</div>
              </div>
              <div className="rounded-xl border border-border-primary bg-bg-primary p-3 dark:border-white/10 dark:bg-black/25">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-tertiary dark:text-white/45">Best use</div>
                <div className="mt-1 text-text-primary dark:text-white">Reverse engineer wallet payloads, validate PSDTs, and manage coins safely.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Section
        title="Capabilities"
        subtitle="A categorized tour of the features already wired into the app."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {capabilities.map((capability) => (
            <CapabilityTile key={capability.title} {...capability} />
          ))}
        </div>
      </Section>

      <Section
        title="Self Test Suite"
        subtitle="Quickly jump into the workflows that matter when you are verifying behavior, integration points, or support cases."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ActionButton
            label="PSDT Analyzer"
            description="Paste raw PSDT/base64/hex and inspect every field."
            icon={<BeakerIcon className="h-5 w-5" aria-hidden />}
            onClick={() => openTool('psbt')}
          />
          <ActionButton
            label="UTXO Manager"
            description="Review lock state, merge/split candidates, and spendable balance."
            icon={<ShieldCheckIcon className="h-5 w-5" aria-hidden />}
            onClick={() => openTool('manager')}
          />
          <ActionButton
            label="Validators"
            description="Run seller listing safety checks and inspect errors before buy attempts."
            icon={<CheckBadgeIcon className="h-5 w-5" aria-hidden />}
            onClick={() => openTool('validators')}
          />
          <ActionButton
            label="Buy inscription"
            description="Paste a listing QR / dogepsdt URI or PSDT, then sign and broadcast as the buyer."
            icon={<ShoppingCartIcon className="h-5 w-5" aria-hidden />}
            onClick={() => openTool('buy')}
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
            {supportRows.map((row) => (
              <div key={row.feature} className="grid grid-cols-[1.3fr_repeat(5,minmax(0,1fr))] gap-px bg-border-primary/20 dark:bg-white/5">
                <div className="bg-bg-primary p-3 text-sm text-text-primary dark:bg-black/20 dark:text-white">{row.feature}</div>
                <div className="bg-bg-primary p-3 dark:bg-black/20"><SupportPill value={row.browser} /></div>
                <div className="bg-bg-primary p-3 dark:bg-black/20"><SupportPill value={row.mydoge} /></div>
                <div className="bg-bg-primary p-3 dark:bg-black/20"><SupportPill value={row.spooky} /></div>
                <div className="bg-bg-primary p-3 dark:bg-black/20"><SupportPill value={row.dojak} /></div>
                <div className="bg-bg-primary p-3 dark:bg-black/20"><SupportPill value={row.ledger} /></div>
              </div>
            ))}
          </div>
          <div className="border-t border-border-primary bg-bg-secondary p-4 text-xs text-text-secondary dark:border-white/10 dark:bg-black/30 dark:text-white/60">
            <ExclamationTriangleIcon className="mr-2 inline h-4 w-4 align-[-2px] text-amber-300" aria-hidden />
            This matrix reflects the integration points wired into the app. The live tests below prove the currently connected wallet.
          </div>
        </div>
      </Section>

      <Section
        title="Live Wallet Tests"
        subtitle="Run actual signature flows against the connected wallet to verify the extension or browser wallet works as claimed."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border-primary bg-bg-secondary p-4 dark:border-white/10 dark:bg-black/25">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-text-primary dark:text-white">Message Signing Test</div>
                <div className="mt-1 text-xs text-text-secondary dark:text-white/60">Signs a deterministic demo message and returns the signature string.</div>
              </div>
              <ArrowPathIcon className={cx('h-5 w-5', liveMessageStatus === 'running' ? 'animate-spin text-[#FCD34D]' : 'text-text-tertiary dark:text-white/40')} aria-hidden />
            </div>
            <button
              type="button"
              onClick={() => void runLiveMessageTest()}
              disabled={!connected || liveMessageStatus === 'running'}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#FCD34D] px-4 py-2 text-sm font-bold text-black transition hover:bg-[#fde68a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Sign Message
            </button>
            {liveMessageResult && (
              <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200">Signature</div>
                <div className="mt-1 break-all font-mono text-xs text-emerald-50">{liveMessageResult}</div>
              </div>
            )}
            <div className="mt-3 text-xs text-text-secondary dark:text-white/55">
              Status: {liveMessageStatus}
            </div>
          </div>

          <div className="rounded-2xl border border-border-primary bg-bg-secondary p-4 dark:border-white/10 dark:bg-black/25">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-text-primary dark:text-white">PSDT Signing Test</div>
                <div className="mt-1 text-xs text-text-secondary dark:text-white/60">Builds a harmless live PSDT from wallet UTXOs and signs it without broadcasting.</div>
              </div>
              <ArrowPathIcon className={cx('h-5 w-5', livePsbtStatus === 'running' ? 'animate-spin text-[#FCD34D]' : 'text-text-tertiary dark:text-white/40')} aria-hidden />
            </div>
            <button
              type="button"
              onClick={() => void runLivePsbtTest()}
              disabled={!connected || livePsbtStatus === 'running'}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#FCD34D] px-4 py-2 text-sm font-bold text-black transition hover:bg-[#fde68a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Build + Sign PSDT
            </button>
            {livePsbtResult && (
              <div className="mt-3 rounded-xl border border-sky-500/20 bg-sky-500/10 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-200">Signed output</div>
                <div className="mt-1 text-xs text-sky-50">Mode: {livePsbtResult.signMode}</div>
                <div className="mt-1 break-all font-mono text-xs text-sky-50">{livePsbtResult.prefix}</div>
                <div className="mt-1 text-xs text-sky-100/80">Length: {livePsbtResult.length}</div>
              </div>
            )}
            <div className="mt-3 text-xs text-text-secondary dark:text-white/55">
              Status: {livePsbtStatus}
            </div>
          </div>
        </div>
        {liveError && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
            {liveError}
          </div>
        )}
      </Section>
    </div>
  );
}

export default DemoHub;
