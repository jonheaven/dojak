'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useUnifiedWallet } from '../../contexts/useUnifiedWallet';
import { useBrowserWallet } from '../../contexts/BrowserWalletContext';
import { DogeTxLink } from '../DogeTxLink';
import { useBroadcastReceipt } from '../../lib/broadcast-receipt';
import { upsertWalletTxJournalEntry } from '../../lib/wallet-tx-journal';
import {
  buildTreatsDeployJson,
  buildTreatsMintJson,
  treatsPostPremineRemaining,
  buildTreatsTransferJson,
  signAndBroadcastTreats,
  fetchTreatsPowConfig,
  fetchTreatsPowChallenge,
  mineTreatsPow,
  estimatePowSeconds,
  tickRequiresPow,
  type TreatsOpKind,
  NOIZ_FLAGSHIP,
  isNoizTick,
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
  /** When true, fetch indexer PoW policy and require mining before public mints. */
  requireMintPow?: boolean;
  /** Prefill ÐA (`block:tx`) for mint/transfer. */
  initialAssetId?: string;
  /** On-chain deployer address — skips PoW during treasury phase only. */
  tokenDeployerAddress?: string;
  deployerMinted?: string;
  deployerMintCap?: string | null;
  publicMintOpen?: boolean;
  className?: string;
}

const DEFAULT_OPS: TreatsUiOp[] = ['deploy', 'mint'];

/** Tokenomics chips — never fill ticker (collisions are a different ÐA). */
const ECON_PRESETS = [
  {
    id: 'trench',
    label: 'Open mint',
    hint: '1B · public',
    max: '1000000000',
    premine: '',
    deployerWindow: '',
    lim: '',
    decimals: '0',
  },
  {
    id: 'treasury',
    label: 'Treasury scarce',
    hint: '6.9M-style · your ticker',
    max: '6904200',
    premine: '345210',
    deployerWindow: '2100000',
    lim: '',
    decimals: '',
  },
  {
    id: 'fair',
    label: 'Fair lim',
    hint: '21M · per-tx cap',
    max: '21000000',
    premine: '',
    deployerWindow: '',
    lim: '1000',
    decimals: '0',
  },
] as const;

export function TreatsMintPanel({
  initialOp = 'mint',
  initialTick = '',
  lockTick = false,
  ops = DEFAULT_OPS,
  compact = false,
  requireMintPow = false,
  initialAssetId = '',
  tokenDeployerAddress,
  deployerMinted,
  deployerMintCap,
  publicMintOpen = false,
  className = '',
}: TreatsMintPanelProps) {
  const wallet = useUnifiedWallet();
  const browser = useBrowserWallet();
  const address = wallet.address ?? '';

  const firstOp = ops.includes(initialOp) ? initialOp : ops[0] ?? 'mint';
  const [op, setOp] = useState<TreatsUiOp>(firstOp);
  const [tick, setTick] = useState(initialTick);
  const lockEconomics = lockTick && isNoizTick(initialTick);
  const [max, setMax] = useState(lockEconomics ? NOIZ_FLAGSHIP.max : '1000000000');
  /** Empty = omit wire key `l`. */
  const [lim, setLim] = useState('');
  const [premine, setPremine] = useState(lockEconomics ? NOIZ_FLAGSHIP.premine : '');
  const [deployerWindow, setDeployerWindow] = useState(lockEconomics ? NOIZ_FLAGSHIP.deployerWindow : '');
  /** Empty = omit `dec` (on-chain default 0). */
  const [decimals, setDecimals] = useState(lockEconomics ? '' : '0');
  const [amt, setAmt] = useState('1');
  const [assetId, setAssetId] = useState(initialAssetId);
  const [transferTo, setTransferTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [mining, setMining] = useState(false);
  const [mineProgress, setMineProgress] = useState<string | null>(null);
  const [powConfig, setPowConfig] = useState<Awaited<ReturnType<typeof fetchTreatsPowConfig>>>(null);
  const [powSolution, setPowSolution] = useState<{
    challengeId: string;
    nonce: string;
    difficulty: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);
  const [confirmPermanent, setConfirmPermanent] = useState(false);
  const receiptKey =
    address && tick.trim()
      ? `treats:${op}:${tick.trim().toUpperCase()}:${address}`
      : null;
  const { receipt, remember } = useBroadcastReceipt(receiptKey);
  const shownTxid = txid || receipt?.txid || null;

  useEffect(() => {
    if (initialAssetId) setAssetId(initialAssetId);
  }, [initialAssetId]);

  useEffect(() => {
    if (!requireMintPow) return;
    void fetchTreatsPowConfig().then(setPowConfig);
  }, [requireMintPow]);

  const isTreasuryDeployer = useMemo(() => {
    if (!address || !tokenDeployerAddress) return false;
    return address.trim() === tokenDeployerAddress.trim();
  }, [address, tokenDeployerAddress]);

  const treasuryPhaseActive =
    isTreasuryDeployer && !publicMintOpen && op === 'mint';

  const powDifficulty = useMemo(() => {
    if (treasuryPhaseActive) return null;
    if (!requireMintPow || op !== 'mint') return null;
    return tickRequiresPow(tick, powConfig);
  }, [requireMintPow, op, tick, powConfig, treasuryPhaseActive]);

  const remainingAfterPremine = useMemo(
    () => treatsPostPremineRemaining(max, premine.trim() || undefined),
    [max, premine],
  );

  const json = useMemo(() => {
    if (op === 'deploy') {
      return buildTreatsDeployJson(tick, max, {
        lim: lim.trim() ? lim : undefined,
        premine: premine.trim() ? premine : undefined,
        deployerWindow: deployerWindow.trim() ? deployerWindow : undefined,
        decimals: decimals.trim() !== '' ? decimals : undefined,
      });
    }
    if (op === 'mint') {
      return buildTreatsMintJson(tick, amt, assetId);
    }
    return buildTreatsTransferJson(tick, amt, assetId);
  }, [op, tick, max, lim, premine, deployerWindow, decimals, amt, assetId]);

  const isValid =
    Boolean(json) &&
    tick.trim().length > 0 &&
    (op === 'deploy' || assetId.trim().length > 0) &&
    (op !== 'transfer' || transferTo.trim().length > 4);

  const dustRecipient =
    op === 'transfer' ? transferTo.trim() : address;

  const reset = useCallback(() => {
    setError(null);
    setTxid(null);
    setPowSolution(null);
    setMineProgress(null);
  }, []);

  const handleMine = useCallback(async () => {
    if (!address || !powDifficulty) return;
    setMining(true);
    setError(null);
    setPowSolution(null);
    setMineProgress('Requesting challenge…');
    try {
      const ch = await fetchTreatsPowChallenge(tick, amt, address);
      if (ch.powRequired === false || !ch.preimage || !ch.challengeId || !ch.difficulty) {
        setMineProgress(null);
        setMining(false);
        return;
      }
      const est = estimatePowSeconds(ch.difficulty);
      setMineProgress(`Mining… ~${est}s on typical hardware`);
      const nonce = await mineTreatsPow({
        preimage: ch.preimage,
        difficulty: ch.difficulty,
        onProgress: (p) => {
          setMineProgress(
            `Mining… ${p.attempts.toLocaleString()} hashes (${p.hashesPerSec.toLocaleString()}/s)`,
          );
        },
      });
      setPowSolution({
        challengeId: ch.challengeId,
        nonce,
        difficulty: ch.difficulty,
      });
      setMineProgress(`PoW solved — nonce ${nonce}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PoW mining failed');
      setMineProgress(null);
    } finally {
      setMining(false);
    }
  }, [address, powDifficulty, tick, amt]);

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
    if (op === 'mint' && powDifficulty && !powSolution) {
      setError('Complete the mint Proof-of-Work first (anti-bot).');
      return;
    }

    setBusy(true);
    setError(null);
    setTxid(null);
    try {
      if (op === 'deploy' && lockEconomics && !confirmPermanent) {
        setError('Confirm that this $NOIZ JSON is permanent before broadcasting.');
        setBusy(false);
        return;
      }
      if (!json) {
        setError('Fix form fields before broadcasting.');
        setBusy(false);
        return;
      }
      const id = await signAndBroadcastTreats({
        op: op as TreatsOpKind,
        tick,
        fromAddress: address,
        privateKeyWIF: browser.wallet.privateKey,
        recipientAddress: dustRecipient,
        payloadJson: json,
        max: op === 'deploy' ? max : undefined,
        lim: op === 'deploy' && lim.trim() ? lim : undefined,
        premine: op === 'deploy' && premine.trim() ? premine : undefined,
        deployerWindow: op === 'deploy' && deployerWindow.trim() ? deployerWindow : undefined,
        decimals: op === 'deploy' && decimals.trim() ? decimals : undefined,
        amt: op === 'mint' || op === 'transfer' ? amt : undefined,
        assetId: op !== 'deploy' ? assetId.trim() : undefined,
      });
      setTxid(id);
      remember({ txid: id, label: `${op} ${tick.trim().toUpperCase()}` });
      upsertWalletTxJournalEntry({
        txid: id,
        address,
        protocol: 'treats',
        action: `treats-${op}`,
        title: `ÐogeTreats ${op}: ${tick.trim().toUpperCase()}`,
        status: 'broadcasted',
      });
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
            OP_RETURN fungibles with wire <code className="text-zinc-200">p:&quot;dt&quot;</code>.
            Tickers collide; the token is the ÐA (<code className="text-zinc-200">block:tx</code>).
            Pair d/m/t with ≥0.01&nbsp;DOGE dust. Atomic balances — no inscription two-step.
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

      {op === 'mint' && tokenDeployerAddress && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          {treasuryPhaseActive ? (
            <>
              <strong>Treasury phase</strong> — deployer wallet mints without PoW until cap{' '}
              {deployerMintCap ?? '?'} ({deployerMinted ?? '0'} minted so far).
            </>
          ) : publicMintOpen ? (
            <>
              <strong>Public PoW mint is open.</strong>{' '}
              {isTreasuryDeployer
                ? 'Deployer cap reached — use PoW like everyone else or earn via doge.cam bagwork.'
                : 'Complete PoW below to mint fairly (anti-bot).'}
            </>
          ) : null}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-5">
          {!lockTick && (
            <>
              <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500">Ticker (1–8)</label>
              <input
                value={tick}
                onChange={(e) => {
                  setTick(e.target.value.toUpperCase().slice(0, 8));
                  reset();
                }}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono uppercase text-white"
                maxLength={8}
                placeholder="YOURTICK"
              />
            </>
          )}

          {lockTick && tick && (
            <p className="text-sm text-zinc-400">
              Ticker: <span className="font-mono font-bold text-[#FCD34D]">{tick.toUpperCase()}</span>
              {lockEconomics ? (
                <span className="ml-2 font-mono text-xs text-zinc-500">ÐA {NOIZ_FLAGSHIP.assetId}</span>
              ) : null}
            </p>
          )}

          {!lockEconomics && isNoizTick(tick) && op === 'deploy' ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
              $NOIZ already exists as ÐA <span className="font-mono">{NOIZ_FLAGSHIP.assetId}</span>. A new deploy
              with the same sticker is a <strong>different</strong> asset (like a Solana CA clone). Pick your own
              ticker unless you mean to compete on a copy.
            </p>
          ) : null}

          {op !== 'deploy' && (
            <>
              <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500">
                ÐA (deploy block:tx)
              </label>
              <input
                value={assetId}
                onChange={(e) => {
                  setAssetId(e.target.value.trim());
                  reset();
                }}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-white"
                placeholder="6142100:12"
              />
            </>
          )}

          {lockEconomics && op === 'deploy' ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
              <p className="font-semibold">$NOIZ flagship — economics locked</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-100/80">
                6,904,200 max · 345,210 premine (5%) to this wallet · deployer-only mint for ~4 years (
                {NOIZ_FLAGSHIP.deployerWindow} blocks). Remaining supply is treasury-dripped for doge.cam /
                dogecoin.games / Come Home — not a public free-mint. This JSON is permanent.
              </p>
            </div>
          ) : op === 'deploy' ? (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">
                Tickers are 1–8 alphanumeric (not 4). They collide on purpose — identity is the ÐA (
                <code className="text-zinc-300">block:tx</code>), like a Solana CA. Presets never fill a ticker.
              </p>
              <div className="flex flex-wrap gap-2">
                {ECON_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setMax(p.max);
                      setPremine(p.premine);
                      setDeployerWindow(p.deployerWindow);
                      setLim(p.lim);
                      setDecimals(p.decimals);
                      reset();
                    }}
                    className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-left hover:border-[#FCD34D]/40"
                  >
                    <span className="block text-xs font-semibold text-zinc-200">{p.label}</span>
                    <span className="block text-[10px] text-zinc-500">{p.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {op === 'deploy' && (
            <>
              <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500">
                Max supply (base units)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={max}
                readOnly={lockEconomics}
                onChange={(e) => {
                  if (lockEconomics) return;
                  setMax(e.target.value);
                  reset();
                }}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-white read-only:opacity-70"
              />
              <label className="block text-xs font-medium uppercase tracking-wider text-amber-500/90">
                Premine (optional) — credits your dust address now
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={premine}
                readOnly={lockEconomics}
                onChange={(e) => {
                  if (lockEconomics) return;
                  setPremine(e.target.value);
                  reset();
                }}
                placeholder="e.g. 5% of max for LP seed"
                className="w-full rounded-xl border border-amber-500/30 bg-zinc-900 px-3 py-2 font-mono text-white placeholder:text-zinc-600 read-only:opacity-70"
              />
              <p className="text-[11px] text-zinc-500">
                Treats v1.0: treasury gets <code className="text-zinc-400">pm</code> on the paired output (you below).
                {remainingAfterPremine != null ? (
                  <>
                    {' '}
                    Remaining unminted:{' '}
                    <span className="font-mono text-zinc-300">{remainingAfterPremine}</span>
                    {lockEconomics ? ' (treasury drips, not public mint)' : ''}
                  </>
                ) : premine.trim() ? (
                  <span className="text-red-400"> · premine must be ≤ max</span>
                ) : null}
              </p>
              <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500">
                Mint limit per tx (optional)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={lim}
                readOnly={lockEconomics}
                onChange={(e) => {
                  if (lockEconomics) return;
                  setLim(e.target.value);
                  reset();
                }}
                placeholder={lockEconomics ? 'omitted — treasury gated' : 'omit for open mint size'}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-white placeholder:text-zinc-600 read-only:opacity-70"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Deployer window (blocks)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={deployerWindow}
                    readOnly={lockEconomics}
                    onChange={(e) => {
                      if (lockEconomics) return;
                      setDeployerWindow(e.target.value);
                      reset();
                    }}
                    placeholder="empty = public mint immediately"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-white placeholder:text-zinc-600 read-only:opacity-70"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Decimals
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={decimals}
                    readOnly={lockEconomics}
                    onChange={(e) => {
                      if (lockEconomics) return;
                      setDecimals(e.target.value);
                      reset();
                    }}
                    placeholder="0"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-white read-only:opacity-70"
                  />
                </div>
              </div>
              <p className="text-[11px] text-zinc-500">
                `dw` = only deployer may mint for N blocks. Omit `dec` for default 0. Stay under ~76 JSON bytes for
                OP_RETURN.
              </p>
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

          {op === 'mint' && powDifficulty && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-200">
                Mint Proof-of-Work (difficulty {powDifficulty})
              </p>
              <p className="text-xs text-zinc-400">
                Public mints require browser mining — raises bot cost. Deployer/treasury wallets mint without PoW.
                Typical wait ~{estimatePowSeconds(powDifficulty)}s.
              </p>
              {mineProgress && <p className="text-xs font-mono text-amber-100">{mineProgress}</p>}
              {powSolution && (
                <p className="text-xs text-emerald-300">
                  Ready — challenge {powSolution.challengeId.slice(0, 8)}… nonce {powSolution.nonce}
                </p>
              )}
              <button
                type="button"
                disabled={!address || mining || busy}
                onClick={() => void handleMine()}
                className="w-full rounded-lg border border-amber-500/40 px-3 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/10 disabled:opacity-50"
              >
                {mining ? 'Mining…' : powSolution ? 'Re-mine (new challenge)' : 'Mine to unlock mint'}
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>
          )}

          {shownTxid && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              Broadcast:{' '}
              <DogeTxLink
                txid={shownTxid}
                className="font-mono underline decoration-emerald-400/60 hover:decoration-emerald-200"
              />
            </div>
          )}

          {op === 'deploy' && lockEconomics ? (
            <label className="flex items-start gap-2 text-xs text-amber-100">
              <input
                type="checkbox"
                checked={confirmPermanent}
                onChange={(e) => setConfirmPermanent(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I understand this $NOIZ deploy JSON is permanent on Dogecoin L1 and matches the flagship spec
                (6,904,200 / 5% premine / deployer window).
              </span>
            </label>
          ) : null}

          <button
            type="button"
            disabled={
              !isValid ||
              !address ||
              busy ||
              mining ||
              (op === 'mint' && Boolean(powDifficulty) && !powSolution) ||
              (op === 'deploy' && lockEconomics && !confirmPermanent)
            }
            onClick={() => void handleBroadcast()}
            className="w-full rounded-xl bg-[#FCD34D] px-4 py-3 text-sm font-bold text-black transition hover:bg-[#fde68a] disabled:opacity-50"
          >
            {busy ? 'Signing & broadcasting…' : `Broadcast ${op}`}
          </button>
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Compact treat JSON{json ? ` · ${json.length} chars` : ''}
          </p>
          <pre className="overflow-x-auto rounded-xl bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200">
            {json ?? '—'}
          </pre>
          <p className="mt-2 text-[11px] text-zinc-500">
            This exact string is the OP_RETURN. Pretty-print is not broadcast.
          </p>
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
