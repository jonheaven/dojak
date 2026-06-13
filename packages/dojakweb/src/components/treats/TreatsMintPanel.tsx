'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useUnifiedWallet } from '../../contexts/useUnifiedWallet';
import { useBrowserWallet } from '../../contexts/BrowserWalletContext';
import {
  buildTreatsDeployJson,
  buildTreatsMintJson,
  buildTreatsTransferJson,
  signAndBroadcastTreats,
  type TreatsOpKind,
} from '../../lib/treats';

export type TreatsUiOp = 'deploy' | 'mint' | 'transfer';

export interface TreatsMintPanelProps {
  initialOp?: TreatsUiOp;
  initialTick?: string;
  /** Hide ticker field and lock to initialTick */
  lockTick?: boolean;
  /** Which ops to show (default: deploy + mint) */
  ops?: TreatsUiOp[];
  /** Hide hero block when embedded on a detail page */
  compact?: boolean;
  className?: string;
}

const DEFAULT_OPS: TreatsUiOp[] = ['deploy', 'mint'];

export function TreatsMintPanel({
  initialOp = 'mint',
  initialTick = '',
  lockTick = false,
  ops = DEFAULT_OPS,
  compact = false,
  className = '',
}: TreatsMintPanelProps) {
  const wallet = useUnifiedWallet();
  const browser = useBrowserWallet();
  const address = wallet.address ?? '';

  const firstOp = ops.includes(initialOp) ? initialOp : ops[0] ?? 'mint';
  const [op, setOp] = useState<TreatsUiOp>(firstOp);
  const [tick, setTick] = useState(initialTick);
  const [max, setMax] = useState('21000000');
  const [lim, setLim] = useState('1000');
  const [amt, setAmt] = useState('1000');
  const [transferTo, setTransferTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);

  const json = useMemo(() => {
    if (op === 'deploy') return buildTreatsDeployJson(tick, max, lim);
    if (op === 'mint') return buildTreatsMintJson(tick, amt);
    return buildTreatsTransferJson(tick, amt);
  }, [op, tick, max, lim, amt]);

  const isValid =
    Boolean(json) &&
    tick.trim().length > 0 &&
    (op !== 'transfer' || transferTo.trim().length > 4);

  const dustRecipient =
    op === 'transfer' ? transferTo.trim() : address;

  const reset = useCallback(() => {
    setError(null);
    setTxid(null);
  }, []);

  async function handleBroadcast() {
    if (!isValid || !address) {
      setError(address ? 'Fix form fields before broadcasting.' : 'Connect your Dojakweb wallet first.');
      return;
    }
    if (wallet.walletType !== 'browser' || !browser.wallet?.privateKey) {
      setError('Unlock your local Dojakweb browser wallet to sign ÐogeTreats OP_RETURN transactions.');
      return;
    }
    if (op === 'transfer' && !transferTo.trim()) {
      setError('Enter a recipient Dogecoin address.');
      return;
    }

    setBusy(true);
    setError(null);
    setTxid(null);
    try {
      const id = await signAndBroadcastTreats({
        op: op as TreatsOpKind,
        tick,
        fromAddress: address,
        privateKeyWIF: browser.wallet.privateKey,
        recipientAddress: dustRecipient,
        max: op === 'deploy' ? max : undefined,
        lim: op === 'deploy' && lim.trim() ? lim : undefined,
        amt: op === 'mint' || op === 'transfer' ? amt : undefined,
      });
      setTxid(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ÐogeTreats broadcast failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`space-y-6 ${className}`.trim()}>
      {!compact && (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FCD34D]">ÐogeTreats</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Drop a treat on-chain</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            OP_RETURN fungibles with wire <code className="text-zinc-200">p:&quot;dt&quot;</code>. vout&nbsp;0 is the treat;
            vout&nbsp;1 is ≥0.01&nbsp;DOGE paired dust to the token recipient. Atomic balances — no inscription two-step.
          </p>
        </div>
      )}

      {ops.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {ops.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => {
                setOp(o);
                reset();
              }}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold capitalize transition ${
                op === o
                  ? 'border-[#FCD34D]/50 bg-[#FCD34D]/10 text-[#FCD34D]'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-5">
          {!lockTick && (
            <>
              <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500">Ticker (1–4)</label>
              <input
                value={tick}
                onChange={(e) => {
                  setTick(e.target.value.toUpperCase().slice(0, 4));
                  reset();
                }}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono uppercase text-white"
                maxLength={4}
                placeholder="WOW"
              />
            </>
          )}

          {lockTick && tick && (
            <p className="text-sm text-zinc-400">
              Ticker: <span className="font-mono font-bold text-[#FCD34D]">{tick.toUpperCase()}</span>
            </p>
          )}

          {op === 'deploy' && (
            <>
              <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500">Max supply</label>
              <input
                type="number"
                min={1}
                value={max}
                onChange={(e) => {
                  setMax(e.target.value);
                  reset();
                }}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
              />
              <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500">Mint limit (optional)</label>
              <input
                type="number"
                min={1}
                value={lim}
                onChange={(e) => {
                  setLim(e.target.value);
                  reset();
                }}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
              />
            </>
          )}

          {(op === 'mint' || op === 'transfer') && (
            <>
              <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500">Amount</label>
              <input
                type="number"
                min={1}
                value={amt}
                onChange={(e) => {
                  setAmt(e.target.value);
                  reset();
                }}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
              />
            </>
          )}

          {op === 'transfer' && (
            <>
              <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500">Recipient address</label>
              <input
                value={transferTo}
                onChange={(e) => {
                  setTransferTo(e.target.value);
                  reset();
                }}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-white"
                placeholder="D…"
              />
              <p className="text-xs text-zinc-500">
                Tokens credit the paired dust output (vout&nbsp;1) at this address. You spend from your connected wallet.
              </p>
            </>
          )}

          {op !== 'transfer' && (
            <p className="text-xs text-zinc-500">
              Paired dust recipient:{' '}
              <span className="font-mono text-zinc-300">{address || '— connect wallet —'}</span>
            </p>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>
          )}

          {txid && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              Broadcast:{' '}
              <a
                href={`https://dogechain.info/tx/${txid}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono underline"
              >
                {txid.slice(0, 20)}…
              </a>
            </div>
          )}

          <button
            type="button"
            disabled={!isValid || !address || busy}
            onClick={() => void handleBroadcast()}
            className="w-full rounded-xl bg-[#FCD34D] px-4 py-3 text-sm font-bold text-black transition hover:bg-[#fde68a] disabled:opacity-50"
          >
            {busy ? 'Signing & broadcasting…' : `Broadcast ${op}`}
          </button>
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Compact treat JSON</p>
          <pre className="overflow-x-auto rounded-xl bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200">
            {json ? JSON.stringify(JSON.parse(json), null, 2) : '—'}
          </pre>
        </div>
      </div>
    </div>
  );
}

/** Transfer-only embed for token detail pages */
export function TreatsTransferPanel(props: Omit<TreatsMintPanelProps, 'ops' | 'initialOp'> & { initialTick: string }) {
  return (
    <TreatsMintPanel
      {...props}
      ops={['transfer']}
      initialOp="transfer"
      lockTick
      compact
    />
  );
}
