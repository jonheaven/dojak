import React, { useEffect, useMemo, useState } from 'react';
import {
  DX_EXPLORER_TX,
  dxChallengeTweetText,
  dxTweetIntentUrl,
  parseTweetIdFromInput,
  shortDxAddress,
  tryParsePayHandle,
  type DxLookupResult,
  type DxPendingAction
} from '@dojak/core/dx';
import type { WalletCoreAdapter } from '@dojak/ui/wallet/WalletCoreContext';
import { lookupDxAddress, lookupDxHandle, verifyDxTweet } from './api';
import { DxShell } from './DxShell';

export function DxLinkScreen(props: {
  action?: DxPendingAction | null;
  adapter: WalletCoreAdapter;
  onBack: () => void;
}) {
  const seeded = props.action?.handle?.replace(/^@/, '') || '';
  const [handleInput, setHandleInput] = useState(seeded);
  const [tweetRaw, setTweetRaw] = useState('');
  const [address, setAddress] = useState<string>('');
  const [mine, setMine] = useState<DxLookupResult | null>(null);
  const [taken, setTaken] = useState<DxLookupResult | null>(null);
  const [tweetOk, setTweetOk] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);

  const handle = tryParsePayHandle(handleInput);

  useEffect(() => {
    let cancelled = false;
    void props.adapter.getAddress?.().then((addr) => {
      if (!cancelled && addr) setAddress(addr);
    });
    return () => {
      cancelled = true;
    };
  }, [props.adapter]);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    void lookupDxAddress(address).then((row) => {
      if (!cancelled) {
        setMine(row);
        if (row.registration?.xHandle) setHandleInput(row.registration.xHandle.replace(/^@/, ''));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  useEffect(() => {
    if (!handle) {
      setTaken(null);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void lookupDxHandle(handle).then((row) => {
        if (!cancelled) setTaken(row);
      });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [handle]);

  const tweetId = useMemo(() => parseTweetIdFromInput(tweetRaw), [tweetRaw]);
  const claimedByOther = Boolean(
    taken?.registration?.dogeAddress && address && taken.registration.dogeAddress.toLowerCase() !== address.toLowerCase()
  );
  const alreadyMine = Boolean(mine?.kind === 'linked' && mine.registration?.xHandle);

  const challenge = dxChallengeTweetText(address || 'YOUR_DOGECOIN_ADDRESS');

  const copyChallenge = async () => {
    try {
      await navigator.clipboard.writeText(challenge);
    } catch {
      setError('Copy failed');
    }
  };

  const checkTweet = async () => {
    setError(null);
    setTweetOk(null);
    if (!handle || !address || !tweetId) return setError('Need handle, unlocked wallet, and a status URL.');
    setBusy(true);
    try {
      const res = await verifyDxTweet({
        tweetUrl: tweetRaw.trim() || `https://x.com/i/status/${tweetId}`,
        xHandle: handle,
        dogeAddress: address
      });
      setTweetOk(res.ok);
      if (!res.ok) setError(res.error || 'Tweet does not prove this address.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tweet check failed');
      setTweetOk(false);
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setError(null);
    if (!handle || !address || !tweetId) return setError('Finish the tweet proof first.');
    if (tweetOk !== true) return setError('Verify the tweet before inscribing.');
    if (claimedByOther) return setError('That handle is already bound to another address.');
    const publishDx = (props.adapter as WalletCoreAdapter & {
      publishDxRegister?: (p: { handle: string; tweetId: string }) => Promise<{ txid: string }>;
    }).publishDxRegister;
    if (!publishDx) return setError('Unlock Dojak to publish the Ð𝕏 bind.');
    setBusy(true);
    try {
      const res = await publishDx({ handle, tweetId });
      setTxid(res.txid);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'On-chain bind failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DxShell kicker="Ð𝕏 Identity" title="Link 𝕏 to Dogecoin" onBack={props.onBack}>
      <section className="dx-hero">
        <h2 className="dx-handle">{handle || 'Your handle'}</h2>
        <p className="dx-sub">Fully in-wallet. Tweet proves the address, then a compact DX OP_RETURN writes it on L1.</p>
        {address ? <p className="dx-mono">{shortDxAddress(address, 8, 6)}</p> : <p className="dx-sub">Unlock Dojak to continue.</p>}
        {alreadyMine ? <span className="dx-pill ok">Already linked {mine?.registration?.xHandle}</span> : null}
      </section>

      <div className="dx-card dx-steps">
        <div className="dx-step">
          <span className="dx-n">1</span>
          <div>
            <p className="dx-sub" style={{ color: '#f4efe3', fontWeight: 700 }}>
              Handle
            </p>
            <input
              className="dx-input"
              value={handleInput}
              onChange={(e) => setHandleInput(e.target.value.replace(/^@/, ''))}
              placeholder="username"
              maxLength={15}
              autoCapitalize="off"
              autoCorrect="off"
            />
            {claimedByOther ? (
              <p className="dx-error">@{handleInput} is already bound to another wallet.</p>
            ) : taken?.kind === 'unlinked' && handle ? (
              <p className="dx-ok">Handle is free on the index.</p>
            ) : null}
          </div>
        </div>

        <div className="dx-step">
          <span className="dx-n">2</span>
          <div>
            <p className="dx-sub" style={{ color: '#f4efe3', fontWeight: 700 }}>
              Prove it on 𝕏
            </p>
            <p className="dx-note">The tweet must contain this exact P2PKH.</p>
            <div className="dx-row" style={{ marginTop: 8 }}>
              {address ? (
                <a
                  className="dx-primary"
                  href={dxTweetIntentUrl(address)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}
                >
                  Compose tweet
                </a>
              ) : (
                <button type="button" className="dx-primary" disabled>
                  Unlock to compose
                </button>
              )}
              <button type="button" className="dx-secondary" onClick={() => void copyChallenge()} disabled={!address}>
                Copy
              </button>
            </div>
          </div>
        </div>

        <div className="dx-step">
          <span className="dx-n">3</span>
          <div>
            <p className="dx-sub" style={{ color: '#f4efe3', fontWeight: 700 }}>
              Paste the status
            </p>
            <input
              className="dx-input"
              value={tweetRaw}
              onChange={(e) => {
                setTweetRaw(e.target.value);
                setTweetOk(null);
              }}
              placeholder="https://x.com/you/status/…"
            />
            <button type="button" className="dx-secondary" style={{ marginTop: 8 }} disabled={busy || !tweetId} onClick={() => void checkTweet()}>
              {busy && tweetOk == null ? 'Checking…' : tweetOk === true ? 'Verified' : 'Verify tweet'}
            </button>
            {tweetOk === true ? <p className="dx-ok">command.dog confirmed the tweet.</p> : null}
          </div>
        </div>

        <div className="dx-step">
          <span className="dx-n">4</span>
          <div>
            <p className="dx-sub" style={{ color: '#f4efe3', fontWeight: 700 }}>
              Inscribe DX on L1
            </p>
            <button type="button" className="dx-primary" disabled={busy || tweetOk !== true} onClick={() => void publish()}>
              {busy ? 'Broadcasting…' : 'Publish bind'}
            </button>
          </div>
        </div>
      </div>

      {txid ? (
        <div className="dx-card">
          <p className="dx-ok">Ð𝕏 bind broadcast.</p>
          <a className="dx-link" href={`${DX_EXPLORER_TX}/${txid}`} target="_blank" rel="noreferrer">
            {shortDxAddress(txid, 10, 8)}
          </a>
        </div>
      ) : null}

      {error ? <p className="dx-error">{error}</p> : null}
      <p className="dx-note">
        Same protocol as dogex.dog/dx. Proof via api.command.dog/v1/dx/verify-tweet. Index via dogex /api/dx.
      </p>
    </DxShell>
  );
}
