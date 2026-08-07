'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useBrowserWallet } from '../../contexts/BrowserWalletContext';
import { useUnifiedWallet } from '../../contexts/useUnifiedWallet';
import {
  buildAlkanesCallScriptHex,
  broadcastAlkanesCall,
  deployAlkaneWasm,
  encodeCellpack,
  fetchAlkanesList,
  fetchAmmTemplate,
  type AlkaneMeta,
  type AmmTemplate,
} from '../../lib/alkanes';
import { upsertWalletTxJournalEntry } from '../../lib/wallet-tx-journal';

export type AlkanesUiOp = 'deploy-amm' | 'simulate' | 'build-call' | 'broadcast-call';

export interface AlkanesToolsPanelProps {
  initialOp?: AlkanesUiOp;
  dogexApiBase?: string;
  className?: string;
}

function resolveApiBase(override?: string): string {
  if (override?.trim()) return override.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const w = (window as unknown as { __DOGEX_API_BASE__?: string }).__DOGEX_API_BASE__;
    if (w) return w.replace(/\/$/, '');
  }
  return 'https://dogex.command.dog';
}

export function AlkanesToolsPanel({
  initialOp = 'deploy-amm',
  dogexApiBase,
  className = '',
}: AlkanesToolsPanelProps) {
  const { address, walletType } = useUnifiedWallet();
  const browser = useBrowserWallet();
  const base = resolveApiBase(dogexApiBase);
  const [op, setOp] = useState<AlkanesUiOp>(initialOp);
  const [items, setItems] = useState<AlkaneMeta[]>([]);
  const [tmpl, setTmpl] = useState<AmmTemplate | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState('0:0');
  const [amountIn, setAmountIn] = useState('10000');
  const [simOut, setSimOut] = useState<string | null>(null);
  const [scriptHex, setScriptHex] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [list, amm] = await Promise.all([fetchAlkanesList(base), fetchAmmTemplate(base)]);
      setItems(list);
      setTmpl(amm);
      if (list[0]) setTarget(list[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed');
    }
  }, [base]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onDeployAmm = async () => {
    setError(null);
    setStatus(null);
    if (!tmpl) {
      setError('AMM template not loaded');
      return;
    }
    if (walletType !== 'browser' || !address || !browser.wallet?.privateKey) {
      setError('Unlock Local Browser Wallet to deploy');
      return;
    }
    setBusy(true);
    try {
      const r = await deployAlkaneWasm({
        deployBodyHex: tmpl.deploy_body_hex,
        contentType: tmpl.content_type,
        fromAddress: address,
        privateKeyWIF: browser.wallet.privateKey,
        label: 'Ðalkanes AMM deploy',
      });
      setStatus(`Deployed AMM · ${r.inscriptionId}`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'deploy failed');
    } finally {
      setBusy(false);
    }
  };

  const onSimulateSwap = async () => {
    setSimOut(null);
    setError(null);
    const [b, t] = target.split(':').map((x) => x.trim());
    try {
      const r = await fetch(`${base}/api/alkanes/simulate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          target_block: Number(b),
          target_tx: Number(t),
          inputs: ['2', amountIn],
          fuel: 500_000,
        }),
      });
      const j = await r.json();
      setSimOut(JSON.stringify(j, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'simulate failed');
    }
  };

  const onBuildCall = () => {
    setError(null);
    const [b, t] = target.split(':').map((x) => x.trim());
    try {
      const cell = encodeCellpack({
        targetBlock: Number(b),
        targetTx: Number(t),
        fuel: 200_000,
        inputs: [2, amountIn],
      });
      const hex = buildAlkanesCallScriptHex(cell);
      setScriptHex(hex);
      upsertWalletTxJournalEntry({
        protocol: 'alkanes',
        action: 'build-call',
        title: 'Ðalkanes swap call script',
        summary: `target ${target} · amount ${amountIn}`,
        status: 'draft',
        metadata: { scriptHex: hex },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'build failed');
    }
  };

  const onBroadcastCall = async () => {
    setError(null);
    setStatus(null);
    if (walletType !== 'browser' || !address || !browser.wallet?.privateKey) {
      setError('Unlock Local Browser Wallet to broadcast');
      return;
    }
    const [b, t] = target.split(':').map((x) => x.trim());
    setBusy(true);
    try {
      const r = await broadcastAlkanesCall({
        targetBlock: Number(b),
        targetTx: Number(t),
        inputs: [2, amountIn],
        fuel: 200_000,
        fromAddress: address,
        privateKeyWIF: browser.wallet.privateKey,
      });
      setScriptHex(r.scriptHex);
      setStatus(`Broadcast Ðalkanes call · ${r.txid}`);
      upsertWalletTxJournalEntry({
        protocol: 'alkanes',
        action: 'broadcast-call',
        title: 'Ðalkanes call',
        summary: `target ${target} · amount ${amountIn}`,
        status: 'broadcasted',
        txid: r.txid,
        metadata: { scriptHex: r.scriptHex, explorer: `https://explorer.dogenals.com/tx/${r.txid}` },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'broadcast failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-xl border border-white/10 bg-black/40 p-4 text-white ${className}`}>
      <div className="mb-3">
        <p className="text-xs uppercase tracking-wide text-cyan-300/80">Ðalkanes</p>
        <h3 className="text-lg font-semibold">WASM contracts · AMM demo</h3>
        <p className="mt-1 text-sm text-white/60">
          Deploy the reference xy=k pool (30 bps), simulate swaps, build OP_RETURN 0xD1 scripts.{' '}
          <a
            className="text-cyan-300 underline"
            href="https://dogenals.com/alkanescan"
            target="_blank"
            rel="noreferrer"
          >
            Ðalkanescan
          </a>
          {' · '}
          <a
            className="text-cyan-300 underline"
            href="https://dogenals.com/alkanes"
            target="_blank"
            rel="noreferrer"
          >
            Deploy UI
          </a>
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {(
          [
            ['deploy-amm', 'Deploy AMM'],
            ['simulate', 'Simulate'],
            ['build-call', 'Build call'],
            ['broadcast-call', 'Broadcast call'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setOp(id)}
            className={`rounded-lg px-3 py-1.5 ${
              op === id ? 'bg-cyan-500/30 text-cyan-100' : 'bg-white/5 text-white/70'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-lg bg-white/5 px-3 py-1.5 text-white/70"
        >
          Refresh
        </button>
      </div>

      {error && <p className="mb-2 text-sm text-red-300">{error}</p>}
      {status && <p className="mb-2 text-sm text-emerald-300">{status}</p>}

      {op === 'deploy-amm' && (
        <div className="space-y-3">
          <p className="text-sm text-white/70">
            {tmpl
              ? `Template ${tmpl.name} · ${tmpl.code_hash.slice(0, 16)}… · fee ${tmpl.fee_bps} bps`
              : 'Loading template…'}
          </p>
          <button
            type="button"
            disabled={busy || !tmpl}
            onClick={() => void onDeployAmm()}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {busy ? 'Inscribing…' : 'One-click deploy AMM'}
          </button>
          <ul className="mt-3 max-h-40 space-y-1 overflow-auto font-mono text-xs text-white/60">
            {items.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2">
                <button type="button" className="hover:text-cyan-200" onClick={() => setTarget(m.id)}>
                  {m.id} · {m.code_len}B
                </button>
                <a
                  className="text-cyan-400/80 underline"
                  href={`https://dogenals.com/alkanescan/${m.id.replace(':', '/')}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  scan
                </a>
              </li>
            ))}
            {items.length === 0 && <li>No indexed contracts yet</li>}
          </ul>
        </div>
      )}

      {(op === 'simulate' || op === 'build-call' || op === 'broadcast-call') && (
        <div className="space-y-3">
          <label className="block text-sm">
            Target block:tx
            <input
              className="mt-1 w-full rounded border border-white/10 bg-black/50 px-3 py-2 font-mono text-sm"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Amount in (swap0→1)
            <input
              className="mt-1 w-full rounded border border-white/10 bg-black/50 px-3 py-2 font-mono text-sm"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
            />
          </label>
          {op === 'simulate' ? (
            <button
              type="button"
              onClick={() => void onSimulateSwap()}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium"
            >
              Dry-run swap on dogex
            </button>
          ) : op === 'broadcast-call' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onBroadcastCall()}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy ? 'Broadcasting…' : 'Sign & broadcast OP_RETURN 0xD1'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onBuildCall}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium"
            >
              Build OP_RETURN script
            </button>
          )}
          {simOut && (
            <pre className="max-h-60 overflow-auto rounded bg-black/60 p-2 text-xs">{simOut}</pre>
          )}
          {scriptHex && (
            <pre className="max-h-40 overflow-auto break-all rounded bg-black/60 p-2 text-xs">{scriptHex}</pre>
          )}
        </div>
      )}
    </div>
  );
}
