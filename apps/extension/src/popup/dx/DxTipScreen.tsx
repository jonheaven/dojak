import React, { useEffect, useMemo, useState } from 'react';
import {
  DX_EXPLORER_TX,
  DX_MIN_TIP_DOGE,
  dogecoinPayUri,
  dxPayInviteTweetIntentUrl,
  dxPayOnChainMemo,
  dxPayTweetIntentUrl,
  formatPayDoge,
  shortDxAddress,
  type DxLookupResult,
  type DxPendingAction
} from '@dojak/core/dx';
import type { WalletCoreAdapter } from '@dojak/ui/wallet/WalletCoreContext';
import { commandDogAvatar, lookupDxHandle } from './api';
import { DxShell } from './DxShell';

const QUICK = [1, 5, 10, 25, 69] as const;

export function DxTipScreen(props: {
  action: DxPendingAction;
  adapter: WalletCoreAdapter;
  onBack: () => void;
}) {
  const handle = props.action.handle;
  const postId = props.action.postId || null;
  const [lookup, setLookup] = useState<DxLookupResult | null>(null);
  const [amount, setAmount] = useState(props.action.postId ? '5' : '1');
  const [quick, setQuick] = useState<number | null>(props.action.postId ? 5 : 1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void lookupDxHandle(handle)
      .then((row) => {
        if (!cancelled) setLookup(row);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Lookup failed');
      });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  const amountNum = Number(amount);
  const amountOk = Number.isFinite(amountNum) && amountNum >= DX_MIN_TIP_DOGE;
  const to = lookup?.dogeAddress || lookup?.registration?.dogeAddress || '';
  const linked = lookup?.kind === 'linked' && Boolean(to);
  const memo = dxPayOnChainMemo(note, postId);
  const avatar = props.action.avatarUrl || commandDogAvatar(handle);

  const status = useMemo(() => {
    if (!lookup) return { cls: 'warn', text: 'Resolving Ð𝕏…' };
    if (lookup.kind === 'linked') return { cls: 'ok', text: lookup.stale ? 'Linked (cached)' : 'Linked on L1' };
    if (lookup.kind === 'unlinked') return { cls: 'warn', text: 'Not linked yet' };
    return { cls: 'bad', text: 'Indexer unreachable' };
  }, [lookup]);

  const send = async () => {
    setError(null);
    if (!linked || !to) return setError('This handle is not linked. Invite them to bind Ð𝕏 first.');
    if (!amountOk) return setError(`Minimum tip is ${DX_MIN_TIP_DOGE} Ð`);
    if (!props.adapter.sendDogecoin) return setError('Unlock Dojak to send.');
    try {
      setBusy(true);
      const res = await props.adapter.sendDogecoin({
        to,
        amount: Number(amountNum.toFixed(8)),
        feeRate: 2,
        memo
      });
      setTxid(res.txid);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setBusy(false);
    }
  };

  const copyPay = async () => {
    if (!to) return;
    try {
      await navigator.clipboard.writeText(dogecoinPayUri(to, { amount: amountOk ? amountNum : undefined, label: handle }));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('Copy failed');
    }
  };

  return (
    <DxShell kicker="Ð𝕏 Pay" title="Tip on 𝕏" onBack={props.onBack}>
      <section className="dx-hero">
        <img className="dx-avatar" src={avatar} alt="" onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0.35')} />
        <h2 className="dx-handle">{handle}</h2>
        {props.action.displayName ? <p className="dx-sub">{props.action.displayName}</p> : null}
        {postId ? <p className="dx-sub">Post {postId}</p> : null}
        <span className={`dx-pill ${status.cls}`}>{status.text}</span>
        {to ? <p className="dx-mono">{shortDxAddress(to, 8, 6)}</p> : null}
      </section>

      {lookup?.kind === 'unreachable' ? (
        <div className="dx-card">
          <p className="dx-error">Can’t reach dogex / command.dog. Don’t send until lookup works.</p>
          <button type="button" className="dx-secondary" onClick={() => void lookupDxHandle(handle).then(setLookup)}>
            Retry lookup
          </button>
        </div>
      ) : null}

      {linked && !txid ? (
        <div className="dx-card">
          <input
            className="dx-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setQuick(null);
            }}
            placeholder="0"
            aria-label="Amount in DOGE"
          />
          <p className="dx-note">Amount in DOGE · optional memo rides as OP_RETURN</p>
          <div className="dx-chips">
            {QUICK.map((n) => (
              <button
                key={n}
                type="button"
                className="dx-chip"
                data-on={quick === n ? 'true' : 'false'}
                onClick={() => {
                  setQuick(n);
                  setAmount(String(n));
                }}
              >
                {n} Ð
              </button>
            ))}
          </div>
          <input
            className="dx-input"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 80))}
            placeholder="Optional note"
            maxLength={80}
          />
          <button type="button" className="dx-primary" disabled={busy || !amountOk} onClick={() => void send()}>
            {busy ? 'Signing…' : `Send ${amountOk ? formatPayDoge(amountNum) : '0'} Ð`}
          </button>
          <button type="button" className="dx-secondary" onClick={() => void copyPay()}>
            {copied ? 'Copied dogecoin: URI' : 'Copy pay URI'}
          </button>
        </div>
      ) : null}

      {lookup?.kind === 'unlinked' ? (
        <div className="dx-card">
          <p className="dx-sub">
            {handle} has no Ð𝕏 bind on Dogecoin yet. We never hold coins for an unbound handle — invite them to link
            from the extension.
          </p>
          <a className="dx-primary" href={dxPayInviteTweetIntentUrl(handle, postId)} target="_blank" rel="noreferrer" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}>
            Invite on 𝕏
          </a>
        </div>
      ) : null}

      {txid ? (
        <div className="dx-card">
          <p className="dx-ok">Sent {formatPayDoge(amountNum)} Ð to {handle}</p>
          <a className="dx-link" href={`${DX_EXPLORER_TX}/${txid}`} target="_blank" rel="noreferrer">
            {shortDxAddress(txid, 10, 8)}
          </a>
          <a className="dx-secondary" href={dxPayTweetIntentUrl({ amountDoge: amountNum, handle, txid, postId })} target="_blank" rel="noreferrer" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}>
            Post receipt on 𝕏
          </a>
        </div>
      ) : null}

      {error ? <p className="dx-error">{error}</p> : null}
      <p className="dx-note">
        L1 only. Indexer dogex.command.dog · broadcast api.command.dog → Core. X never sees the UTXO.
      </p>
    </DxShell>
  );
}
