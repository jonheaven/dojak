'use client';

import React, { useMemo, useState } from 'react';
import { useUnifiedWallet } from '../../contexts/useUnifiedWallet';
import { useBrowserWallet } from '../../contexts/BrowserWalletContext';
import { decodePrivateKeyFromWIF } from 'doge-sdk';
import * as secp from '@noble/secp256k1';
import {
  decodeConsignmentAny,
  encodeConsignmentJson,
  listYardSeals,
  protectOpenNotes,
  signAndBroadcastYardBurn,
  signAndBroadcastYardTip,
  summarizeConsignment,
  type VerifySummary,
  type YardConsignment,
} from '../../lib/yard';
import { upsertWalletTxJournalEntry } from '../../lib/wallet-tx-journal';

function pubkeyHexFromWif(wif: string): string {
  const sk = decodePrivateKeyFromWIF(wif);
  return Buffer.from(secp.getPublicKey(sk, true)).toString('hex');
}

export type YardLabPanelProps = {
  className?: string;
  /** Called after a successful burn with consignment + txid (Burn a Wow hook). */
  onBurned?: (info: { txid: string; contractLabel: string; consignmentJson: string }) => void;
  /** Prefill consignment JSON (e.g. from host page). */
  initialConsignmentJson?: string;
};

export function YardLabPanel({ className = '', onBurned, initialConsignmentJson = '' }: YardLabPanelProps) {
  const wallet = useUnifiedWallet();
  const browser = useBrowserWallet();
  const address = wallet.address ?? '';

  const [raw, setRaw] = useState(initialConsignmentJson);
  const [summary, setSummary] = useState<VerifySummary | null>(null);
  const [cons, setCons] = useState<YardConsignment | null>(null);
  const [sealKey, setSealKey] = useState('');
  const [toPubkey, setToPubkey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [lastConsOut, setLastConsOut] = useState<string | null>(null);

  const seals = useMemo(() => (address ? listYardSeals(address) : []), [address, summary, ok]);

  async function onVerify() {
    setError(null);
    setOk(null);
    try {
      const c = decodeConsignmentAny(raw);
      const s = summarizeConsignment(c);
      setCons(c);
      setSummary(s);
      if (s.openNotes[0]) setSealKey(s.openNotes[0].sealKey);
      setOk(`OK — ${s.opCount} ops, ${s.openNotes.length} open note(s). Not a Doginal.`);
    } catch (e) {
      setCons(null);
      setSummary(null);
      setError(e instanceof Error ? e.message : 'verify failed');
    }
  }

  async function onProtect() {
    if (!address || !cons || !summary) return;
    setBusy(true);
    setError(null);
    try {
      const wif = (await browser.getSigningWallet()).privateKey;
      const pk = pubkeyHexFromWif(wif);
      const r = protectOpenNotes({
        address,
        ourPubkeyHex: pk,
        notes: summary.openNotes,
        consignment: cons,
      });
      setOk(`Protected ${r.protectedCount} seal(s). Ordinary sends will skip them.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'protect failed');
    } finally {
      setBusy(false);
    }
  }

  async function onTip() {
    if (!address || !cons || !sealKey) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const wif = (await browser.getSigningWallet()).privateKey;
      const result = await signAndBroadcastYardTip({
        consignment: cons,
        sealKey,
        toPubkeyHex: toPubkey,
        fromAddress: address,
        privateKeyWIF: wif,
      });
      setLastConsOut(result.consignmentJson);
      setRaw(result.consignmentJson);
      setCons(decodeConsignmentAny(result.consignmentJson));
      setSummary(summarizeConsignment(decodeConsignmentAny(result.consignmentJson)));
      setOk(`Tipped ${result.contractLabel} — ${result.txid}`);
      upsertWalletTxJournalEntry({
        txid: result.txid,
        address,
        protocol: 'yard',
        action: 'yard-tip',
        title: `YARD tip: ${result.contractLabel}`,
        status: 'broadcasted',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'tip failed');
    } finally {
      setBusy(false);
    }
  }

  async function onBurn() {
    if (!address || !cons || !sealKey) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const wif = (await browser.getSigningWallet()).privateKey;
      const result = await signAndBroadcastYardBurn({
        consignment: cons,
        sealKey,
        fromAddress: address,
        privateKeyWIF: wif,
      });
      setLastConsOut(result.consignmentJson);
      setOk(`Burned ${result.contractLabel} — ${result.txid}`);
      upsertWalletTxJournalEntry({
        txid: result.txid,
        address,
        protocol: 'yard',
        action: 'yard-burn',
        title: `YARD burn: ${result.contractLabel}`,
        status: 'broadcasted',
      });
      onBurned?.({
        txid: result.txid,
        contractLabel: result.contractLabel,
        consignmentJson: result.consignmentJson,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'burn failed');
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    const buf = Buffer.from(await file.arrayBuffer());
    try {
      const c = decodeConsignmentAny(buf);
      setRaw(encodeConsignmentJson(c));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'could not read .yard file');
    }
  }

  return (
    <div className={`space-y-5 ${className}`}>
      <div>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
          YARD lab
        </div>
        <h2 className="text-2xl font-bold text-white">Sticky notes on DOGE</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Import a <code className="text-zinc-200">.yard</code> consignment, lock the seal UTXO, tip or burn.
          Not a Doginal — only a fingerprint lives on-chain.
        </p>
      </div>

      {!address ? (
        <p className="text-sm text-amber-200/90">Connect the local Dojak browser wallet to protect, tip, or burn.</p>
      ) : (
        <p className="font-mono text-xs text-zinc-500">{address}</p>
      )}

      <label className="block space-y-1 text-xs text-zinc-500">
        Consignment (.yard JSON or paste)
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={6}
          spellCheck={false}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-amber-400/50"
          placeholder='{"v":1,"ops":[...],"txs":[...]}'
        />
      </label>
      <label className="block text-xs text-zinc-500">
        Or choose file
        <input
          type="file"
          accept=".yard,.json,application/json"
          className="mt-1 block w-full text-sm text-zinc-300"
          onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onVerify()}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-white hover:bg-zinc-900"
        >
          Verify
        </button>
        <button
          type="button"
          disabled={!address || !cons || busy}
          onClick={() => void onProtect()}
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-200 disabled:opacity-40"
        >
          Protect seals
        </button>
      </div>

      {summary ? (
        <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm">
          <p className="text-zinc-300">
            Tick family <span className="font-mono text-amber-300">{summary.tick}</span> · {summary.openNotes.length}{' '}
            open
          </p>
          <ul className="space-y-1 font-mono text-xs text-zinc-400">
            {summary.openNotes.map((n) => (
              <li key={n.sealKey}>
                {n.contractLabel} · {n.amount.toString()} · {n.sealKey}
              </li>
            ))}
          </ul>
          <ul className="mt-2 space-y-0.5 font-mono text-[10px] text-zinc-600">
            {summary.ops.map((o, i) => (
              <li key={i}>
                {o.type} · {o.contract} · {o.hash}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-xs text-zinc-500">
          Seal (txid:vout)
          <input
            value={sealKey}
            onChange={(e) => setSealKey(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-white"
          />
        </label>
        <label className="block space-y-1 text-xs text-zinc-500">
          Tip to pubkey (33-byte hex)
          <input
            value={toPubkey}
            onChange={(e) => setToPubkey(e.target.value)}
            placeholder="02… or 03…"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-white"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!address || !cons || !sealKey || !toPubkey || busy}
          onClick={() => void onTip()}
          className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-40"
        >
          Tip stamp
        </button>
        <button
          type="button"
          disabled={!address || !cons || !sealKey || busy}
          onClick={() => void onBurn()}
          className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 disabled:opacity-40"
        >
          Burn stamp
        </button>
      </div>

      {seals.length > 0 ? (
        <div className="rounded-xl border border-zinc-800 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Protected seals</p>
          <ul className="mt-2 space-y-1 font-mono text-[11px] text-zinc-400">
            {seals.map((s) => (
              <li key={s.sealKey}>
                {s.contractLabel} · {s.sealKey}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {lastConsOut ? (
        <details className="rounded-xl border border-zinc-800 p-3">
          <summary className="cursor-pointer text-xs text-zinc-400">Updated consignment JSON</summary>
          <pre className="mt-2 max-h-48 overflow-auto font-mono text-[10px] text-zinc-500">{lastConsOut}</pre>
        </details>
      ) : null}

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-300">{ok}</p> : null}
    </div>
  );
}
