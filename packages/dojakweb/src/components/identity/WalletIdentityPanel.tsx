'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AtSymbolIcon, CheckBadgeIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { useDojakwebI18n } from '../../contexts/DojakwebLocaleContext';
import {
  DN05_DOMAIN,
  encodeNpub,
  normalizeDn05Name,
  parseNostrPubkey,
  publishDn05OnChain,
  pubkeyHexFromInput,
} from '../../lib/dn05';
import { normalizeDnsName, publishDnsOnChain } from '../../lib/dnsPublish';
import {
  dxChallengeTweetText,
  dxTweetIntentUrl,
  publishDxOnChain,
} from '../../lib/dx/onchain';
import { normalizeDxXHandle, parseTweetIdFromInput } from '../../lib/dx/protocol';
import { buildDxCollectibleHtml } from '../../lib/dx/displayHtml';
import { findDxSouvenirInInscriptions } from '../../lib/dx/souvenir';
import { HtmlInscriptionThumb } from '../wallet/TextInscriptionPreview';
import { DogePFPAvatar } from '../DogePFPAvatar';
import {
  countDoginalTransactionsForContent,
  signDoginalInscriptionChain,
} from '../../lib/dogetag/doginal-chain';
import { extractProtectedOutpoints } from '../../lib/dogetag/protectedOutpoints';
import {
  broadcastSignedDoginalChain,
  isBroadcastInputRejected,
  isMempoolChainLimitError,
} from '../../lib/dx/broadcastDoginalPlan';
import { DxPackRipReveal } from '../dx/DxPackRipReveal';
import {
  fetchDxByAddress,
  fetchDxByHandle,
  fetchN05ByAddress,
  fetchN05ByName,
  fetchDnsByAddress,
  type DxRegistration,
  type N05Record,
  type DnsNameRecord,
} from '../../lib/identity/indexer';
import { requestDxCardArt, dxCardArtFailureMessage, verifyDxTweet } from '../../lib/identity/commandDog';
import type { MyDogeInscription } from '../../utils/api';

const PRIMARY =
  'bg-[#FCD34D] hover:bg-[#FDE68A] text-[#161109] font-bold py-2.5 px-4 rounded-2xl shadow-[0_8px_24px_rgba(252,211,77,0.22)] transition';
const SECONDARY =
  'bg-white/[0.06] hover:bg-white/[0.1] text-white font-bold py-2.5 px-4 rounded-2xl shadow-sm transition border border-white/10';
const DANGER =
  'bg-red-500/15 hover:bg-red-500/25 text-red-200 font-bold py-2.5 px-4 rounded-2xl shadow-sm transition border border-red-400/25';
const INPUT = 'wallet-input';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

function Btn({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'min-h-10 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    />
  );
}

function shortNpub(hex: string): string {
  try {
    const pk = parseNostrPubkey(hex);
    if (!pk) return `${hex.slice(0, 8)}…`;
    const npub = encodeNpub(pk);
    return `${npub.slice(0, 12)}…${npub.slice(-6)}`;
  } catch {
    return `${hex.slice(0, 8)}…`;
  }
}

function feeForChain(base: number, stages: number): number {
  if (stages >= 10) return Math.ceil(base * 1.25);
  return Math.ceil(base);
}

export type WalletIdentityTab = 'dx' | 'n05' | 'dns';

export type WalletIdentityPanelProps = {
  address: string | null;
  connected: boolean;
  isBrowserWallet: boolean;
  privateKeyWif: string | null;
  inscriptions: MyDogeInscription[];
  seedDxHandle?: string;
  onBack: () => void;
  onDxBindSuccess: (register: Record<string, unknown>) => void;
  onDxBindError: (message: string) => void;
};

export function WalletIdentityPanel({
  address,
  connected,
  isBrowserWallet,
  privateKeyWif,
  inscriptions,
  seedDxHandle,
  onBack,
  onDxBindSuccess,
  onDxBindError,
}: WalletIdentityPanelProps) {
  const { t } = useDojakwebI18n();
  const [tab, setTab] = useState<WalletIdentityTab>('dx');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [dxMine, setDxMine] = useState<DxRegistration | null>(null);
  const [n05Mine, setN05Mine] = useState<N05Record | null>(null);
  const [dnsMine, setDnsMine] = useState<DnsNameRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const [handleInput, setHandleInput] = useState(() => (seedDxHandle || '').replace(/^@+/, ''));
  const [tweetRaw, setTweetRaw] = useState('');
  const [tweetOk, setTweetOk] = useState<boolean | null>(null);
  const [handleTaken, setHandleTaken] = useState<DxRegistration | null | undefined>(undefined);
  const [lastDxTxid, setLastDxTxid] = useState<string | null>(null);

  const [n05Name, setN05Name] = useState('');
  const [n05Pubkey, setN05Pubkey] = useState('');
  const [nameTaken, setNameTaken] = useState<N05Record | null | undefined>(undefined);
  const [lastN05Txid, setLastN05Txid] = useState<string | null>(null);
  const [dnsLabel, setDnsLabel] = useState('');
  const [dnsUrl, setDnsUrl] = useState('');
  const [lastDnsTxid, setLastDnsTxid] = useState<string | null>(null);

  const [wantGrok, setWantGrok] = useState(true);
  const [cardArtUrl, setCardArtUrl] = useState<string | null>(null);
  const [cardInscriptionId, setCardInscriptionId] = useState<string | null>(null);
  const [artBusy, setArtBusy] = useState(false);
  const [mintAnother, setMintAnother] = useState(false);
  const [ownedSouvenirHtml, setOwnedSouvenirHtml] = useState<string | null>(null);

  const canSign = Boolean(connected && address && isBrowserWallet && privateKeyWif);

  const normalizedHandle = useMemo(() => {
    try {
      return handleInput.trim() ? normalizeDxXHandle(handleInput) : '';
    } catch {
      return '';
    }
  }, [handleInput]);

  const tweetId = useMemo(() => parseTweetIdFromInput(tweetRaw), [tweetRaw]);
  const n05Normalized = useMemo(() => normalizeDn05Name(n05Name), [n05Name]);
  const n05Identifier = n05Normalized ? `${n05Normalized}@${DN05_DOMAIN}` : '';
  const n05Hex = useMemo(() => pubkeyHexFromInput(n05Pubkey), [n05Pubkey]);

  const load = useCallback(async () => {
    if (!address) {
      setDxMine(null);
      setN05Mine(null);
      setDnsMine([]);
      return;
    }
    setLoading(true);
    try {
      const [dx, n05, dns] = await Promise.all([
        fetchDxByAddress(address),
        fetchN05ByAddress(address),
        fetchDnsByAddress(address),
      ]);
      setDxMine(dx);
      setN05Mine(n05);
      setDnsMine(dns);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (seedDxHandle) {
      setHandleInput(seedDxHandle.replace(/^@+/, ''));
      setTab('dx');
    }
  }, [seedDxHandle]);

  useEffect(() => {
    if (dxMine?.xHandle) setHandleInput(dxMine.xHandle.replace(/^@+/, ''));
  }, [dxMine?.xHandle]);

  useEffect(() => {
    if (!dxMine) {
      setOwnedSouvenirHtml(null);
      return;
    }
    let cancelled = false;
    void findDxSouvenirInInscriptions(inscriptions, { xHandle: dxMine.xHandle }).then((hit) => {
      if (cancelled || !hit) return;
      setCardInscriptionId(hit.inscriptionId);
      setOwnedSouvenirHtml(hit.html);
    });
    return () => {
      cancelled = true;
    };
  }, [dxMine, inscriptions]);

  useEffect(() => {
    if (n05Mine?.name) {
      setN05Name(n05Mine.name);
      setN05Pubkey(n05Mine.pubkey);
    }
  }, [n05Mine?.name, n05Mine?.pubkey]);

  useEffect(() => {
    if (!lastDxTxid && !lastN05Txid) return;
    const started = Date.now();
    const id = window.setInterval(() => {
      if (Date.now() - started > 90_000) {
        window.clearInterval(id);
        return;
      }
      void load();
    }, 2500);
    return () => window.clearInterval(id);
  }, [lastDxTxid, lastN05Txid, load]);

  useEffect(() => {
    if (!normalizedHandle) {
      setHandleTaken(undefined);
      return;
    }
    let cancelled = false;
    const tmo = window.setTimeout(() => {
      void fetchDxByHandle(normalizedHandle).then((r) => {
        if (!cancelled) setHandleTaken(r);
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(tmo);
    };
  }, [normalizedHandle]);

  useEffect(() => {
    if (!n05Normalized) {
      setNameTaken(undefined);
      return;
    }
    let cancelled = false;
    const tmo = window.setTimeout(() => {
      void fetchN05ByName(n05Normalized).then((r) => {
        if (!cancelled) setNameTaken(r);
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(tmo);
    };
  }, [n05Normalized]);

  const dxTakenByOther = Boolean(handleTaken && address && handleTaken.dogeAddress !== address);
  const n05TakenByOther = Boolean(nameTaken && address && nameTaken.address !== address);

  async function bindDx(op: 'register' | 'revoke') {
    if (!canSign || !address || !privateKeyWif) {
      setErr(t('modal.identity.needBrowser'));
      return;
    }
    const useHandle = op === 'revoke' ? dxMine?.xHandle || normalizedHandle : normalizedHandle;
    if (!useHandle) {
      setErr(t('modal.identity.needHandle'));
      return;
    }
    if (op === 'register' && !tweetId) {
      setErr(t('modal.verification.errTweetId'));
      return;
    }
    if (op === 'register' && dxTakenByOther) {
      setErr(t('modal.identity.handleTaken'));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const result = await publishDxOnChain({
        fromAddress: address,
        privateKeyWIF: privateKeyWif,
        op,
        handle: useHandle,
        tweetId: op === 'register' ? tweetId ?? undefined : undefined,
      });
      setLastDxTxid(result.txid);
      if (op === 'register') {
        onDxBindSuccess({
          p: 'dx',
          op: 'register',
          x_handle: result.handle,
          doge_address: address,
          txid: result.txid,
          tweet_id: tweetId,
          source: 'op_return',
        });
        toast.success(t('modal.identity.dxLinked'));
      } else {
        toast.success(t('modal.identity.dxUnlinked'));
      }
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      if (op === 'register') onDxBindError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function checkTweet() {
    if (!address || !normalizedHandle || !tweetRaw.trim()) {
      setErr(t('modal.identity.needTweet'));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await verifyDxTweet({
        tweetUrl: tweetRaw,
        xHandle: normalizedHandle,
        dogeAddress: address,
      });
      setTweetOk(r.ok);
      if (!r.ok) setErr(r.error || t('modal.identity.tweetFail'));
    } finally {
      setBusy(false);
    }
  }

  async function generateCardArt() {
    if (!address || !dxMine) {
      setErr(t('modal.identity.mintWait'));
      return;
    }
    setArtBusy(true);
    setErr(null);
    setCardArtUrl(null);
    try {
      const art = await requestDxCardArt({ userAddress: address, xHandle: dxMine.xHandle });
      if (!art.ok) {
        setErr(art.error || t('modal.identity.grokFailed'));
        return;
      }
      if (art.badgeImageUrl) {
        setCardArtUrl(art.badgeImageUrl);
        return;
      }
      setErr(dxCardArtFailureMessage(art));
    } finally {
      setArtBusy(false);
    }
  }

  async function mintCard() {
    if (!canSign || !address || !privateKeyWif || !dxMine?.txid) {
      setErr(t('modal.identity.mintWait'));
      return;
    }
    if (wantGrok && !cardArtUrl) {
      setErr(t('modal.identity.generateArtFirst'));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const html = buildDxCollectibleHtml({
        xHandle: dxMine.xHandle,
        dogeAddress: dxMine.dogeAddress,
        dxTxid: dxMine.txid,
        tweetId: dxMine.tweetId,
        artUrl: wantGrok ? cardArtUrl : null,
      });
      const buf = Buffer.from(html, 'utf8');
      const ct = 'text/html;charset=utf-8';
      const plan = await signDoginalInscriptionChain({
        content: buf,
        contentType: ct,
        fromAddress: address,
        privateKeyWIF: privateKeyWif,
        feeRate: 0,
        excludedOutpoints: extractProtectedOutpoints(inscriptions),
      });
      await broadcastSignedDoginalChain(plan);
      setCardInscriptionId(plan.inscriptionId);
      toast.success(t('modal.identity.cardMinted'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isBroadcastInputRejected(msg)) setErr(t('modal.verification.dxInscribeSpendRejected'));
      else if (isMempoolChainLimitError(msg)) setErr(t('modal.verification.dxInscribeMempoolChain'));
      else setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  async function claimN05(op: 'set' | 'clear') {
    if (!canSign || !address || !privateKeyWif) {
      setErr(t('modal.identity.needBrowser'));
      return;
    }
    const claimName = op === 'clear' ? n05Mine?.name ?? n05Normalized : n05Normalized;
    if (!claimName) {
      setErr(t('modal.identity.needName'));
      return;
    }
    if (op === 'set' && !n05Hex) {
      setErr(t('modal.identity.needNpub'));
      return;
    }
    if (op === 'set' && n05TakenByOther) {
      setErr(t('modal.identity.nameTaken'));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const result = await publishDn05OnChain({
        fromAddress: address,
        privateKeyWIF: privateKeyWif,
        op,
        name: claimName,
        pubkey: op === 'set' ? n05Pubkey : undefined,
      });
      setLastN05Txid(result.txid);
      toast.success(op === 'set' ? t('modal.identity.n05Claimed') : t('modal.identity.n05Released'));
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function claimDns() {
    if (!canSign || !address || !privateKeyWif) {
      setErr(t('modal.identity.needBrowser'));
      return;
    }
    const name = normalizeDnsName(dnsLabel);
    if (!name) {
      setErr('Need a valid name (jon.doge)');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const result = await publishDnsOnChain({
        fromAddress: address,
        privateKeyWIF: privateKeyWif,
        op: 'register',
        name,
        records: {
          address,
          url: dnsUrl.trim() || undefined,
        },
      });
      setLastDnsTxid(result.inscriptionId);
      toast.success(`${name} inscribed`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-[#0A0A0A] px-4 py-3 text-xs leading-5 text-white/70">
        {t('modal.identity.blurb')}
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
        <button
          type="button"
          onClick={() => {
            setTab('dx');
            setErr(null);
          }}
          className={cx(
            'flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold transition',
            tab === 'dx' ? 'bg-amber-400/15 text-amber-100' : 'text-white/55 hover:text-white',
          )}
        >
          <CheckBadgeIcon className="h-4 w-4" aria-hidden />
          Ð𝕏
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('n05');
            setErr(null);
          }}
          className={cx(
            'flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold transition',
            tab === 'n05' ? 'bg-violet-400/15 text-violet-100' : 'text-white/55 hover:text-white',
          )}
        >
          <AtSymbolIcon className="h-4 w-4" aria-hidden />
          ÐN05
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('dns');
            setErr(null);
          }}
          className={cx(
            'flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold transition',
            tab === 'dns' ? 'bg-emerald-400/15 text-emerald-100' : 'text-white/55 hover:text-white',
          )}
        >
          <GlobeAltIcon className="h-4 w-4" aria-hidden />
          DNS
        </button>
      </div>

      {!connected || !address ? (
        <p className="text-sm text-amber-200">{t('modal.verification.needWallet')}</p>
      ) : !isBrowserWallet || !privateKeyWif ? (
        <p className="text-sm text-amber-200">{t('modal.identity.needBrowser')}</p>
      ) : null}

      {loading ? <p className="text-xs text-white/45">{t('modal.identity.loading')}</p> : null}
      {err ? <p className="text-sm text-red-300">{err}</p> : null}

      {tab === 'dx' ? (
        <div className="space-y-3">
          <p className="text-sm leading-6 text-[#D4D4D4]">{t('modal.identity.dxIntro')}</p>
          {dxMine ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-sm text-amber-50">
              <DogePFPAvatar size="md" address={address} xHandle={dxMine.xHandle} />
              <div className="min-w-0">
                <p className="font-semibold">{dxMine.xHandle}</p>
                <p className="mt-1 font-mono text-[11px] text-white/60 break-all">{dxMine.txid}</p>
                <p className="mt-1 text-[11px] text-white/55">
                  {dxMine.tweetVerified === true
                    ? t('modal.identity.tweetVerified')
                    : t('modal.identity.tweetPending')}
                </p>
              </div>
            </div>
          ) : null}
          {lastDxTxid && !dxMine ? (
            <p className="text-xs text-amber-200/90">{t('modal.identity.waitIndex')}</p>
          ) : null}

          {!dxMine ? (
            <>
              <label className="block text-sm text-white">
                <span className="mb-2 block">{t('modal.verification.handleLabel')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-white/50">@</span>
                  <input
                    value={handleInput}
                    onChange={(e) => setHandleInput(e.target.value.replace(/^@+/, ''))}
                    placeholder="yourhandle"
                    className={INPUT}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    disabled={busy}
                  />
                </div>
              </label>
              {dxTakenByOther ? <p className="text-xs text-red-300">{t('modal.identity.handleTaken')}</p> : null}
              <Btn
                className={cx('w-full', SECONDARY)}
                disabled={!address || busy}
                onClick={() => {
                  if (!address) return;
                  window.open(dxTweetIntentUrl(address), '_blank', 'noopener,noreferrer');
                }}
              >
                {t('modal.identity.postTweet')}
              </Btn>
              <p className="text-[11px] leading-5 text-white/45 font-mono break-all">
                {address ? dxChallengeTweetText(address) : ''}
              </p>
              <label className="block text-sm text-white">
                <span className="mb-2 block">{t('modal.verification.tweetUrlLabel')}</span>
                <input
                  value={tweetRaw}
                  onChange={(e) => {
                    setTweetRaw(e.target.value);
                    setTweetOk(null);
                  }}
                  placeholder="https://x.com/you/status/123…"
                  className={INPUT}
                />
              </label>
              {tweetOk === true ? (
                <p className="text-xs text-green-300">{t('modal.identity.tweetOk')}</p>
              ) : null}
              <div className="flex flex-col gap-2">
                <Btn className={cx('w-full', SECONDARY)} disabled={busy || !tweetRaw.trim()} onClick={() => void checkTweet()}>
                  {t('modal.identity.checkTweet')}
                </Btn>
                <Btn className={cx('w-full', PRIMARY)} disabled={busy || !canSign || !tweetId || dxTakenByOther} onClick={() => void bindDx('register')}>
                  {busy ? t('modal.identity.broadcasting') : t('modal.identity.linkDx')}
                </Btn>
              </div>
            </>
          ) : (
            <>
              <Btn className={cx('w-full', DANGER)} disabled={busy || !canSign} onClick={() => void bindDx('revoke')}>
                {busy ? t('modal.identity.broadcasting') : t('modal.identity.unlinkDx')}
              </Btn>
              <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-sm font-semibold text-white/90">{t('modal.identity.souvenirTitle')}</p>
                {cardInscriptionId && ownedSouvenirHtml && !mintAnother ? (
                  <>
                    <p className="text-[11px] leading-5 text-white/50">{t('modal.identity.souvenirOwned')}</p>
                    <HtmlInscriptionThumb
                      item={{
                        inscriptionId: cardInscriptionId,
                        contentType: 'text/html;charset=utf-8',
                        contentBody: ownedSouvenirHtml,
                      }}
                      className="mx-auto h-40 w-40 rounded-xl border border-amber-400/30"
                    />
                    <p className="truncate font-mono text-[10px] text-white/35">{cardInscriptionId}</p>
                    <button
                      type="button"
                      className="text-[11px] text-amber-200/80 underline"
                      onClick={() => setMintAnother(true)}
                    >
                      {t('modal.identity.mintAnother')}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] leading-5 text-white/50">{t('modal.identity.souvenirHint')}</p>
                    <label className="flex cursor-pointer items-start gap-3 text-sm text-[#D4D4D4]">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0 rounded border-white/30 bg-[#0A0A0A] text-amber-500"
                        checked={wantGrok}
                        onChange={(e) => {
                          setWantGrok(e.target.checked);
                          setCardArtUrl(null);
                        }}
                        disabled={busy || artBusy}
                      />
                      <span>{t('modal.identity.grokArt')}</span>
                    </label>
                    {wantGrok ? (
                      <Btn
                        className={cx('w-full', SECONDARY)}
                        disabled={busy || artBusy || !dxMine.txid}
                        onClick={() => void generateCardArt()}
                      >
                        {artBusy ? t('modal.identity.generatingArt') : cardArtUrl ? t('modal.identity.regenerateArt') : t('modal.identity.generateArt')}
                      </Btn>
                    ) : null}
                    <Btn
                      className={cx('w-full', PRIMARY)}
                      disabled={busy || artBusy || !canSign || !dxMine.txid || (wantGrok && !cardArtUrl)}
                      onClick={() => void mintCard()}
                    >
                      {busy ? t('modal.identity.inscribing') : t('modal.identity.mintCard')}
                    </Btn>
                    {!dxMine.txid ? <p className="text-[11px] text-white/45">{t('modal.identity.mintWait')}</p> : null}
                    {cardInscriptionId && dxMine ? (
                      <DxPackRipReveal
                        xHandle={dxMine.xHandle}
                        dogeAddress={dxMine.dogeAddress}
                        badgeImageUrl={cardArtUrl}
                        packTitle={t('modal.verification.dxPackTitle')}
                        ripCta={t('modal.verification.dxRipCta')}
                        cardSubtitle={t('modal.identity.cardSubtitle')}
                        verifiedBanner={t('modal.verification.dxVerifiedBanner')}
                      />
                    ) : null}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      ) : tab === 'n05' ? (
        <div className="space-y-3">
          <p className="text-sm leading-6 text-[#D4D4D4]">{t('modal.identity.n05Intro')}</p>
          {n05Mine ? (
            <div className="rounded-xl border border-violet-400/25 bg-violet-500/10 p-3 text-sm text-violet-50">
              <p className="font-semibold">{n05Mine.identifier || `${n05Mine.name}@${DN05_DOMAIN}`}</p>
              <p className="mt-1 font-mono text-[11px] text-white/60">{shortNpub(n05Mine.pubkey)}</p>
              {n05Mine.txid ? (
                <p className="mt-1 font-mono text-[11px] text-white/50 break-all">{n05Mine.txid}</p>
              ) : null}
            </div>
          ) : null}
          {lastN05Txid && !n05Mine ? (
            <p className="text-xs text-violet-200/90">{t('modal.identity.waitIndex')}</p>
          ) : null}

          <label className="block text-sm text-white">
            <span className="mb-2 block">{t('modal.identity.nameLabel')}</span>
            <div className="flex items-center gap-2">
              <input
                value={n05Name}
                onChange={(e) => setN05Name(e.target.value)}
                placeholder="bob"
                className={INPUT}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={busy || Boolean(n05Mine)}
              />
              <span className="shrink-0 text-xs text-white/45">@{DN05_DOMAIN}</span>
            </div>
          </label>
          {n05Identifier ? <p className="text-[11px] font-mono text-white/45">{n05Identifier}</p> : null}
          {n05TakenByOther ? <p className="text-xs text-red-300">{t('modal.identity.nameTaken')}</p> : null}

          <label className="block text-sm text-white">
            <span className="mb-2 block">{t('modal.identity.npubLabel')}</span>
            <input
              value={n05Pubkey}
              onChange={(e) => setN05Pubkey(e.target.value)}
              placeholder="npub1… or 64-hex"
              className={cx(INPUT, 'font-mono text-xs')}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={busy || Boolean(n05Mine)}
            />
          </label>

          {!n05Mine ? (
            <Btn className={cx('w-full', PRIMARY)} disabled={busy || !canSign || !n05Normalized || !n05Hex || n05TakenByOther} onClick={() => void claimN05('set')}>
              {busy ? t('modal.identity.broadcasting') : t('modal.identity.claimN05')}
            </Btn>
          ) : (
            <Btn className={cx('w-full', DANGER)} disabled={busy || !canSign} onClick={() => void claimN05('clear')}>
              {busy ? t('modal.identity.broadcasting') : t('modal.identity.releaseN05')}
            </Btn>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm leading-6 text-[#D4D4D4]">
            Claim a <span className="font-semibold text-emerald-200">.doge</span> name as a Doginal.
            Point it at a site. Transfer the inscription to give it away.
          </p>
          {dnsMine.length ? (
            <ul className="space-y-2">
              {dnsMine.map((n) => (
                <li
                  key={n.name}
                  className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-50"
                >
                  <p className="font-semibold">{n.name}</p>
                  {n.records?.url ? (
                    <p className="truncate font-mono text-[11px] text-white/55">{n.records.url}</p>
                  ) : (
                    <p className="text-[11px] text-white/45">No site yet</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-white/50">No .doge names on this wallet yet.</p>
          )}
          <label className="block text-sm text-white">
            <span className="mb-2 block">Name</span>
            <div className="flex items-center gap-2">
              <input
                value={dnsLabel}
                onChange={(e) => setDnsLabel(e.target.value)}
                placeholder="jon"
                className={INPUT}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={busy}
              />
              <span className="shrink-0 text-xs text-white/45">.doge</span>
            </div>
          </label>
          <label className="block text-sm text-white">
            <span className="mb-2 block">Site URL (optional)</span>
            <input
              value={dnsUrl}
              onChange={(e) => setDnsUrl(e.target.value)}
              placeholder="https://"
              className={INPUT}
              autoCapitalize="none"
              disabled={busy}
            />
          </label>
          {lastDnsTxid ? (
            <p className="break-all font-mono text-[11px] text-white/50">{lastDnsTxid}</p>
          ) : null}
          <Btn
            className={cx('w-full', PRIMARY)}
            disabled={busy || !canSign || !normalizeDnsName(dnsLabel)}
            onClick={() => void claimDns()}
          >
            {busy ? t('modal.identity.broadcasting') : 'Register name'}
          </Btn>
          <a
            href="https://dogetrix.com/dns"
            target="_blank"
            rel="noreferrer"
            className="block text-center text-xs text-emerald-300/80 hover:text-emerald-200"
          >
            Open DNS on dogetrix.com
          </a>
        </div>
      )}

      <Btn className={cx('w-full', SECONDARY)} onClick={onBack}>
        {t('modal.verification.backToWallet')}
      </Btn>
    </div>
  );
}
