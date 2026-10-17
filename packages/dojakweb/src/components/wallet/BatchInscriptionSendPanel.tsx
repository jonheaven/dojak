import { useEffect, useMemo, useState } from 'react';
import { DogeTxTracker } from '../DogeTxTracker';
import type { MyDogeInscription } from '../../utils/api';
import { parseInscriptionText } from '../../utils/inscription-text';
import { MAX_BATCH_INSCRIPTION_COINS } from '../../lib/inscription-batch-send';
import {
  broadcastTx,
  buildSendInscriptionsDraft,
  getAddressUtxos,
  resolveBuyFeeRateKoinuPerByte,
  shibesToDoge,
  signAndFinalizeSimplePSDT,
  type SendInscriptionsPsbtDraft,
} from '../../lib/doginal-psdt';
import {
  classifySendRecipient,
  resolveSendRecipient,
  type ResolvedSendRecipient,
} from '../../lib/resolveSendRecipient';
import {
  isInputsSpentBroadcastError,
  markOutpointsSpent,
  recordPaymentBroadcast,
} from '../../lib/mempoolSpendOverlay';
import { filterUtxosByRpcGetTxOutIfConfigured, rpcGetTxOutSpendable } from '../../lib/utxo-tools';
import { upsertWalletTxJournalEntry } from '../../lib/wallet-tx-journal';

export type BatchSendItem = {
  id: string;
  label: string;
  outpoint: string;
  satOffset?: number;
};

export function batchItemFromInscription(item: MyDogeInscription): BatchSendItem | null {
  const loc = String(item.location || item.output || '').trim();
  const parts = loc.split(':');
  if (parts.length < 2) return null;
  const txid = (parts[0] || '').trim().toLowerCase();
  const vout = Number(parts[1]);
  if (!/^[0-9a-f]{64}$/.test(txid) || !Number.isInteger(vout) || vout < 0) return null;
  const offset = parts.length >= 3 ? Number(parts[2]) : 0;
  const parsed = item.contentBody ? parseInscriptionText(item.contentBody) : null;
  const label =
    parsed && parsed.protocol === 'dns' && parsed.title && parsed.title !== 'DNS'
      ? parsed.title
      : item.inscriptionNumber != null
        ? `#${item.inscriptionNumber}`
        : `${txid.slice(0, 6)}…`;
  return {
    id: item.inscriptionId,
    label,
    outpoint: `${txid}:${vout}`,
    satOffset: Number.isInteger(offset) && offset >= 0 ? offset : 0,
  };
}

export { MAX_BATCH_INSCRIPTION_COINS };

function feeLabel(shib: number): string {
  const doge = shibesToDoge(shib);
  if (!Number.isFinite(doge)) return '…';
  return `${doge.toFixed(doge >= 1 ? 4 : 6).replace(/0+$/, '').replace(/\.$/, '')} Ð`;
}

const PRIMARY =
  'bg-[#FCD34D] hover:bg-[#FDE68A] text-[#161109] font-bold py-2.5 px-4 rounded-2xl shadow-[0_8px_24px_rgba(252,211,77,0.22)] transition disabled:opacity-40';
const SECONDARY =
  'bg-white/[0.06] hover:bg-white/[0.1] text-white font-bold py-2.5 px-4 rounded-2xl border border-white/10 transition disabled:opacity-40';

export function BatchInscriptionSendPanel(props: {
  items: BatchSendItem[];
  fromAddress: string;
  lockedOutpoints: string[];
  getPrivateKey: () => Promise<string>;
  onBack: () => void;
  onSent?: (txid: string) => void;
}) {
  const [to, setTo] = useState('');
  const [resolved, setResolved] = useState<ResolvedSendRecipient | null>(null);
  const [lookup, setLookup] = useState<'off' | 'loading' | 'ok' | 'error'>('off');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [draft, setDraft] = useState<SendInscriptionsPsbtDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);

  const names = useMemo(() => props.items.map((item) => item.label), [props.items]);
  const coinCount = useMemo(() => new Set(props.items.map((item) => item.outpoint)).size, [props.items]);

  useEffect(() => {
    const raw = to.trim();
    if (!raw) {
      setResolved(null);
      setLookup('off');
      setLookupError(null);
      return;
    }
    if (classifySendRecipient(raw).kind === 'empty') return;
    let cancelled = false;
    setLookup('loading');
    setLookupError(null);
    const timer = window.setTimeout(() => {
      void resolveSendRecipient(raw).then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setResolved(result);
          setLookup('ok');
          setLookupError(null);
        } else {
          setResolved(null);
          setLookup('error');
          setLookupError(result.error);
        }
      });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [to]);

  async function review() {
    if (!resolved) return;
    if (resolved.address === props.fromAddress) {
      setError('Choose the wallet that should receive these.');
      setDraft(null);
      return;
    }
    setBusy(true);
    setError(null);
    setDraft(null);
    try {
      for (const item of props.items) {
        const [txidIn, voutStr] = item.outpoint.split(':');
        const free = await rpcGetTxOutSpendable({ txid: txidIn, vout: Number(voutStr) });
        if (free === false) {
          throw new Error(`${item.label} is already spent or sitting in a pending send.`);
        }
      }
      const feeRate = await resolveBuyFeeRateKoinuPerByte(2);
      const coins = await getAddressUtxos(props.fromAddress);
      const live = await filterUtxosByRpcGetTxOutIfConfigured(coins);
      const next = await buildSendInscriptionsDraft({
        inscriptions: props.items.map((item) => ({
          outpoint: item.outpoint,
          satOffset: item.satOffset,
          label: item.label,
        })),
        recipientAddress: resolved.address,
        senderAddress: props.fromAddress,
        paymentUtxos: live,
        lockedOutpoints: props.lockedOutpoints,
        feeRateKoinuPerByte: feeRate,
      });
      setDraft(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not prepare the send.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!draft || !resolved) return;
    setBusy(true);
    setError(null);
    try {
      const priv = await props.getPrivateKey();
      const hex = await signAndFinalizeSimplePSDT(draft.psbtBase64, priv);
      const sent = (await broadcastTx(hex)).toLowerCase();
      const spent = draft.inputs.map((row) => {
        const [txidIn, voutStr] = row.outpoint.split(':');
        return { txid: txidIn, vout: parseInt(voutStr, 10) };
      });
      const changeVout = draft.outputs.findIndex((o) => o.role === 'change');
      const changeOut = changeVout >= 0 ? draft.outputs[changeVout] : undefined;
      recordPaymentBroadcast({
        address: props.fromAddress,
        txid: sent,
        spent,
        change: changeOut && changeVout >= 0 ? { vout: changeVout, value: changeOut.valueShib } : null,
      });
      const title = names.length === 1 ? names[0]! : `${names.length} DNS names`;
      upsertWalletTxJournalEntry({
        txid: sent,
        address: props.fromAddress,
        protocol: 'doginals',
        action: 'send',
        title,
        summary: `${names.length} inscriptions → ${resolved.label || resolved.display}`,
        status: 'broadcasted',
        metadata: {
          recipientAddress: resolved.address,
          actionLabel: 'Send',
          contentPreview: names.slice(0, 8).join(', '),
        },
      });
      setTxid(sent);
      setDraft(null);
      props.onSent?.(sent);
    } catch (e) {
      if (isInputsSpentBroadcastError(e)) {
        const spent = (draft?.inputs ?? []).map((row) => {
          const [txidIn, voutStr] = row.outpoint.split(':');
          return { txid: txidIn, vout: parseInt(voutStr, 10) };
        });
        const actuallySpent: Array<{ txid: string; vout: number }> = [];
        for (const s of spent) {
          const free = await rpcGetTxOutSpendable(s);
          if (free === false) actuallySpent.push(s);
        }
        if (actuallySpent.length) markOutpointsSpent(props.fromAddress, actuallySpent);
        setDraft(null);
        setError('One of these is already in a pending transfer. Wait for that transaction instead of sending again.');
      } else {
        setError(e instanceof Error ? e.message : 'Send failed.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/70">
        {names.length} {names.length === 1 ? 'name' : 'names'}
        {coinCount === names.length ? '' : ` on ${coinCount} coins`} move in one transaction. Each coin
        keeps its own output at the same amount, so every name arrives separately.
      </p>
      <div className="max-h-36 overflow-auto rounded-2xl border border-white/10 bg-white/[0.03] p-2">
        <ul className="flex flex-wrap gap-1.5">
          {props.items.map((item) => (
            <li
              key={item.id}
              className="rounded-full bg-[#D4A017]/15 px-2.5 py-1 font-mono text-[11px] text-[#FCD34D]"
            >
              {item.label}
            </li>
          ))}
        </ul>
      </div>

      {txid ? (
        <div className="space-y-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4">
          <div className="text-sm font-semibold text-green-300">Sent</div>
          <DogeTxTracker txid={txid} showLabel={false} full linkClassName="text-xs text-yellow-400 underline break-all font-mono">
            View transaction
          </DogeTxTracker>
        </div>
      ) : (
        <>
          <label className="block text-sm text-[#E5E5E5]">
            <span className="mb-2 block">Their wallet, @handle, or domain</span>
            <input
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setDraft(null);
                setError(null);
              }}
              placeholder="D… or name.doge"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className="wallet-input"
              disabled={busy}
            />
            {to.trim() ? (
              <p className={`mt-2 text-xs ${lookup === 'error' ? 'text-red-300' : 'text-white/50'}`}>
                {lookup === 'loading'
                  ? 'Looking that up…'
                  : lookup === 'ok' && resolved
                    ? resolved.kind === 'address'
                      ? 'Dogecoin address'
                      : `${resolved.label || resolved.display} → ${resolved.address}`
                    : lookupError}
              </p>
            ) : null}
          </label>

          {draft ? (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">
              <p>
                {draft.inscriptionCount} {draft.inscriptionCount === 1 ? 'output' : 'outputs'} to{' '}
                <span className="font-mono text-xs">{resolved?.address}</span>
              </p>
              <p className="mt-1">
                Miner fee <strong>{feeLabel(draft.feeShib)}</strong>
                {draft.feeShib >= 1_000_000 ? ' — includes the extra Dogecoin charges for small name coins.' : '.'}
              </p>
              {draft.sharedCoins > 0 ? (
                <p className="mt-1 text-emerald-100/80">
                  {draft.sharedCoins} {draft.sharedCoins === 1 ? 'coin already holds' : 'coins already hold'} more
                  than one name. Those names stay together.
                </p>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">{error}</div>
          ) : null}

          <div className="flex gap-2">
            <button type="button" onClick={props.onBack} disabled={busy} className={SECONDARY}>
              Back
            </button>
            {!draft ? (
              <button
                type="button"
                onClick={() => void review()}
                disabled={busy || lookup !== 'ok' || !resolved}
                className={`flex-1 ${PRIMARY}`}
              >
                {busy ? 'Preparing…' : 'Review send'}
              </button>
            ) : (
              <button type="button" onClick={() => void confirm()} disabled={busy} className={`flex-1 ${PRIMARY}`}>
                {busy ? 'Sending…' : `Send ${names.length}`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
