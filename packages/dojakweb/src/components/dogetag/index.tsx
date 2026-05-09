import React, { useState } from 'react';
import { DogetagCreator } from '../DogetagCreator';
import { useUnifiedWallet } from '../../contexts/UnifiedWalletContext';
import { useBrowserWallet } from '../../contexts/BrowserWalletContext';
import { useDataProvider } from '../../providers/DataProvider';
import { toast } from 'sonner';
import { signOpReturnTransaction } from '../../lib/broadcast/dogecoinTxBroadcast';
import {
  QuestionMarkCircleIcon,
  ChatBubbleLeftRightIcon,
  CubeIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

type DogetagMainTab = 'create' | 'about' | 'faq' | 'track';

// ── Left-column brand panel ───────────────────────────────────────────────────

function DogetagBrand() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 lg:sticky lg:top-20">
      <img
        src="/dogetags.png"
        alt="DogeTags"
        width={420}
        height={420}
        decoding="async"
        className="h-auto w-full max-w-[280px] drop-shadow-lg lg:max-w-[340px]"
        onError={(e) => {
          const el = e.currentTarget;
          if (el.getAttribute('data-img-fallback') === '1') return;
          el.setAttribute('data-img-fallback', '1');
          el.src = '/dogetags.svg';
        }}
      />
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#D4A017]/80">
          Permanent on-chain message
        </p>
        <p className="mt-2 max-w-[260px] text-xs leading-relaxed text-zinc-500">
          Carve your words into Dogecoin — forever.
          <br />
          OP_RETURN for short graffiti, Doginals for longer text.
        </p>
      </div>
      <div className="w-full max-w-[260px] space-y-2 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 text-xs text-zinc-500">
        <div className="flex items-start gap-2">
          <ChatBubbleLeftRightIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
          <span><strong className="text-zinc-300">DogeTag:tx</strong> — 80 bytes, ~0.001 DOGE, stays with the tx</span>
        </div>
        <div className="flex items-start gap-2">
          <CubeIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span><strong className="text-zinc-300">DogeTag:inscription</strong> — up to 1390 bytes, moves with your coin (2 txs)</span>
        </div>
      </div>
    </div>
  );
}

// ── Tab rail ──────────────────────────────────────────────────────────────────

function DogetagTabRail({
  activeTab,
  onChange,
}: {
  activeTab: DogetagMainTab;
  onChange: (t: DogetagMainTab) => void;
}) {
  const tabs: { id: DogetagMainTab; label: string }[] = [
    { id: 'create', label: '✦ Create' },
    { id: 'about', label: 'About' },
    { id: 'faq', label: 'FAQ' },
    { id: 'track', label: 'Track' },
  ];
  return (
    <div className="mb-6 flex w-full gap-1 rounded-lg border border-[#D4A017]/20 bg-black/[0.04] p-1 dark:bg-white/[0.04]">
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`flex-1 rounded-md py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors sm:text-[11px] ${
            activeTab === id
              ? 'bg-[#D4A017] text-black'
              : 'text-zinc-500 hover:text-zinc-200 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Static panels ─────────────────────────────────────────────────────────────

function AboutPanel({ onGoCreate }: { onGoCreate: () => void }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="mb-3 text-base font-semibold text-white">The idea</h2>
        <p className="mb-3 text-sm leading-relaxed text-zinc-300">
          When Satoshi mined the Bitcoin genesis block, he embedded a headline in the coinbase:
        </p>
        <div className="mb-3 rounded-lg bg-black/50 p-3">
          <p className="font-mono text-xs text-amber-300">
            "The Times 03/Jan/2009 Chancellor on brink of second bailout for banks"
          </p>
        </div>
        <p className="text-sm leading-relaxed text-zinc-400">
          OP_RETURN formalised that spirit — provably unspendable outputs that carry a small payload every
          node stores forever. DogeTags bring the same thing to Dogecoin, plus Doginals-based inscriptions
          for longer content that moves with your coins.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="mb-3 text-base font-semibold text-white">How it works</h2>
        <div className="space-y-3 text-sm text-zinc-400">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 rounded bg-blue-900/50 px-1.5 py-0.5 font-mono text-[10px] text-blue-300">
              DogeTag:tx
            </span>
            <span>
              An OP_RETURN output in a standard Dogecoin transaction. Up to 80 UTF-8 bytes. Stays
              with that transaction hash, non-transferable, cheap.
            </span>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 rounded bg-emerald-900/50 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
              DogeTag:inscription
            </span>
            <span>
              Canonical Doginals P2SH commit-reveal. Two transactions, larger payload, moves with
              the UTXO lineage. Indexable as a collectible.
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onGoCreate}
        className="w-full rounded-xl bg-gradient-to-br from-amber-500 to-amber-300 py-3.5 text-sm font-extrabold text-black transition hover:brightness-105"
      >
        ✦ Create Your DogeTags →
      </button>
    </div>
  );
}

function FaqPanel() {
  const items = [
    {
      q: 'What fits in 80 bytes?',
      a: '80 UTF-8 bytes = 80 ASCII chars, fewer with emoji/accents. Fits: your name, a URL, a short claim, a love letter.',
    },
    {
      q: 'DogeTag:tx vs DogeTag:inscription?',
      a: 'DogeTag:tx (OP_RETURN) is cheap, transaction-scoped, non-transferable. DogeTag:inscription (Doginals) is richer, moves with your UTXO, requires two transactions.',
    },
    {
      q: 'Can I include a tip?',
      a: 'Yes — the same transaction carries your message plus a tip output. One fee, multiple outputs.',
    },
    {
      q: 'How much does it cost?',
      a: 'DogeTag:tx is roughly one tx fee (~0.001 DOGE). Inscriptions cost more due to witness data and the commit–reveal flow.',
    },
    {
      q: 'Why Dogecoin?',
      a: 'Low fees, fast blocks, and a culture that likes leaving marks on-chain.',
    },
  ];
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="flex items-center gap-3 mb-5">
        <QuestionMarkCircleIcon className="h-5 w-5 text-orange-400" />
        <h2 className="text-base font-semibold text-white">FAQ</h2>
      </div>
      <div className="space-y-5">
        {items.map(({ q, a }) => (
          <div key={q} className="border-b border-zinc-800/70 pb-5 last:border-0 last:pb-0">
            <h3 className="mb-1.5 text-sm font-semibold text-white">{q}</h3>
            <p className="text-sm leading-relaxed text-zinc-400">{a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrackPanel() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 py-16 px-6 text-center">
      <MagnifyingGlassIcon className="h-10 w-10 text-zinc-600" />
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#D4A017]/70 mb-1">Coming soon</p>
        <h2 className="text-base font-bold text-white">DogeTags Tracker</h2>
      </div>
      <p className="max-w-sm text-sm leading-relaxed text-zinc-500">
        Search and explore DogeTags by address or keyword, verify your tags, and see what others
        carved on-chain.
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export const DogetagPage: React.FC<{
  initialMode?: 'op_return' | 'witness';
  onNavigateToSection?: (section: string) => void;
}> = ({ initialMode = 'op_return', onNavigateToSection: _onNavigateToSection }) => {
  const { connected, address, walletType, signPSBTOnly } = useUnifiedWallet();
  const browser = useBrowserWallet();
  const { utxos, inscriptions, isLoadingUtxos, utxosError } = useDataProvider();
  const [activeTab, setActiveTab] = useState<DogetagMainTab>('create');

  const walletLabel =
    walletType === 'mydoge' ? 'MyDoge'
    : walletType === 'browser' ? 'Local wallet'
    : walletType === 'dojak' ? 'Dojak'
    : walletType === 'ledger' ? 'Ledger'
    : walletType === 'spooky' ? 'SpookyDoge'
    : null;

  const syncDogetagUrl = (mode: 'op_return' | 'witness') => {
    if (typeof window === 'undefined') return;
    const next = mode === 'op_return' ? '/dogetags?mode=op_return' : '/dogetags';
    const cur = `${window.location.pathname}${window.location.search}`;
    if (cur !== next) window.history.replaceState({}, '', next);
  };

  const handleDogetagCreated = (_txid: string, _message: string) => {};

  // ── Wallet interface ───────────────────────────────────────────────────────

  const walletInterface = connected && address ? {
    walletType,
    getAddress: async () => address,
    getUtxos: async () =>
      (utxos || []).map((utxo: any) => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: normalizeUtxoValue(utxo),
        scriptPubKey: utxo.scriptPubKey || utxo.script || '',
        address: utxo.address || address || undefined,
        confirmations: utxo.confirmations ?? 1,
      })),
    signPsbt: async (psbtHex: string) => signPSBTOnly(psbtHex),
    getPrivateKeyWIF: async () => {
      if (walletType !== 'browser' || !browser.wallet?.privateKey)
        throw new Error('Unlock your Dojakweb wallet before signing a Dogetag.');
      return browser.wallet.privateKey;
    },
    signOpReturn: async (params: {
      message: string;
      fromAddress: string;
      feeRate: number;
      tip?: { address: string; satoshis: number };
      excludedOutpoints?: string[];
    }) => {
      if (walletType !== 'browser' || !browser.wallet?.privateKey)
        throw new Error('Unlock your Dojakweb wallet before signing DogeTag:tx (OP_RETURN).');
      return signOpReturnTransaction({
        message: params.message,
        fromAddress: params.fromAddress,
        privateKeyWIF: browser.wallet.privateKey,
        feeRate: params.feeRate,
        tip: params.tip,
        excludedOutpoints: params.excludedOutpoints ?? extractProtectedOutpoints(inscriptions),
      });
    },
    protectedOutpoints: extractProtectedOutpoints(inscriptions),
  } : null;

  // ── Create tab content ─────────────────────────────────────────────────────

  const createTab = !connected || !address || !walletInterface ? (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#D4A017]/10">
          <span className="text-2xl" aria-hidden>🏷️</span>
        </div>
        <h2 className="mb-2 text-base font-bold text-white">Connect your wallet to create</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Works with your local Dojakweb wallet, MyDoge, SpookyDoge, Dojak, or any extension that supports PSBT signing.
        </p>
        <button
          type="button"
          onClick={() => toast.info('Use the wallet connection button in the top bar')}
          className="rounded-lg bg-[#D4A017] px-5 py-2.5 text-sm font-bold text-black transition hover:brightness-105"
        >
          Connect wallet
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <ChatBubbleLeftRightIcon className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">DogeTag:tx</span>
          </div>
          <p className="text-xs text-zinc-500">80-byte OP_RETURN — cheap, instant, permanent graffiti on a transaction.</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <CubeIcon className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold text-white">DogeTag:inscription</span>
          </div>
          <p className="text-xs text-zinc-500">Doginals commit-reveal — longer text that moves with your coin.</p>
        </div>
      </div>
    </div>
  ) : (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-zinc-800/60 bg-zinc-900/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
          <span className="font-mono text-xs text-zinc-300">
            {address.slice(0, 10)}…{address.slice(-8)}
          </span>
        </div>
        {walletLabel && <span className="text-xs text-zinc-500">{walletLabel}</span>}
      </div>
      {isLoadingUtxos && (
        <div className="rounded-lg border border-border-primary bg-bg-secondary/60 px-3 py-2 text-xs text-text-secondary">
          Loading wallet UTXOs…
        </div>
      )}
      {utxosError && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
          {utxosError}
        </div>
      )}
      <DogetagCreator
        wallet={walletInterface}
        onDogetagCreated={handleDogetagCreated}
        initialInscriptionMode={initialMode}
        onInscriptionModeChange={syncDogetagUrl}
      />
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="mx-auto max-w-[min(1200px,100%)] px-5 pb-28 pt-8 lg:pt-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[320px_1fr] lg:gap-14">

          {/* Left — brand */}
          <DogetagBrand />

          {/* Right — tabbed UI */}
          <div className="min-w-0">
            <DogetagTabRail activeTab={activeTab} onChange={setActiveTab} />

            {activeTab === 'create' && createTab}
            {activeTab === 'about' && <AboutPanel onGoCreate={() => setActiveTab('create')} />}
            {activeTab === 'faq' && <FaqPanel />}
            {activeTab === 'track' && <TrackPanel />}
          </div>

        </div>
      </div>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeUtxoValue(utxo: any): number {
  const source = utxo?.value ?? utxo?.amount ?? utxo?.balance ?? 0;
  const raw = Number(source);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (utxo?.amount !== undefined || utxo?.balance !== undefined) return Math.round(raw * 1e8);
  return Number.isInteger(raw) ? raw : Math.round(raw * 1e8);
}

function extractProtectedOutpoints(inscriptions: any[] | null | undefined): string[] {
  if (!Array.isArray(inscriptions) || inscriptions.length === 0) return [];
  const protectedSet = new Set<string>();
  const addOutpoint = (candidate: string | undefined) => {
    if (!candidate) return;
    const parts = candidate.split(':');
    if (parts.length < 2) return;
    const txid = parts[0]?.trim().toLowerCase();
    const vout = Number(parts[1]);
    if (!txid || txid.length !== 64 || !Number.isInteger(vout) || vout < 0) return;
    protectedSet.add(`${txid}:${vout}`);
  };
  for (const ins of inscriptions) {
    addOutpoint(ins?.output);
    addOutpoint(ins?.location);
  }
  return Array.from(protectedSet);
}
