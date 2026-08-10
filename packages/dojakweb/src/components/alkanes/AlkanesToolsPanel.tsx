'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useUnifiedWallet } from '../../contexts/useUnifiedWallet';
import {
  buildAlkanesCallScriptHex,
  broadcastAlkanesCall,
  deployAlkaneWasm,
  encodeCellpack,
  fetchAlkanesList,
  fetchAlkaneTemplate,
  type AlkaneMeta,
  type AlkaneTemplate,
} from '../../lib/alkanes';
import { upsertWalletTxJournalEntry } from '../../lib/wallet-tx-journal';
import { requestWalletApproval } from '../../stores/walletApprovalStore';

export type AlkanesUiOp = 'deploy-amm' | 'simulate' | 'build-call' | 'broadcast-call';
export type AlkanesTemplateId =
  | 'amm'
  | 'oracle'
  | 'price-oracle'
  | 'token'
  | 'freemint'
  | 'clock-in'
  | 'domains'
  | 'dice'
  | 'tax-amm'
  | 'ico'
  | 'prediction'
  | 'custody-amm'
  | 'event-oracle'
  | 'poly-market'
  | 'multi-market';

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
  const { address, connected } = useUnifiedWallet();
  const base = resolveApiBase(dogexApiBase);
  const [op, setOp] = useState<AlkanesUiOp>(initialOp);
  const [templateId, setTemplateId] = useState<AlkanesTemplateId>('amm');
  const [items, setItems] = useState<AlkaneMeta[]>([]);
  const [tmpl, setTmpl] = useState<AlkaneTemplate | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState('0:0');
  const [amountIn, setAmountIn] = useState('10000');
  const [attachDoge, setAttachDoge] = useState('0');
  const [callMode, setCallMode] = useState<'swap' | 'buy-yes' | 'buy-no' | 'resolve'>('swap');
  const [simOut, setSimOut] = useState<string | null>(null);
  const [scriptHex, setScriptHex] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [list, t] = await Promise.all([
        fetchAlkanesList(base),
        fetchAlkaneTemplate(base, templateId),
      ]);
      setItems(list);
      setTmpl(t);
      if (list[0]) setTarget(list[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed');
    }
  }, [base, templateId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onDeployAmm = async () => {
    setError(null);
    setStatus(null);
    if (!tmpl) {
      setError('Template not loaded');
      return;
    }
    if (!connected || !address) {
      setError('Connect / unlock Local Browser Wallet to deploy');
      return;
    }
    setBusy(true);
    try {
      const r = (await requestWalletApproval({
        title: `Deploy Ðalkane · ${tmpl.name}`,
        description:
          'Inscribe the WASM contract with a Doginals commit/reveal (same path as Ðune etch). Approve to sign and broadcast.',
        details: [
          { label: 'Template', value: tmpl.name },
          { label: 'Content-Type', value: tmpl.content_type || 'application/wasm' },
          { label: 'Code hash', value: `${tmpl.code_hash.slice(0, 18)}…` },
          { label: 'Receive', value: address },
        ],
        approveLabel: 'Approve deploy',
        onApprove: async (session) =>
          deployAlkaneWasm({
            deployBodyHex: tmpl.deploy_body_hex,
            contentType: tmpl.content_type,
            fromAddress: session.address,
            privateKeyWIF: session.privateKeyWif,
            label: `Ðalkanes ${tmpl.name} deploy`,
          }),
      })) as { inscriptionId: string };
      setStatus(`Deployed ${tmpl.name} · ${r.inscriptionId}`);
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'deploy failed';
      if (!/cancel/i.test(msg)) setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const buildCallInputs = (): Array<number | string> => {
    if (callMode === 'buy-yes') return [1, 1, amountIn];
    if (callMode === 'buy-no') return [2, 1, amountIn];
    if (callMode === 'resolve') return [3];
    return [2, amountIn];
  };

  const attachSatoshis = (() => {
    const n = Number(attachDoge);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n * 1e8);
  })();

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
          inputs: buildCallInputs().map(String),
          fuel: 500_000,
          value: attachSatoshis || undefined,
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
      const inputs = buildCallInputs();
      const cell = encodeCellpack({
        targetBlock: Number(b),
        targetTx: Number(t),
        fuel: 200_000,
        inputs,
      });
      const hex = buildAlkanesCallScriptHex(cell);
      setScriptHex(hex);
      upsertWalletTxJournalEntry({
        protocol: 'alkanes',
        action: 'build-call',
        title: 'Ðalkanes call script',
        summary: `target ${target} · ${callMode} · amount ${amountIn}`,
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
    if (!connected || !address) {
      setError('Connect / unlock Local Browser Wallet to broadcast');
      return;
    }
    const [b, t] = target.split(':').map((x) => x.trim());
    setBusy(true);
    try {
      const r = (await requestWalletApproval({
        title: 'Broadcast Ðalkanes call',
        description: 'Sign and broadcast OP_RETURN 0xD1 cellpack to the target contract.',
        details: [
          { label: 'Target', value: target },
          { label: 'Mode', value: callMode },
          { label: 'Amount', value: amountIn },
          ...(attachSatoshis
            ? [{ label: 'Attach', value: `${attachSatoshis / 1e8} DOGE` }]
            : []),
        ],
        approveLabel: 'Approve call',
        onApprove: async (session) =>
          broadcastAlkanesCall({
            targetBlock: Number(b),
            targetTx: Number(t),
            inputs: buildCallInputs(),
            fuel: 200_000,
            fromAddress: session.address,
            privateKeyWIF: session.privateKeyWif,
            attachSatoshis: attachSatoshis || undefined,
          }),
      })) as { txid: string; scriptHex: string };
      setScriptHex(r.scriptHex);
      setStatus(`Broadcast Ðalkanes call · ${r.txid}`);
      upsertWalletTxJournalEntry({
        protocol: 'alkanes',
        action: 'broadcast-call',
        title: 'Ðalkanes call',
        summary: `target ${target} · ${callMode} · amount ${amountIn}`,
        status: 'broadcasted',
        txid: r.txid,
        metadata: { scriptHex: r.scriptHex, explorer: `https://explorer.dogenals.com/tx/${r.txid}` },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'broadcast failed';
      if (!/cancel/i.test(msg)) setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const fieldClass =
    'mt-1 w-full rounded border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary';
  const idleChipClass =
    'rounded-lg border border-border-primary bg-bg-primary px-3 py-1.5 text-text-secondary transition hover:border-primary-500 hover:text-text-primary';
  const activeChipClass =
    'rounded-lg border border-primary-500/50 bg-primary-500/15 px-3 py-1.5 font-semibold text-primary-500';
  const primaryBtnClass =
    'rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-bg-primary transition hover:bg-primary-400 disabled:opacity-50';

  return (
    <div
      className={`rounded-xl border border-border-primary bg-bg-secondary p-4 text-text-primary ${className}`}
    >
      <div className="mb-3">
        <p className="text-xs font-medium uppercase tracking-wide text-primary-500">Ðalkanes</p>
        <h3 className="text-lg font-semibold text-text-primary">WASM contracts · templates</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Deploy AMM, block/time oracle, or signed price oracle; simulate and broadcast OP_RETURN 0xD1.{' '}
          <a
            className="text-primary-500 underline hover:text-primary-400"
            href="https://dogenals.com/alkanescan"
            target="_blank"
            rel="noreferrer"
          >
            Ðalkanescan
          </a>
          {' · '}
          <a
            className="text-primary-500 underline hover:text-primary-400"
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
            className={op === id ? activeChipClass : idleChipClass}
          >
            {label}
          </button>
        ))}
        <button type="button" onClick={() => void refresh()} className={idleChipClass}>
          Refresh
        </button>
      </div>

      {error && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {status && <p className="mb-2 text-sm text-emerald-700 dark:text-emerald-400">{status}</p>}

      {op === 'deploy-amm' && (
        <div className="space-y-3">
          <label className="block text-sm text-text-primary">
            Template
            <select
              className={fieldClass}
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value as AlkanesTemplateId)}
            >
              <option value="amm">AMM (xy=k)</option>
              <option value="tax-amm">Tax AMM</option>
              <option value="token">Token (ledger)</option>
              <option value="freemint">Freemint</option>
              <option value="clock-in">Clock-in</option>
              <option value="domains">Domains</option>
              <option value="dice">Dice</option>
              <option value="ico">ICO raise</option>
              <option value="oracle">Block/time oracle</option>
              <option value="price-oracle">Signed price oracle</option>
              <option value="prediction">Prediction market</option>
              <option value="custody-amm">DOGE custody AMM</option>
              <option value="event-oracle">Event oracle (Polymarket mirror)</option>
              <option value="poly-market">Polymarket-mirrored market</option>
              <option value="multi-market">Multi-choice Polymarket market</option>
            </select>
          </label>
          <p className="text-sm text-text-secondary">
            {tmpl
              ? `${tmpl.name} · ${tmpl.code_hash.slice(0, 16)}…${
                  tmpl.fee_bps != null ? ` · fee ${tmpl.fee_bps} bps` : ''
                }`
              : 'Loading template…'}
          </p>
          {tmpl?.description && <p className="text-xs text-text-secondary">{tmpl.description}</p>}
          <button
            type="button"
            disabled={busy || !tmpl}
            onClick={() => void onDeployAmm()}
            className={primaryBtnClass}
          >
            {busy ? 'Inscribing…' : `One-click deploy ${tmpl?.name ?? 'template'}`}
          </button>
          <ul className="mt-3 max-h-40 space-y-1 overflow-auto font-mono text-xs text-text-secondary">
            {items.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="text-text-primary hover:text-primary-500"
                  onClick={() => setTarget(m.id)}
                >
                  {m.id} · {m.code_len}B
                </button>
                <a
                  className="text-primary-500 underline hover:text-primary-400"
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
          <label className="block text-sm text-text-primary">
            Target block:tx
            <input
              className={`${fieldClass} font-mono`}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </label>
          <label className="block text-sm text-text-primary">
            Call mode
            <select
              className={fieldClass}
              value={callMode}
              onChange={(e) => setCallMode(e.target.value as typeof callMode)}
            >
              <option value="swap">AMM swap0→1</option>
              <option value="buy-yes">Prediction buy YES</option>
              <option value="buy-no">Prediction buy NO</option>
              <option value="resolve">Prediction resolve</option>
            </select>
          </label>
          <label className="block text-sm text-text-primary">
            Amount {callMode === 'swap' ? '(swap / custody ain)' : '(stake koinu; 0 = attach)'}
            <input
              className={`${fieldClass} font-mono`}
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
            />
          </label>
          <label className="block text-sm text-text-primary">
            Attach DOGE (alkane_value via tip out)
            <input
              className={`${fieldClass} font-mono`}
              value={attachDoge}
              onChange={(e) => setAttachDoge(e.target.value)}
              placeholder="0.01"
            />
          </label>
          {op === 'simulate' ? (
            <button type="button" onClick={() => void onSimulateSwap()} className={primaryBtnClass}>
              Dry-run on dogex
            </button>
          ) : op === 'broadcast-call' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onBroadcastCall()}
              className={primaryBtnClass}
            >
              {busy ? 'Broadcasting…' : 'Sign & broadcast OP_RETURN 0xD1'}
            </button>
          ) : (
            <button type="button" onClick={onBuildCall} className={primaryBtnClass}>
              Build OP_RETURN script
            </button>
          )}
          {simOut && (
            <pre className="max-h-60 overflow-auto rounded border border-border-primary bg-bg-primary p-2 text-xs text-text-primary">
              {simOut}
            </pre>
          )}
          {scriptHex && (
            <pre className="max-h-40 overflow-auto break-all rounded border border-border-primary bg-bg-primary p-2 text-xs text-text-primary">
              {scriptHex}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
