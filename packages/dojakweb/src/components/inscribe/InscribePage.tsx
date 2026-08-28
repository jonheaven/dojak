import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { ArrowPathIcon, CheckCircleIcon, DocumentArrowUpIcon, RadioIcon } from '@heroicons/react/24/outline';
import { useUnifiedWallet } from '../../contexts/UnifiedWalletContext';
import { useBrowserWallet } from '../../contexts/BrowserWalletContext';
import { useDataProvider } from '../../providers/DataProvider';
import { toast } from 'sonner';
import { getFeeEstimate } from '../../utils/txBroadcaster';
import {
  dogeTxExplorerUrl,
  dogeTxExplorerDisplayName,
  loadDogeTxExplorerPreference,
  DOGENALS_EXPLORER_ORIGIN,
} from '../../utils/dogeTxExplorer';
import {
  signDoginalInscriptionChain,
  countDoginalTransactionsForContent,
  DOGINAL_MAX_CONTENT_TYPE_LEN,
  outpointsFromRawTxHex,
  bumpSignedDoginalStageFee,
  resignDoginalChainTailAfterBumpedStage,
  rawDoginalTxSupportsRbf,
  type DoginalChainResult,
  type DoginalChainStage,
} from '../../lib/dogetag/doginal-chain';
import {
  isTxStalled,
  fetchMempoolReplaceability,
  rpcBumpFee,
  rpcGetRawTransactionHex,
} from '../../lib/dogetag/inscriptionStall';
import {
  broadcastTxWithStatus,
  pollTxForConfirmation,
  getBestDogeTxConfirmations,
  getConfirmationPollIntervalMs,
  invalidateDogeTxConfirmationsCache,
  isDogeTxVisibleOnExplorers,
  type BroadcastAttemptUpdate,
} from '../../lib/broadcast/doge-chain-broadcast';
import { BroadcastRelayAttempts } from '../chain/BroadcastRelayAttempts';
import { TxConfirmationPollProgress } from '../chain/TxConfirmationPollProgress';
import { parseDogecoinReceiveAddress } from '../../lib/dogetag/dogecoinAddress';
import {
  loadInscribeArchive,
  mydogeInscriptionApiUrl,
  pollMydogeUntilIndexed,
  upsertInscribeArchiveEntry,
  verifyLocalAgainstMydogeIndex,
  type InscribeArchiveEntry,
  type MydogeInscriptionMeta,
} from '../../lib/dogetag/mydogeInscriptionVerify';
import { DogeCurrencyIcon } from '../DogeCurrencyIcon';
import { ConfirmationReadSourcesBar } from '../chain/ConfirmationReadSourcesBar';
import { extractProtectedOutpoints } from '../../lib/dogetag/protectedOutpoints';
import { ServerInscribeJobPanel } from './ServerInscribeJobPanel';
import { cn } from '@/lib/utils';
import { ConfirmBanner } from '../ui/ConfirmBanner';
import { RecursiveHtmlBuilder } from './RecursiveHtmlBuilder';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  getInscriptionMarker,
  INSCRIPTION_CONFIG_CHANGED_EVENT,
  type InscriptionMarker,
} from '../../utils/inscription-settings';

const MAX_BROADCAST_STAGES = 80;
/** Typical Core mempool ancestor/descendant chain limit (~25). We allow more with warnings because most nodes tolerate 40-60. */
const MEMPOOL_ANCESTOR_CHAIN_HINT = 25;
/** Mempool-fast: wait until Blockchair / RPC can see the parent before unlocking the child (still no block conf). */
const MEMPOOL_FAST_PARENT_VISIBLE_POLL_MS = 900;
const MEMPOOL_FAST_PARENT_VISIBLE_MAX_WAIT_MS = 90_000;
const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB - plenty for 56KB images, small 3D models, etc.
const PERSIST_VERSION = 2;
const USED_INSCRIPTION_DEST_KEY = 'dojakweb:inscription-dest-used-v1';

/** Parallelism cap so Blockchair / RPC reads do not stampede when many stages exist. */
const CHAIN_PROBE_CONCURRENCY = 6;

type StageChainProbeRow = { conf: number; visible: boolean };

async function probeSignedStagesOnChain(
  stages: Pick<DoginalChainStage, 'txid'>[],
): Promise<StageChainProbeRow[]> {
  if (!stages.length) return [];
  invalidateDogeTxConfirmationsCache(stages.map((s) => s.txid));
  const n = stages.length;
  const rows: StageChainProbeRow[] = new Array(n);
  for (let base = 0; base < n; base += CHAIN_PROBE_CONCURRENCY) {
    const end = Math.min(base + CHAIN_PROBE_CONCURRENCY, n);
    const chunk = await Promise.all(
      Array.from({ length: end - base }, async (_, k) => {
        const i = base + k;
        const txid = stages[i]!.txid;
        const [conf, explorerVis] = await Promise.all([
          getBestDogeTxConfirmations(txid),
          isDogeTxVisibleOnExplorers(txid),
        ]);
        return { i, conf, visible: explorerVis || conf >= 1 };
      }),
    );
    for (const row of chunk) {
      rows[row.i] = { conf: row.conf, visible: row.visible };
    }
  }
  return rows;
}

/** Longest prefix where each stage satisfies visibility (mempool-fast) or 1+ conf (wait mode). */
function chainReadyPrefixFromProbeRows(rows: StageChainProbeRow[], waitConfirms: boolean): boolean[] {
  const n = rows.length;
  const out = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    const ok = waitConfirms ? rows[i]!.conf >= 1 : rows[i]!.visible;
    if (!ok) break;
    out[i] = true;
  }
  return out;
}

function loadUsedInscriptionDestinations(): Set<string> {
  try {
    const raw = localStorage.getItem(USED_INSCRIPTION_DEST_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.map((x: unknown) => String(x).trim()).filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

function markInscriptionDestinationUsed(addr: string) {
  const t = addr.trim();
  if (!t) return;
  const s = loadUsedInscriptionDestinations();
  s.add(t);
  localStorage.setItem(USED_INSCRIPTION_DEST_KEY, JSON.stringify([...s]));
}

function persistKey(walletAddress: string): string {
  return `dojakweb-file-inscribe-v${PERSIST_VERSION}-${walletAddress}`;
}

function recommendedFeeRateForChain(baseFeeRateKoinuPerKb: number, stageCount: number): number {
  // Long unconfirmed ancestor chains need stronger fees to avoid mempool eviction / miner deprioritization.
  if (stageCount >= 30) return Math.ceil(baseFeeRateKoinuPerKb * 1.75);
  if (stageCount >= 20) return Math.ceil(baseFeeRateKoinuPerKb * 1.5);
  if (stageCount >= 10) return Math.ceil(baseFeeRateKoinuPerKb * 1.25);
  return Math.ceil(baseFeeRateKoinuPerKb);
}

function isBroadcastInputRejected(msg: string): boolean {
  const lc = msg.toLowerCase();
  return (
    lc.includes('already been spent') ||
    lc.includes('missing inputs') ||
    lc.includes('bad-txns-inputs-missingorspent') ||
    lc.includes('missingorspent')
  );
}

function isMempoolChainLimitError(msg: string): boolean {
  const lc = msg.toLowerCase();
  return lc.includes('too-long-mempool-chain') || lc.includes('mempool chain');
}

function guessContentType(file: File): string {
  if (file.type && file.type.length > 0) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.html')) return 'text/html;charset=utf-8';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.txt')) return 'text/plain;charset=utf-8';
  return 'application/octet-stream';
}

/** Public explorer links — prefer Wallet Settings (Ðexplorer default); keep others open. */
function preferredPublicTxPageUrl(txid: string): string {
  return dogeTxExplorerUrl(txid);
}

function dogechainPublicTxUrl(txid: string): string {
  return `https://dogechain.info/tx/${txid}`;
}

function blockchairPublicTxUrl(txid: string): string {
  return `https://blockchair.com/dogecoin/transaction/${txid}`;
}

function sochainPublicTxPageUrl(txid: string): string {
  return `https://sochain.com/tx/DOGE/${txid}`;
}

function dogenalsPublicTxUrl(txid: string): string {
  return `${DOGENALS_EXPLORER_ORIGIN}/tx/${txid.trim()}`;
}

export const InscribePage: React.FC = () => {
  const { connected, address, walletType } = useUnifiedWallet();
  const browser = useBrowserWallet();
  const { inscriptions } = useDataProvider();

  const [activeTab, setActiveTab] = useState<'file' | 'recursive'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [contentBuffer, setContentBuffer] = useState<Buffer | null>(null);
  const [contentType, setContentType] = useState('');
  const [feeRate, setFeeRate] = useState(1_000_000);
  /** Empty = use connected wallet address (self-custody inscription). */
  const [inscriptionRecipientInput, setInscriptionRecipientInput] = useState('');
  const [usedDestinations, setUsedDestinations] = useState<Set<string>>(() => loadUsedInscriptionDestinations());
  const [plan, setPlan] = useState<DoginalChainResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [stageAttempts, setStageAttempts] = useState<Record<number, BroadcastAttemptUpdate[]>>({});
  /** false = doginals.js-style: next tx unlocks after parent is accepted by relay (mempool parent OK). true = wait 1 conf each step. */
  const [waitConfirms, setWaitConfirms] = useState(false);
  /** After first successful sign, block re-sign unless user explicitly unlocks (only allowed before any broadcast). */
  const [allowResignChain, setAllowResignChain] = useState(false);
  const [pendingResignConfirm, setPendingResignConfirm] = useState(false);
  /** Stage index + fee estimate pending inline bump-fee confirmation. */
  const [bumpFeeConfirm, setBumpFeeConfirm] = useState<{ stage: number; est: number } | null>(null);
  const [stickySpendRejectOutpoints, setStickySpendRejectOutpoints] = useState<string[]>([]);
  /** Stage i has been accepted by a relay (success / already_exists). */
  const [stageBroadcasted, setStageBroadcasted] = useState<boolean[]>([]);
  /** Stage i’s output is safe to spend in i+1 (1+ conf if waitConfirms, else after delay). */
  const [stageChainReady, setStageChainReady] = useState<boolean[]>([]);
  const [liveConfirms, setLiveConfirms] = useState<Record<number, number>>({});
  const [refreshingChain, setRefreshingChain] = useState(false);
  /** RPC-derived stall hint per stage (broadcast, awaiting conf, possibly stuck). */
  const [stallByStage, setStallByStage] = useState<
    Record<number, { stalled: boolean; reason?: string; replaceableHint?: boolean }>
  >({});
  const [lastChainRefreshAt, setLastChainRefreshAt] = useState<number | null>(null);
  /** Stage index currently inside `pollTxForConfirmation` (wait-1-conf mode). */
  const [confirmPollStage, setConfirmPollStage] = useState<number | null>(null);
  /** Wall-clock time when the next explorer poll runs; drives “next check in …s”. */
  const [confPollWaitByStage, setConfPollWaitByStage] = useState<
    Record<number, { until: number; intervalMs: number } | undefined>
  >({});
  const [confPollTick, setConfPollTick] = useState(0);

  const pollAbortRef = React.useRef<AbortController | null>(null);
  const stallAbortRef = React.useRef<AbortController | null>(null);
  const restoredRef = React.useRef(false);
  /** After confirmation polling throws (e.g. timeout), skip auto-resume until user hits “Refresh chain status”. */
  const suppressConfirmPollResumeRef = React.useRef(false);
  /** Avoid duplicate MyDoge poll + verify for the same inscription in one session. */
  const indexerCompletedIdsRef = React.useRef<Set<string>>(new Set());
  const indexerPollAbortRef = React.useRef<AbortController | null>(null);
  const indexerPollJobRef = React.useRef<{ inscriptionId: string; running: boolean } | null>(null);
  const prevIndexerInscriptionIdRef = React.useRef<string | null>(null);

  type IndexerUiPhase =
    | 'idle'
    | 'awaiting_confirmation'
    | 'polling'
    | 'verifying'
    | 'verified'
    | 'mismatch'
    | 'error';

  const [indexerPhase, setIndexerPhase] = React.useState<IndexerUiPhase>('idle');
  const [indexerDetail, setIndexerDetail] = React.useState('');
  const [indexerMeta, setIndexerMeta] = React.useState<MydogeInscriptionMeta | null>(null);
  const [indexerSha256, setIndexerSha256] = React.useState<string | null>(null);
  const [indexerManualRetry, setIndexerManualRetry] = React.useState(0);
  const [inscribeArchive, setInscribeArchive] = React.useState<InscribeArchiveEntry[]>([]);
  const [inscriptionMarker, setInscriptionMarker] = React.useState<InscriptionMarker>(() => getInscriptionMarker());

  React.useEffect(() => {
    const onMarker = () => setInscriptionMarker(getInscriptionMarker());
    window.addEventListener(INSCRIPTION_CONFIG_CHANGED_EVENT, onMarker);
    return () => window.removeEventListener(INSCRIPTION_CONFIG_CHANGED_EVENT, onMarker);
  }, []);

  React.useEffect(() => {
    return () => {
      indexerPollAbortRef.current?.abort();
    };
  }, []);

  React.useEffect(() => {
    const active =
      confirmPollStage !== null ||
      Object.values(confPollWaitByStage).some((v) => v && v.until > Date.now());
    if (!active) return;
    const id = window.setInterval(() => setConfPollTick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [confirmPollStage, confPollWaitByStage]);

  React.useEffect(() => {
    if (!address) {
      setInscribeArchive([]);
      return;
    }
    setInscribeArchive(loadInscribeArchive(address));
  }, [address]);

  React.useEffect(() => {
    if (!plan || !address) {
      indexerPollAbortRef.current?.abort();
      indexerPollJobRef.current = null;
      prevIndexerInscriptionIdRef.current = null;
      setIndexerPhase('idle');
      setIndexerDetail('');
      setIndexerMeta(null);
      setIndexerSha256(null);
      return;
    }

    const revealIdx = plan.stages.length - 1;
    if (revealIdx < 0 || plan.stages[revealIdx]?.kind !== 'reveal') return;

    const inscriptionId = plan.inscriptionId;
    if (prevIndexerInscriptionIdRef.current !== inscriptionId) {
      indexerPollAbortRef.current?.abort();
      indexerPollJobRef.current = null;
      prevIndexerInscriptionIdRef.current = inscriptionId;
    }

    const broadcast = !!stageBroadcasted[revealIdx];
    const confs = liveConfirms[revealIdx] ?? 0;

    if (!broadcast) {
      indexerPollJobRef.current = null;
      setIndexerPhase('idle');
      setIndexerDetail('');
      return;
    }

    if (confs < 1) {
      setIndexerPhase('awaiting_confirmation');
      setIndexerDetail(
        'Waiting for at least one chain confirmation on the reveal transaction, then we poll the MyDoge indexer.',
      );
      return;
    }

    if (!contentBuffer) {
      setIndexerPhase('error');
      setIndexerDetail(
        'Verification needs the original file bytes in memory. Restore a saved session from this wallet, or select the same file again.',
      );
      return;
    }

    if (indexerCompletedIdsRef.current.has(inscriptionId)) {
      setIndexerPhase('verified');
      return;
    }

    if (indexerPollJobRef.current?.inscriptionId !== inscriptionId) {
      indexerPollAbortRef.current?.abort();
      indexerPollJobRef.current = { inscriptionId, running: false };
    }

    const job = indexerPollJobRef.current;
    if (!job || job.running) return;
    job.running = true;

    const ac = new AbortController();
    indexerPollAbortRef.current = ac;

    setIndexerPhase('polling');
    setIndexerDetail('Polling api.mydoge.com for inscription metadata…');

    void (async () => {
      try {
        const meta = await pollMydogeUntilIndexed(inscriptionId, {
          signal: ac.signal,
          onAttempt: (attempt, _m, note) => {
            if (!ac.signal.aborted) {
              setIndexerDetail(
                note
                  ? `MyDoge indexer · attempt ${attempt}: ${note}`
                  : `MyDoge indexer · attempt ${attempt}…`,
              );
            }
          },
        });
        if (ac.signal.aborted) return;
        setIndexerMeta(meta);
        setIndexerPhase('verifying');
        setIndexerDetail('Downloading indexed content from CDN and comparing to your local file…');
        const v = await verifyLocalAgainstMydogeIndex(contentBuffer, meta, ac.signal);
        if (ac.signal.aborted) return;
        if (v.ok) {
          indexerCompletedIdsRef.current.add(inscriptionId);
          setIndexerSha256(v.sha256Hex);
          setIndexerPhase('verified');
          setIndexerDetail(
            `Byte-for-byte match (${v.remoteLength.toLocaleString()} bytes). SHA-256: ${v.sha256Hex}`,
          );
          upsertInscribeArchiveEntry(address, {
            inscriptionId,
            walletAddress: address,
            fileName: file?.name ?? 'inscription',
            contentType: plan.contentType,
            sha256Hex: v.sha256Hex,
            contentLength: contentBuffer.length,
            mydogeApiUrl: mydogeInscriptionApiUrl(inscriptionId),
            cdnContentUrl: meta.content,
            genesisTransaction: meta.genesisTransaction,
            verifiedAt: Date.now(),
          });
          setInscribeArchive(loadInscribeArchive(address));
          toast.success('Indexer verified: CDN content matches your inscribed file.');
        } else {
          setIndexerPhase('mismatch');
          setIndexerDetail(v.reason);
          toast.error('Indexed content did not match your local file.');
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setIndexerPhase('error');
        setIndexerDetail(e instanceof Error ? e.message : String(e));
      } finally {
        if (indexerPollJobRef.current?.inscriptionId === inscriptionId) {
          indexerPollJobRef.current.running = false;
        }
      }
    })();
  }, [
    plan,
    address,
    contentBuffer,
    stageBroadcasted,
    liveConfirms,
    file?.name,
    indexerManualRetry,
  ]);

  const retryIndexerCheck = React.useCallback(() => {
    if (!plan) return;
    indexerCompletedIdsRef.current.delete(plan.inscriptionId);
    indexerPollAbortRef.current?.abort();
    indexerPollJobRef.current = { inscriptionId: plan.inscriptionId, running: false };
    setIndexerMeta(null);
    setIndexerSha256(null);
    setIndexerManualRetry((n) => n + 1);
  }, [plan]);

  React.useEffect(() => {
    restoredRef.current = false;
  }, [address]);

  React.useEffect(() => {
    setUsedDestinations(loadUsedInscriptionDestinations());
  }, [address]);

  const recipientResolution = React.useMemo(() => {
    if (!address) return { ok: false as const, message: 'Connect a wallet.' };
    const draft = inscriptionRecipientInput.trim();
    if (!draft) {
      return { ok: true as const, effective: address, isCustom: false as const };
    }
    try {
      const { display } = parseDogecoinReceiveAddress(draft);
      return { ok: true as const, effective: display, isCustom: true as const };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid Dogecoin address.';
      return { ok: false as const, message: msg };
    }
  }, [inscriptionRecipientInput, address]);

  const savePersistedSession = useCallback(() => {
    if (!address || !plan || !contentBuffer) return;
    const n = plan.stages.length;
    if (stageBroadcasted.length !== n || stageChainReady.length !== n) return;
    try {
      const payload = {
        v: PERSIST_VERSION,
        address,
        fileName: file?.name ?? 'inscription.bin',
        contentB64: Buffer.from(contentBuffer).toString('base64'),
        contentType,
        feeRate,
        waitConfirms,
        stickySpendRejectOutpoints,
        inscriptionRecipientDraft: inscriptionRecipientInput,
        plan,
        stageBroadcasted,
        stageChainReady,
        liveConfirms,
        stageAttempts,
        stallByStage,
        savedAt: Date.now(),
      };
      localStorage.setItem(persistKey(address), JSON.stringify(payload));
    } catch (e) {
      console.warn('[inscribe] persist failed', e);
    }
  }, [
    address,
    plan,
    contentBuffer,
    file?.name,
    contentType,
    feeRate,
    waitConfirms,
    stickySpendRejectOutpoints,
    inscriptionRecipientInput,
    stageBroadcasted,
    stageChainReady,
    liveConfirms,
    stageAttempts,
    stallByStage,
  ]);

  const refreshFeeFromNode = useCallback(async () => {
    try {
      const r = await getFeeEstimate(2);
      setFeeRate(r);
      toast.success(`Fee rate ${r.toLocaleString()} koinu/kB`);
    } catch {
      toast.error('Could not load fee — check Command.dog reachability or RPC in Wallet Settings.');
    }
  }, [toast]);

  React.useEffect(() => {
    void getFeeEstimate(2)
      .then(setFeeRate)
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    return () => {
      pollAbortRef.current?.abort();
    };
  }, []);

  /** Resume partial inscription after refresh (same address). */
  React.useEffect(() => {
    if (!address || restoredRef.current) return;
    try {
      const raw = localStorage.getItem(persistKey(address));
      if (!raw) return;
      const p = JSON.parse(raw) as {
        v?: number;
        plan?: DoginalChainResult;
        contentB64?: string;
        contentType?: string;
        feeRate?: number;
        waitConfirms?: boolean;
        stickySpendRejectOutpoints?: string[];
        stageBroadcasted?: boolean[];
        stageChainReady?: boolean[];
        liveConfirms?: Record<number, number>;
        stageAttempts?: Record<number, BroadcastAttemptUpdate[]>;
        stallByStage?: Record<number, { stalled: boolean; reason?: string; replaceableHint?: boolean }>;
        fileName?: string;
        inscriptionRecipientDraft?: string;
      };
      if ((p.v !== PERSIST_VERSION && p.v !== 1) || !p.plan?.stages?.length || !p.contentB64) return;
      const restoredPlan: DoginalChainResult = {
        ...p.plan,
        inscriptionReceiveAddress: p.plan.inscriptionReceiveAddress ?? address,
      };
      const n = restoredPlan.stages.length;
      const br =
        Array.isArray(p.stageBroadcasted) && p.stageBroadcasted.length === n
          ? p.stageBroadcasted
          : new Array(n).fill(false);
      const cr =
        Array.isArray(p.stageChainReady) && p.stageChainReady.length === n
          ? p.stageChainReady
          : new Array(n).fill(false);
      const buf = Buffer.from(p.contentB64, 'base64');
      restoredRef.current = true;
      setPlan(restoredPlan);
      setContentBuffer(buf);
      setContentType(p.contentType ?? 'application/octet-stream');
      if (typeof p.feeRate === 'number') setFeeRate(p.feeRate);
      if (typeof p.waitConfirms === 'boolean') setWaitConfirms(p.waitConfirms);
      setStickySpendRejectOutpoints(p.stickySpendRejectOutpoints ?? []);
      setInscriptionRecipientInput(
        p.v === PERSIST_VERSION && typeof p.inscriptionRecipientDraft === 'string'
          ? p.inscriptionRecipientDraft
          : '',
      );
      setStageBroadcasted(br);
      setStageChainReady(cr);
      setLiveConfirms(p.liveConfirms ?? {});
      setStageAttempts(p.stageAttempts ?? {});
      setStallByStage(p.stallByStage ?? {});
      setFile(
        new File([new Uint8Array(buf)], p.fileName ?? 'restored.bin', {
          type: p.contentType ?? 'application/octet-stream',
        }),
      );
      toast.info('Restored saved inscription session. Use “Refresh chain status” if steps look stuck.');
    } catch {
      /* ignore */
    }
  }, [address]);

  React.useEffect(() => {
    savePersistedSession();
  }, [savePersistedSession]);

  /** One-time explorer/RPC probe so confirmations show even before the user clicks “Refresh chain status”. */
  React.useEffect(() => {
    if (!plan?.stages?.length) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const rows = await probeSignedStagesOnChain(plan.stages);
          if (cancelled) return;
          const confUpdates: Record<number, number> = {};
          rows.forEach((r, i) => {
            confUpdates[i] = r.conf;
          });
          setLiveConfirms((prev) => ({ ...prev, ...confUpdates }));
        } catch {
          /* ignore — user can refresh manually */
        }
      })();
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [plan]);

  const clearPersisted = useCallback(() => {
    if (address) localStorage.removeItem(persistKey(address));
  }, [address]);

  const handleRecursiveLoad = useCallback(
    (html: string, filename: string) => {
      clearPersisted();
      restoredRef.current = true;
      const buf = Buffer.from(html, 'utf8');
      const ct = 'text/html;charset=utf-8';
      setFile(new File([new Uint8Array(buf)], filename, { type: ct }));
      setContentBuffer(buf);
      setContentType(ct);
      setInscriptionRecipientInput('');
      setPlan(null);
      setStageAttempts({});
      setStageBroadcasted([]);
      setStageChainReady([]);
      setLiveConfirms({});
      setStickySpendRejectOutpoints([]);
      setAllowResignChain(false);
      setActiveTab('file');
    },
    [clearPersisted],
  );

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const f = accepted[0];
      if (!f) return;
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`File too large (max ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))} MB).`);
        return;
      }
      const buf = Buffer.from(await f.arrayBuffer());
      const ct = guessContentType(f);
      if (Buffer.from(ct, 'utf8').length > DOGINAL_MAX_CONTENT_TYPE_LEN) {
        toast.error(`MIME type too long (max ${DOGINAL_MAX_CONTENT_TYPE_LEN} bytes).`);
        return;
      }
      const txCount = countDoginalTransactionsForContent(buf, ct);
      if (txCount > MAX_BROADCAST_STAGES) {
        toast.error(
          `This file needs ${txCount} transactions (max ${MAX_BROADCAST_STAGES}). ` +
            `A ${Math.round(f.size / 1024)}KB image should usually need 8-20 txs. ` +
            `Try compressing the image or contact us if this persists.`,
        );
        return;
      }
      clearPersisted();
      restoredRef.current = true;
      setFile(f);
      setContentBuffer(buf);
      setContentType(ct);
      setInscriptionRecipientInput('');
      setPlan(null);
      setStageAttempts({});
      setStageBroadcasted([]);
      setStageChainReady([]);
      setLiveConfirms({});
      setStickySpendRejectOutpoints([]);
      setAllowResignChain(false);
      toast.success(`Loaded ${f.name} (${(f.size / 1024).toFixed(1)} KB, ~${txCount} txs)`);
    },
    [toast, clearPersisted],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: busy,
  });

  const upsertAttempt = (stageIndex: number, upd: BroadcastAttemptUpdate) => {
    setStageAttempts((prev) => {
      const list = prev[stageIndex] ?? [];
      const idx = list.findIndex((a) => a.provider === upd.provider);
      const next = idx >= 0 ? [...list.slice(0, idx), upd, ...list.slice(idx + 1)] : [...list, upd];
      return { ...prev, [stageIndex]: next };
    });
  };

  const markChainReadyAfterBroadcastRef = React.useRef<
    (stageIndex: number, txid: string, isLastStage: boolean) => Promise<boolean>
  >(async () => false);

  /**
   * After a stage is relay-accepted, gate the next child on explorer/RPC visibility (mempool-fast)
   * or 1+ conf (optional). Returns false if mempool-fast timed out without visibility — callers must
   * not auto-broadcast the next tx (avoids Blockchair “missing inputs” when the parent is not indexed yet).
   */
  const markChainReadyAfterBroadcast = async (
    stageIndex: number,
    txid: string,
    isLastStage: boolean,
  ): Promise<boolean> => {
    pollAbortRef.current?.abort();
    pollAbortRef.current = new AbortController();
    const signal = pollAbortRef.current.signal;

    const clearConfirmPollUi = () => {
      setConfirmPollStage(null);
      setConfPollWaitByStage((prev) => {
        if (prev[stageIndex] === undefined) return prev;
        const next = { ...prev };
        delete next[stageIndex];
        return next;
      });
    };

    if (!waitConfirms) {
      clearConfirmPollUi();
      // Mempool-fast: still no *block* confirmation, but wait until an indexer (or your RPC) sees this tx so the
      // next child is less likely to hit “orphan / missing parent” on relays that lag behind the one that accepted it.
      const deadline = Date.now() + MEMPOOL_FAST_PARENT_VISIBLE_MAX_WAIT_MS;
      let toldWait = false;
      let sawVisible = false;
      for (;;) {
        if (signal.aborted) return false;
        let visible = false;
        try {
          visible = await isDogeTxVisibleOnExplorers(txid);
        } catch {
          /* transient */
        }
        if (visible) {
          sawVisible = true;
          break;
        }
        if (Date.now() >= deadline) {
          toast.error(
            'Stopped before the next step: the last tx is still not visible on Blockchair/BlockCypher (or the wait hit the time limit). ' +
              'Wait for propagation, use Re-broadcast on that step, then continue — or enable “Wait 1 confirmation per step”. ' +
              'Advancing anyway often causes “missing inputs” on the next relay.',
            { duration: 14_000 },
          );
          return false;
        }
        if (!toldWait) {
          toldWait = true;
          toast.info(
            'Waiting for the last broadcast to show on Blockchair or BlockCypher (usually a few seconds — avoids orphan / missing-input errors on the next step).',
          );
        }
        await new Promise((r) => setTimeout(r, MEMPOOL_FAST_PARENT_VISIBLE_POLL_MS));
      }
      setStageChainReady((prev) => {
        const x = [...prev];
        x[stageIndex] = true;
        return x;
      });
      void getBestDogeTxConfirmations(txid).then((c) => {
        setLiveConfirms((prev) => ({ ...prev, [stageIndex]: c }));
      });
      return true;
    }

    setConfirmPollStage(stageIndex);
    {
      const iv = getConfirmationPollIntervalMs();
      setConfPollWaitByStage((prev) => ({
        ...prev,
        [stageIndex]: { until: Date.now() + iv, intervalMs: iv },
      }));
    }
    try {
      await pollTxForConfirmation(
        txid,
        (c) => {
          setLiveConfirms((prev) => ({ ...prev, [stageIndex]: c }));
        },
        {
          targetConfirmations: 1,
          signal,
          onBeforeSleep: ({ ms }) => {
            setConfPollWaitByStage((prev) => ({
              ...prev,
              [stageIndex]: { until: Date.now() + ms, intervalMs: ms },
            }));
          },
        },
      );
      setStageChainReady((prev) => {
        const x = [...prev];
        x[stageIndex] = true;
        return x;
      });
      if (!isLastStage) toast.info('1+ confirmations seen — you can broadcast the next transaction.');
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return false;
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
      suppressConfirmPollResumeRef.current = true;
      return false;
    } finally {
      clearConfirmPollUi();
    }
  };

  markChainReadyAfterBroadcastRef.current = markChainReadyAfterBroadcast;

  /** Restored sessions (or rare race) can leave “awaiting 1+ conf” without an active poller — resume the same wait loop. */
  React.useEffect(() => {
    if (!plan || !waitConfirms || busy) return;
    if (suppressConfirmPollResumeRef.current) return;
    const blocking = plan.stages.findIndex((_, idx) => stageBroadcasted[idx] && !stageChainReady[idx]);
    if (blocking < 0) return;
    if (confirmPollStage !== null) return;
    const st = plan.stages[blocking];
    if (!st?.txid) return;
    const last = plan.stages.length - 1;
    void markChainReadyAfterBroadcastRef.current(blocking, st.txid, blocking >= last);
  }, [plan, waitConfirms, busy, stageBroadcasted, stageChainReady, confirmPollStage]);

  const buildPlan = async () => {
    if (!contentBuffer || !address) return;
    if (plan && !allowResignChain) {
      toast.error('This file is already signed. Use “Replace signed chain” only if you mean to discard that plan.');
      return;
    }
    if (!recipientResolution.ok) {
      toast.error(recipientResolution.message);
      return;
    }
    if (walletType !== 'browser' || !browser.wallet?.privateKey) {
      toast.error('Unlock your Dojakweb browser wallet to inscribe.');
      return;
    }
    const ct = contentType.trim();
    if (!ct) {
      toast.error('Set a content type (MIME).');
      return;
    }
    if (Buffer.from(ct, 'utf8').length > DOGINAL_MAX_CONTENT_TYPE_LEN) {
      toast.error(`Content type exceeds ${DOGINAL_MAX_CONTENT_TYPE_LEN} bytes.`);
      return;
    }
    setBusy(true);
    setStageAttempts({});
    try {
      const txCount = countDoginalTransactionsForContent(contentBuffer, ct);
      const chainAwareRecommended = recommendedFeeRateForChain(feeRate, txCount);
      const effectiveFeeRate = Math.max(feeRate, chainAwareRecommended);
      if (effectiveFeeRate > feeRate) {
        setFeeRate(effectiveFeeRate);
        toast.info(
          `Raised fee from ${feeRate.toLocaleString()} to ${effectiveFeeRate.toLocaleString()} koinu/kB for a ${txCount}-tx chain.`,
        );
      }
      const result = await signDoginalInscriptionChain({
        content: contentBuffer,
        contentType: ct,
        fromAddress: address,
        privateKeyWIF: browser.wallet.privateKey,
        feeRate: effectiveFeeRate,
        excludedOutpoints: [...extractProtectedOutpoints(inscriptions), ...stickySpendRejectOutpoints],
        inscriptionReceiveAddress:
          recipientResolution.isCustom ? recipientResolution.effective : undefined,
      });
      const n = result.stages.length;
      setPlan(result);
      setStageBroadcasted(new Array(n).fill(false));
      setStageChainReady(new Array(n).fill(false));
      setLiveConfirms({});
      setAllowResignChain(false);
      restoredRef.current = true;
      toast.success(
        `Signed ${result.stages.length} transactions. Broadcast in order — each spends the prior P2SH output. ` +
          (result.stages.length > MEMPOOL_ANCESTOR_CHAIN_HINT - 2
            ? `Long chains (~${MEMPOOL_ANCESTOR_CHAIN_HINT}+ unconfirmed ancestors) may hit mempool limits; use “Auto: broadcast all” with a solid fee.`
            : 'You can send them back-to-back once the parent is in the mempool (no per-step confirmation required).'),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleCommitBroadcastRejected = (commitHex: string) => {
    const outs = outpointsFromRawTxHex(commitHex);
    setStickySpendRejectOutpoints((prev) => [...new Set([...prev, ...outs])]);
    setPlan(null);
    setStageAttempts({});
    setStageBroadcasted([]);
    setStageChainReady([]);
    setAllowResignChain(false);
    clearPersisted();
    toast.error(
      'Commit was rejected (inputs already spent or not visible to the relay). ' +
        'Excluded those inputs for the next sign. Press “Sign inscription chain” again. ' +
        'If this keeps happening, set Dogecoin RPC first in Wallet → Broadcast settings.',
    );
  };

  const canBroadcastStage = (i: number): boolean => {
    if (!plan || busy) return false;
    if (stageBroadcasted[i]) return false;
    if (i === 0) return true;
    return !!stageChainReady[i - 1];
  };

  /** True if this stage was marked broadcasted but the relay flagged propagation as unverified (tx not seen on explorers). */
  const isPropagationUnverified = (i: number): boolean =>
    (stageAttempts[i] ?? []).some((a) => a.propagationUnverified);

  /** Reset a stuck stage so it can be re-broadcast (e.g. relay accepted but tx never propagated). */
  const resetStageBroadcast = (i: number) => {
    setStageBroadcasted((prev) => {
      const x = [...prev];
      x[i] = false;
      return x;
    });
    setStageChainReady((prev) => {
      const x = [...prev];
      x[i] = false;
      return x;
    });
    setStageAttempts((prev) => {
      const next = { ...prev };
      delete next[i];
      return next;
    });
  };

  const broadcastStage = async (stage: DoginalChainStage, stageIndex: number) => {
    if (!canBroadcastStage(stageIndex)) return;
    setBusy(true);
    try {
      await broadcastTxWithStatus(stage.txHex, (u) => upsertAttempt(stageIndex, u));
      toast.success(`Stage ${stageIndex + 1} (${stage.kind}) broadcast`);
      setStageBroadcasted((prev) => {
        const x = [...prev];
        x[stageIndex] = true;
        return x;
      });
      const last = (plan?.stages.length ?? 0) - 1;
      const chainOk = await markChainReadyAfterBroadcast(stageIndex, stage.txid, stageIndex >= last);
      if (!chainOk) return;
      if (plan && stageIndex >= last) {
        markInscriptionDestinationUsed(plan.inscriptionReceiveAddress);
        setUsedDestinations(loadUsedInscriptionDestinations());
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (stageIndex === 0 && stage.kind === 'commit' && isBroadcastInputRejected(msg)) {
        handleCommitBroadcastRejected(stage.txHex);
      } else if (isMempoolChainLimitError(msg)) {
        toast.error(
          'Mempool ancestor chain limit (typical ~25 unconfirmed spends). Let the front of the chain confirm or drop from mempool, then resume broadcasting from the failed step — or use a higher fee so miners sweep the chain sooner.',
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const broadcastAll = async () => {
    if (!plan) return;
    setBusy(true);
    const stages = plan.stages;
    const n = stages.length;
    const probeRows = await probeSignedStagesOnChain(stages);
    const confFromProbe: Record<number, number> = {};
    probeRows.forEach((r, i) => {
      confFromProbe[i] = r.conf;
    });
    setLiveConfirms((prev) => ({ ...prev, ...confFromProbe }));

    const localBroadcasted: boolean[] = probeRows.map((r) => r.visible);
    const prefixReady = chainReadyPrefixFromProbeRows(probeRows, waitConfirms);

    setStageBroadcasted((prev) => {
      const x = [...prev];
      for (let j = 0; j < n; j++) {
        if (localBroadcasted[j]) x[j] = true;
      }
      return x;
    });
    setStageChainReady((prev) => {
      const x = [...prev];
      for (let j = 0; j < n; j++) {
        if (prefixReady[j]) x[j] = true;
      }
      return x;
    });

    let chainRetries = 0;
    const MAX_CHAIN_RETRIES = 5;

    try {
      let i = localBroadcasted.findIndex((b) => !b);
      if (i < 0) {
        toast.success(
          `All ${n} transactions are already visible to Dojakweb read paths (mempool or chain). Nothing new to relay.`,
        );
        clearPersisted();
        markInscriptionDestinationUsed(plan.inscriptionReceiveAddress);
        setUsedDestinations(loadUsedInscriptionDestinations());
        return;
      }
      if (i > 0) {
        toast.info(
          `Resuming at step ${i + 1} of ${n} — earlier txs are already visible to your RPC / explorers. Duplicate sends are skipped as “already in mempool”.`,
        );
      }
      while (i < n) {
        const st = stages[i]!;
        try {
          await broadcastTxWithStatus(st.txHex, (u) => upsertAttempt(i, u));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);

          if (i === 0 && st.kind === 'commit' && isBroadcastInputRejected(msg)) {
            handleCommitBroadcastRejected(st.txHex);
            return;
          }

          if (isMempoolChainLimitError(msg) && chainRetries < MAX_CHAIN_RETRIES) {
            chainRetries++;
            // Find the earliest stage we've already broadcast in this run — wait for it to confirm.
            const waitIdx = localBroadcasted.indexOf(true);
            if (waitIdx >= 0) {
              toast.info(
                `Mempool chain limit at step ${i + 1} — waiting for step ${waitIdx + 1} to confirm before continuing…`,
              );
              try {
                await pollTxForConfirmation(stages[waitIdx]!.txid, (c) =>
                  setLiveConfirms((prev) => ({ ...prev, [waitIdx]: c })),
                );
                setStageChainReady((prev) => {
                  const x = [...prev];
                  x[waitIdx] = true;
                  return x;
                });
                toast.info(`Step ${waitIdx + 1} confirmed. Resuming broadcast…`);
                continue; // retry the same i without incrementing
              } catch (pollErr) {
                if (pollErr instanceof DOMException && pollErr.name === 'AbortError') return;
                toast.error(
                  `Confirmation wait failed: ${pollErr instanceof Error ? pollErr.message : String(pollErr)}`,
                );
                return;
              }
            }
          }

          if (isMempoolChainLimitError(msg)) {
            toast.error(
              'Mempool ancestor chain limit hit. Wait a few minutes for earlier transactions to confirm, then retry from the failed step.',
            );
          } else {
            toast.error(msg);
          }
          return;
        }

        localBroadcasted[i] = true;
        setStageBroadcasted((prev) => {
          const x = [...prev];
          x[i] = true;
          return x;
        });
        const last = n - 1;
        const chainOk = await markChainReadyAfterBroadcast(i, st.txid, i >= last);
        if (!chainOk) return;
        i++;
      }

      toast.success(
        `All ${n} transactions submitted in order. Expected inscription: ${plan.inscriptionId}. ` +
          'They can confirm in one or a few blocks — use explorers or “Refresh chain status” to watch; indexers may lag.',
      );
      clearPersisted();
      markInscriptionDestinationUsed(plan.inscriptionReceiveAddress);
      setUsedDestinations(loadUsedInscriptionDestinations());
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Broadcast failed';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const runStallDetection = useCallback(async () => {
    if (!plan) return;
    stallAbortRef.current?.abort();
    stallAbortRef.current = new AbortController();
    const signal = stallAbortRef.current.signal;
    const n = plan.stages.length;
    const next: Record<number, { stalled: boolean; reason?: string; replaceableHint?: boolean }> = {};

    const brSnap = [...stageBroadcasted];
    const confSnap = { ...liveConfirms };

    for (let i = 0; i < n; i++) {
      if (signal.aborted) return;
      if (!brSnap[i]) continue;
      if ((confSnap[i] ?? 0) >= 1) continue;
      const st = plan.stages[i]!;
      try {
        const r = await isTxStalled(st.txid, feeRate);
        if (signal.aborted) return;
        let replaceableHint: boolean | undefined;
        if (r.replaceability?.inMempool) {
          replaceableHint =
            r.replaceability.bip125Replaceable || rawDoginalTxSupportsRbf(st.txHex);
        }
        next[i] = { stalled: r.stalled, reason: r.reason, replaceableHint };
      } catch {
        next[i] = { stalled: false };
      }
    }
    if (!signal.aborted) setStallByStage(next);
  }, [plan, feeRate, stageBroadcasted, liveConfirms]);

  React.useEffect(() => {
    if (!plan) {
      setStallByStage({});
      return;
    }
    void runStallDetection();
    const t = window.setInterval(() => void runStallDetection(), 90_000);
    return () => {
      window.clearInterval(t);
      stallAbortRef.current?.abort();
    };
  }, [plan, runStallDetection]);

  const refreshChainStatus = async () => {
    if (!plan) return;
    suppressConfirmPollResumeRef.current = false;
    setRefreshingChain(true);
    try {
      const n = plan.stages.length;
      const rows = await probeSignedStagesOnChain(plan.stages);
      const confUpdates: Record<number, number> = {};
      rows.forEach((r, i) => {
        confUpdates[i] = r.conf;
      });

      const onNet = rows.map((r) => r.visible);
      const prefixReady = chainReadyPrefixFromProbeRows(rows, waitConfirms);

      setLiveConfirms(confUpdates);
      setStageBroadcasted((prev) => {
        const x = [...prev];
        for (let i = 0; i < n; i++) {
          if (onNet[i]) x[i] = true;
        }
        return x;
      });
      setStageChainReady((prev) => {
        const x = [...prev];
        for (let i = 0; i < n; i++) {
          if (prefixReady[i]) x[i] = true;
        }
        return x;
      });
      setLastChainRefreshAt(Date.now());
      await runStallDetection();
      toast.success('Chain status refreshed (all steps probed; progress synced if txs were sent outside Dojakweb).');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setRefreshingChain(false);
    }
  };

  const bumpStageFee = async (stageIndex: number) => {
    if (!plan || !contentBuffer || !address) return;
    const st = plan.stages[stageIndex]!;
    if (!stageBroadcasted[stageIndex]) {
      toast.error('Broadcast this step first.');
      return;
    }
    if ((liveConfirms[stageIndex] ?? 0) >= 1) {
      toast.error('This step is already confirmed — fee bump is not needed.');
      return;
    }

    const rep = await fetchMempoolReplaceability(st.txid);
    const rawRbf = rawDoginalTxSupportsRbf(st.txHex);
    if (rep?.inMempool && !rep.bip125Replaceable && !rawRbf) {
      toast.error(
        'This transaction is not marked replaceable (BIP-125). Fee bump will not work — abandon it in Core or rebuild this step.',
      );
      return;
    }

    const est = await getFeeEstimate(6).catch(() => feeRate);
    setBumpFeeConfirm({ stage: stageIndex, est });
  };

  const executeBumpFee = async () => {
    if (!bumpFeeConfirm || !plan || !contentBuffer || !address) return;
    const { stage: stageIndex, est } = bumpFeeConfirm;
    setBumpFeeConfirm(null);
    const st = plan.stages[stageIndex]!;
    const rawRbf = rawDoginalTxSupportsRbf(st.txHex);
    setBusy(true);
    try {
      let updatedStages = plan.stages.map((s, idx) => ({ ...s, index: idx }));
      const lastIdx = updatedStages.length - 1;

      const tryBrowser =
        walletType === 'browser' &&
        Boolean(browser.wallet?.privateKey) &&
        st.kind !== 'commit' &&
        rawRbf;

      if (tryBrowser) {
        const b = await bumpSignedDoginalStageFee({
          stage: st,
          stageIndex,
          content: contentBuffer,
          contentType,
          fromAddress: address,
          privateKeyWIF: browser.wallet!.privateKey!,
          targetFeeRateKoinuPerKb: Math.max(feeRate, est),
        });
        updatedStages[stageIndex] = {
          ...updatedStages[stageIndex]!,
          txHex: b.txHex,
          txid: b.txid,
          feeSatoshis: b.feeSatoshis,
        };
        console.log('[dojakweb:bumpfee] in-browser fee bump OK', { stageIndex, txid: b.txid });
      } else {
        const rpcRes = await rpcBumpFee(st.txid);
        if (!rpcRes.ok) {
          console.warn('[dojakweb:bumpfee] bumpfee failed', rpcRes.error);
          if (st.kind !== 'commit' && !rawRbf) {
            throw new Error(
              `${rpcRes.error} Re-sign the chain in Dojakweb (new builds use RBF-friendly sequences) or import the tx into your Core wallet.`,
            );
          }
          throw new Error(rpcRes.error);
        }
        const hex =
          rpcRes.data.hex ?? (await rpcGetRawTransactionHex(rpcRes.data.txid));
        if (!hex) {
          throw new Error('bumpfee returned a txid but getrawtransaction did not return hex.');
        }
        updatedStages[stageIndex] = {
          ...updatedStages[stageIndex]!,
          txHex: hex,
          txid: rpcRes.data.txid,
          feeSatoshis: updatedStages[stageIndex]!.feeSatoshis,
        };
        console.log('[dojakweb:bumpfee] Core bumpfee OK', { stageIndex, txid: rpcRes.data.txid });
      }

      let newPlan: DoginalChainResult;
      if (stageIndex < lastIdx) {
        if (walletType !== 'browser' || !browser.wallet?.privateKey) {
          throw new Error(
            'Unlock the Dojakweb browser wallet so the app can re-sign downstream transactions against the new parent txid.',
          );
        }
        newPlan = await resignDoginalChainTailAfterBumpedStage({
          stagesPrefix: updatedStages,
          bumpedStageIndex: stageIndex,
          content: contentBuffer,
          contentType,
          fromAddress: address,
          privateKeyWIF: browser.wallet.privateKey,
          feeRate,
          excludedOutpoints: [...extractProtectedOutpoints(inscriptions), ...stickySpendRejectOutpoints],
          inscriptionReceiveAddress: plan.inscriptionReceiveAddress,
        });
      } else {
        const stages = updatedStages.map((s, idx) => ({ ...s, index: idx }));
        const revealTxid = stages[lastIdx]!.txid;
        const totalFeeSatoshis = stages.reduce((a, s) => a + s.feeSatoshis, 0);
        newPlan = {
          ...plan,
          stages,
          inscriptionId: `${revealTxid}i0`,
          revealTxid,
          totalFeeSatoshis,
        };
      }

      setPlan(newPlan);
      setStageBroadcasted((prev) => prev.map((b, j) => (j <= stageIndex ? b : false)));
      setStageChainReady((prev) => prev.map((b, j) => (j <= stageIndex ? b : false)));
      setLiveConfirms((prev) => {
        const x = { ...prev };
        for (let j = stageIndex + 1; j < newPlan.stages.length; j++) delete x[j];
        return x;
      });

      await broadcastTxWithStatus(newPlan.stages[stageIndex]!.txHex, (u) => upsertAttempt(stageIndex, u));
      toast.success(`Fee bumped — new txid ${newPlan.stages[stageIndex]!.txid.slice(0, 18)}…`);
      const bumpedReady = await markChainReadyAfterBroadcast(
        stageIndex,
        newPlan.stages[stageIndex]!.txid,
        stageIndex >= lastIdx,
      );
      if (!bumpedReady) return;
      void runStallDetection();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[dojakweb:bumpfee]', msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const discardSavedSession = () => {
    clearPersisted();
    setPlan(null);
    setAllowResignChain(false);
    setStageBroadcasted([]);
    setStageChainReady([]);
    setStageAttempts({});
    setLiveConfirms({});
    setFile(null);
    setContentBuffer(null);
    setContentType('');
    setInscriptionRecipientInput('');
    restoredRef.current = false;
    toast.info('Saved inscription session cleared.');
  };

  if (!connected || !address) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-bg-primary px-4">
        <p className="text-text-secondary">Connect your wallet to inscribe files on Dogecoin.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary px-4 py-8 text-text-primary">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FCD34D]/30 bg-[#FCD34D]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#FCD34D]">
            Doginals inscription
          </div>
          <h1 className="text-3xl font-black text-text-primary dark:text-white">Inscribe a file</h1>
          <p className="text-sm leading-relaxed text-text-secondary dark:text-white/70">
            Doginals-style P2SH commit → link → reveal (same envelope as{' '}
            <span className="text-text-primary dark:text-white/90">ref/Dogecoin-Tools</span> <code className="text-[#FCD34D]">doginals.js</code>
            ). Each step spends the previous inscription carrier output — <strong className="text-text-primary dark:text-white/90">order is fixed</strong>{' '}
            by the UTXO chain. <strong className="text-text-primary dark:text-white/90">You do not need a block confirmation between steps:</strong>{' '}
            Dogecoin mempools accept unconfirmed parent chains; broadcast tx 1, then 2, … as fast as your relay accepts them
            (same idea as <code className="text-[#FCD34D]">broadcastAll</code> in the reference tool). Miners topologically
            order parents before children in a block. Large files split across many txs; sessions auto-save for resume.
          </p>
          <p className="text-xs leading-relaxed text-text-tertiary dark:text-white/50">
            <strong className="text-text-secondary dark:text-white/70">Mempool limit:</strong> very long unconfirmed chains (~
            {MEMPOOL_ANCESTOR_CHAIN_HINT}+ ancestors) can hit “too-long-mempool-chain” — use a competitive fee and, if
            needed, pause until the front confirms then continue. <strong className="text-text-secondary dark:text-white/70">Optional slow mode:</strong>{' '}
            you can still wait 1 confirmation between steps for extra caution.{' '}
            <strong className="text-text-secondary dark:text-white/70">Extensions:</strong> multi-step signing uses the Dojakweb browser wallet
            today; PSDT for extension wallets is planned.
          </p>
        </header>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'file' | 'recursive')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file">File inscriber</TabsTrigger>
            <TabsTrigger value="recursive">Recursive builder</TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === 'recursive' && (
          <section className="space-y-6 rounded-2xl border border-border-primary bg-bg-secondary dark:border-white/10 dark:bg-black/25 p-5">
            <RecursiveHtmlBuilder onLoadHtml={handleRecursiveLoad} />
          </section>
        )}

        {activeTab === 'file' && (<>
        {plan && (
          <div className="space-y-3 rounded-xl border border-border-primary bg-bg-secondary dark:border-white/10 dark:bg-black/30 px-4 py-3 text-xs text-text-secondary dark:text-white/70">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={refreshingChain || busy}
                onClick={() => void refreshChainStatus()}
                className="rounded-lg bg-[#FCD34D]/20 px-3 py-1.5 font-semibold text-[#FCD34D] hover:bg-[#FCD34D]/30 disabled:opacity-50"
              >
                {refreshingChain ? 'Checking…' : 'Refresh chain status'}
              </button>
              <button
                type="button"
                onClick={discardSavedSession}
                className="rounded-lg border border-border-primary px-3 py-1.5 text-text-secondary transition hover:bg-bg-tertiary dark:border-white/15 dark:text-white/80 dark:hover:bg-white/10"
              >
                Discard saved session
              </button>
            </div>
            <ConfirmationReadSourcesBar dense className="border-white/8 bg-black/20" />
            <p className="text-[11px] leading-relaxed text-text-tertiary dark:text-white/45">
              With RPC + same-origin proxy, “low fee — may be stuck” can use your node’s mempool. SoChain links in the UI are
              manual lookup only — not polled for confirmations.
            </p>
          </div>
        )}

        {stickySpendRejectOutpoints.length > 0 && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Skipping {stickySpendRejectOutpoints.length} outpoint(s) from a failed commit.{' '}
            <button
              type="button"
              className="ml-2 underline hover:text-text-primary dark:hover:text-white"
              onClick={() => setStickySpendRejectOutpoints([])}
            >
              Clear skip list
            </button>
          </div>
        )}

        <section
          {...getRootProps()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition ${
            isDragActive ? 'border-[#FCD34D] bg-[#FCD34D]/10' : 'border-white/20 bg-black/30 hover:border-white/35'
          } ${busy ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input {...getInputProps()} />
          <DocumentArrowUpIcon className="mx-auto mb-3 h-12 w-12 text-[#FCD34D]" />
          <p className="font-semibold text-text-primary dark:text-white">Drop any file here, or click to choose</p>
          <p className="mt-2 text-xs text-text-secondary dark:text-white/55">
            Max {Math.floor(MAX_FILE_BYTES / (1024 * 1024))} MB · up to {MAX_BROADCAST_STAGES} txs · MIME max{' '}
            {DOGINAL_MAX_CONTENT_TYPE_LEN} bytes
          </p>
        </section>

        {file && contentBuffer && (
          <div className="space-y-4 rounded-2xl border border-border-primary bg-bg-secondary dark:border-white/10 dark:bg-black/25 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-mono text-sm text-[#FCD34D]">{file.name}</div>
                <div className="text-xs text-text-tertiary dark:text-white/50">
                  {contentBuffer.length} bytes · ~{countDoginalTransactionsForContent(contentBuffer, contentType)} txs
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  clearPersisted();
                  setFile(null);
                  setContentBuffer(null);
                  setContentType('');
                  setPlan(null);
                  setStageBroadcasted([]);
                  setStageChainReady([]);
                  setStageAttempts({});
                  setLiveConfirms({});
                  setStickySpendRejectOutpoints([]);
                  setInscriptionRecipientInput('');
                  setAllowResignChain(false);
                  restoredRef.current = false;
                }}
                className="text-sm text-text-secondary dark:text-white/60 underline hover:text-text-primary dark:hover:text-white"
              >
                Clear
              </button>
            </div>
            <div>
              <Label className="block text-sm text-text-secondary dark:text-white/80">
                Content-Type (MIME)
              </Label>
              <Input
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className="mt-1 font-mono"
                maxLength={200}
              />
            </div>
            <div className="space-y-2 rounded-xl border border-border-primary bg-bg-secondary dark:border-white/10 dark:bg-black/30 p-3">
              <div>
                <Label className="block text-sm text-text-secondary dark:text-white/80">
                  Inscription recipient (optional)
                </Label>
                <Input
                  value={inscriptionRecipientInput}
                  onChange={(e) => setInscriptionRecipientInput(e.target.value)}
                  placeholder={address}
                  spellCheck={false}
                  autoComplete="off"
                  className="mt-1 font-mono"
                />
              </div>
              {recipientResolution.ok ? (
                <div className="space-y-1 text-xs leading-relaxed text-text-secondary dark:text-white/55">
                  <p>
                    <span className="text-text-secondary dark:text-white/70">Funds &amp; fee change</span> still come from your connected wallet. The{' '}
                    <span className="text-text-secondary dark:text-white/70">100 000 koinu inscription UTXO</span> will be sent to:{' '}
                    <span className="break-all font-mono text-[#FCD34D]/90">{recipientResolution.effective}</span>
                    {recipientResolution.isCustom ? null : (
                      <span className="text-text-tertiary dark:text-white/45"> (default — same as your wallet)</span>
                    )}
                  </p>
                  {recipientResolution.isCustom ? (
                    usedDestinations.has(recipientResolution.effective) ? (
                      <p className="text-emerald-400/90">
                        You have sent at least one inscription to this address before from Dojakweb on this browser.
                      </p>
                    ) : (
                      <p className="text-amber-200/85">
                        First inscription to this address from Dojakweb on this device — double-check it before you sign.
                      </p>
                    )
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-rose-300/95">{recipientResolution.message}</p>
              )}
            </div>
            <label className="block text-sm text-text-secondary dark:text-white/80">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Fee rate (koinu/kB){' '}
                  <span className="text-text-tertiary dark:text-white/45">— same unit as Core wallet; RPC uses estimatesmartfee when configured</span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void refreshFeeFromNode()}
                  className="shrink-0 rounded-lg border border-[#FCD34D]/40 px-2 py-1 text-xs font-semibold text-[#FCD34D] hover:bg-[#FCD34D]/10 disabled:opacity-50"
                >
                  Refresh from node
                </button>
              </span>
              <Input
                type="number"
                value={feeRate}
                min={1_000_000}
                onChange={(e) => {
                  const v = Number(e.target.value) || 1_000_000;
                  // Inclusion floor = 10× Core min-relay (1_000_000 koinu/kB).
                  setFeeRate(Math.max(1_000_000, v));
                }}
                className="mt-1"
              />
              {feeRate < 1_000_000 && (
                <p className="mt-1 text-xs text-amber-300/90">
                  Warning: fee rate below 1,000,000 koinu/kB may leave inscriptions stuck in the mempool.
                </p>
              )}
            </label>
            <ServerInscribeJobPanel
              file={file}
              contentBuffer={contentBuffer}
              contentType={contentType}
              feeRateKoinuPerKb={feeRate}
              marker={inscriptionMarker}
            />
            <div className="rounded-xl border border-border-primary bg-bg-secondary dark:border-white/10 dark:bg-black/30 p-3 text-sm text-text-secondary dark:text-white/80">
              <div className="px-1 text-xs font-semibold uppercase tracking-wide text-text-tertiary dark:text-white/50 mb-3">
                Between-step gating
              </div>
              <RadioGroup value={waitConfirms ? 'wait' : 'fast'} onValueChange={(value) => setWaitConfirms(value === 'wait')}>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="fast" id="fast" />
                  <Label htmlFor="fast" className="flex-1 cursor-pointer">
                    <div className="font-medium text-text-primary dark:text-white">Mempool-fast (default)</div>
                    <div className="mt-0.5 text-xs text-text-secondary dark:text-white/55">
                      Each broadcast step only completes after your RPC (if configured) and/or public indexers can see the
                      tx — not merely when an API returns a txid — so the next step is less likely to hit orphan / missing
                      parent. Still no block confirmation wait. Same spirit as{' '}
                      <code className="text-[#FCD34D]/90">doginals.js</code> <code className="text-[#FCD34D]/90">broadcastAll</code>.
                    </div>
                  </Label>
                </div>
                <div className="flex items-start space-x-2 mt-3">
                  <RadioGroupItem value="wait" id="wait" />
                  <Label htmlFor="wait" className="flex-1 cursor-pointer">
                    <div className="font-medium text-text-primary dark:text-white">Wait 1 confirmation per step</div>
                    <div className="mt-0.5 text-xs text-text-secondary dark:text-white/55">
                      Slower; optional if you want each parent mined before broadcasting the child (slightly lower reorg edge
                      for multi-day pauses).
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            {plan ? (
              <div className="space-y-2 rounded-xl border border-border-primary bg-bg-secondary dark:border-white/10 dark:bg-black/35 px-3 py-2.5 text-xs leading-relaxed text-text-secondary dark:text-white/65">
                {stageBroadcasted.some(Boolean) ? (
                  <p>
                    This file already has a <strong className="text-text-secondary dark:text-white/80">signed chain</strong> and at least one step
                    has been <strong className="text-text-secondary dark:text-white/80">broadcast</strong>. Re-signing from here would desync txids
                    from what is on-chain — finish this chain, or use <strong className="text-text-secondary dark:text-white/80">Discard saved session</strong>{' '}
                    / <strong className="text-text-secondary dark:text-white/80">Clear</strong> to start over.
                  </p>
                ) : allowResignChain ? (
                  <p className="text-amber-200/90">
                    Re-sign is unlocked: the next click replaces all signed transactions and the inscription id. Cancel
                    the unlock below if you tapped this by mistake.
                  </p>
                ) : (
                  <p>
                    A <strong className="text-text-secondary dark:text-white/80">signed chain</strong> is already loaded for this file. Signing
                    again would replace every transaction and <strong className="text-text-secondary dark:text-white/80">change inscription / txids</strong>
                    — only do that before you broadcast, or if you are intentionally starting over.
                  </p>
                )}
                {plan && !stageBroadcasted.some(Boolean) ? (
                  <label className="flex cursor-pointer items-start gap-2 pt-0.5 text-text-secondary dark:text-white/80">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={allowResignChain}
                      onChange={(e) => {
                        if (!e.target.checked) {
                          setAllowResignChain(false);
                          setPendingResignConfirm(false);
                          return;
                        }
                        setPendingResignConfirm(true);
                      }}
                    />
                    <span>I understand — allow re-signing this file (before any broadcast)</span>
                  </label>
                ) : null}
                {pendingResignConfirm && (
                  <ConfirmBanner
                    variant="amber"
                    confirmLabel="Yes, replace chain"
                    message={
                      <span>
                        Replace the current signed chain?
                        <ul className="mt-1 list-disc pl-4 space-y-0.5 text-xs">
                          <li>All staged transactions will be re-signed.</li>
                          <li>Inscription ID and every txid will change.</li>
                          <li>Only safe if you have <strong>not</strong> broadcast any step yet.</li>
                        </ul>
                      </span>
                    }
                    onConfirm={() => { setAllowResignChain(true); setPendingResignConfirm(false); }}
                    onCancel={() => setPendingResignConfirm(false)}
                  />
                )}
              </div>
            ) : null}
            <button
              type="button"
              disabled={
                busy ||
                walletType !== 'browser' ||
                !recipientResolution.ok ||
                (Boolean(plan) && (stageBroadcasted.some(Boolean) || !allowResignChain))
              }
              onClick={() => void buildPlan()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FCD34D] py-3 text-sm font-bold text-black transition hover:bg-[#fde68a] disabled:opacity-50"
              title={
                plan && stageBroadcasted.some(Boolean)
                  ? 'Cannot re-sign after broadcasting — discard session or continue from broadcast list.'
                  : plan && !allowResignChain
                    ? 'Enable “allow re-signing” above if you need a new signature set before any broadcast.'
                    : undefined
              }
            >
              {busy ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : null}
              {plan ? 'Re-sign inscription chain' : 'Sign inscription chain'}
            </button>
            {walletType !== 'browser' && (
              <p className="text-xs text-amber-200/90">
                Switch to the Dojakweb browser wallet to sign multi-transaction inscription chains.
              </p>
            )}
          </div>
        )}

        {plan && plan.stages.length >= MEMPOOL_ANCESTOR_CHAIN_HINT - 2 && (
          <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-xs text-amber-100/95 leading-relaxed">
            <strong className="text-amber-200">Long chain ({plan.stages.length} txs):</strong> you are near the usual ~{' '}
            {MEMPOOL_ANCESTOR_CHAIN_HINT} unconfirmed-ancestor mempool limit. Prefer <strong>Auto: broadcast all in order</strong>{' '}
            with a strong fee; if a relay returns “too-long-mempool-chain”, wait for the early txs to confirm then resume
            from the failed step.
          </div>
        )}

        {plan && (
          <section className="space-y-4 rounded-2xl border border-border-primary bg-bg-secondary dark:border-white/10 dark:bg-black/25 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-text-primary dark:text-white">Broadcast order</h2>
                <p className="text-xs text-text-secondary dark:text-white/55">
                  Total fee ≈{' '}
                  <span className="inline-flex items-center gap-0.5 align-middle">
                    <span>{(plan.totalFeeSatoshis / 1e8).toFixed(4)}</span>
                    <DogeCurrencyIcon size="sm" className="opacity-90" />
                  </span>{' '}
                  · Inscription ID <span className="font-mono text-[#FCD34D]">{plan.inscriptionId}</span>
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-text-tertiary dark:text-white/48">
                  Protocol marker:{' '}
                  <span className="font-medium text-text-secondary dark:text-white/70">
                    {inscriptionMarker === 'ord' ? 'Doginals v1 (ord)' : 'Dogenals v2 (dog)'}
                  </span>{' '}
                  — default is <strong className="text-text-secondary dark:text-white/65">ord</strong> (what MyDoge-style indexers expect). Change under{' '}
                  <strong className="text-text-secondary dark:text-white/65">Settings → Providers → Inscription Protocol</strong>.
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-text-tertiary dark:text-white/48">
                  This id is <code className="text-[#FCD34D]/90">{'{revealTxid}i0'}</code> from the signed reveal in this plan. If any step was{' '}
                  <strong className="text-text-secondary dark:text-white/65">replaced</strong> (fee bump / different hex from outside Dojakweb), the real id is whatever
                  your wallet or explorer shows for the mined reveal — finish reconciling, then use <strong className="text-text-secondary dark:text-white/65">Discard saved session</strong>{' '}
                  so you are not tracking a stale prediction.
                </p>
                <p className="mt-1 text-xs text-text-tertiary dark:text-white/50">
                  Inscription UTXO recipient:{' '}
                  <span className="break-all font-mono text-text-secondary dark:text-white/75">{plan.inscriptionReceiveAddress}</span>
                </p>
                <p className="mt-1 text-xs text-text-tertiary dark:text-white/45">
                  Signed hex is deterministic — you can pause between steps. Always broadcast in order: each tx spends the
                  previous P2SH; the child is only valid once the parent exists in <strong className="text-text-secondary dark:text-white/60">mempool or chain</strong>
                  . Default mode does <strong className="text-text-secondary dark:text-white/60">not</strong> wait for confirmations between steps.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void broadcastAll()}
                title="Probes every txid first, then relays only missing steps (safe after a manual re-broadcast or interrupted run)."
                className="inline-flex items-center gap-2 rounded-xl border border-[#FCD34D]/40 bg-[#FCD34D]/15 px-4 py-2 text-sm font-semibold text-[#FCD34D] hover:bg-[#FCD34D]/25 disabled:opacity-50"
              >
                <RadioIcon className="h-5 w-5" />
                Auto: broadcast full chain
              </button>
            </div>
            <ol className="space-y-3">
              {plan.stages.map((st, i) => {
                void confPollTick;
                const broadcasted = !!stageBroadcasted[i];
                const ready = !!stageChainReady[i];
                const live = liveConfirms[i];
                const canClick = canBroadcastStage(i);
                const pollWait = confPollWaitByStage[i];
                const showConfPollUi = waitConfirms && broadcasted && !ready;
                const nextCheckSec =
                  pollWait && pollWait.until > Date.now()
                    ? Math.max(0, Math.ceil((pollWait.until - Date.now()) / 1000))
                    : null;
                const pollIntervalSec = pollWait ? Math.round(pollWait.intervalMs / 1000) : null;
                const liveCount = live ?? 0;
                const minedOnChain =
                  liveCount >= 1 || (broadcasted && waitConfirms && ready);
                return (
                  <li
                    key={`${st.txid}-${i}`}
                    className={`rounded-xl border p-4 text-sm ${
                      minedOnChain
                        ? 'border-emerald-500/45 bg-emerald-500/[0.14]'
                        : broadcasted
                          ? 'border-emerald-500/30 bg-emerald-500/5'
                          : 'border-border-primary bg-bg-tertiary dark:border-white/10 dark:bg-black/40'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold capitalize text-text-primary dark:text-white">
                        {i + 1}. {st.kind}
                        {broadcasted ? (
                          <span
                            className={`ml-2 font-normal ${
                              minedOnChain
                                ? 'text-[10px] text-text-tertiary dark:text-white/40'
                                : 'text-xs text-emerald-400'
                            }`}
                          >
                            · sent
                          </span>
                        ) : null}
                        {ready && !minedOnChain ? (
                          <span className="ml-2 text-xs font-normal text-sky-400">
                            {waitConfirms ? '· chain-ready (1+ conf)' : '· next step unlocked'}
                          </span>
                        ) : null}
                        {ready && minedOnChain ? (
                          <span className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-100 shadow-sm">
                            <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
                            {waitConfirms
                              ? `Confirmed on-chain (${liveCount >= 1 ? `~${liveCount} conf` : '1+ conf'})`
                              : `On-chain · ~${liveCount} conf`}
                          </span>
                        ) : null}
                        {!ready && broadcasted && waitConfirms ? (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-amber-400">
                            <ArrowPathIcon className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
                            awaiting 1+ conf…
                          </span>
                        ) : null}
                        {broadcasted && stallByStage[i]?.stalled ? (
                          <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-normal text-amber-300">
                            low fee — may be stuck
                          </span>
                        ) : null}
                      </span>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {(() => {
                          const prefName = dogeTxExplorerDisplayName(loadDogeTxExplorerPreference());
                          return (
                            <>
                              <a
                                href={preferredPublicTxPageUrl(st.txid)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#FCD34D] underline hover:text-[#fde68a]"
                              >
                                {prefName}
                              </a>
                              {prefName !== 'Ðexplorer' ? (
                                <a
                                  href={dogenalsPublicTxUrl(st.txid)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-white/50 underline hover:text-white/80"
                                >
                                  Ðexplorer
                                </a>
                              ) : null}
                              {prefName !== 'SoChain' ? (
                                <a
                                  href={sochainPublicTxPageUrl(st.txid)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-white/50 underline hover:text-white/80"
                                >
                                  SoChain
                                </a>
                              ) : null}
                              {prefName !== 'DogeChain' ? (
                                <a
                                  href={dogechainPublicTxUrl(st.txid)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-white/50 underline hover:text-white/80"
                                >
                                  DogeChain
                                </a>
                              ) : null}
                              {prefName !== 'Blockchair' ? (
                                <a
                                  href={blockchairPublicTxUrl(st.txid)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-white/50 underline hover:text-white/80"
                                >
                                  Blockchair
                                </a>
                              ) : null}
                            </>
                          );
                        })()}
                {broadcasted && (liveConfirms[i] ?? 0) < 1 && stallByStage[i]?.stalled ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void bumpStageFee(i)}
                            className="rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 disabled:opacity-40"
                            title={
                              stallByStage[i]?.replaceableHint === false
                                ? 'Not replaceable — bump may fail'
                                : 'Raises the fee (browser RBF when signed with replaceable inputs, otherwise Dogecoin Core bumpfee if the tx is in your wallet). Configure RPC for detection.'
                            }
                          >
                            🚀 Bump fee
                          </button>
                        ) : null}
                        {broadcasted && liveCount === 0 && (
                          isPropagationUnverified(i) ||
                          // Stall check ran and reported a reason but tx is not in mempool
                          (stallByStage[i] != null && !stallByStage[i]?.stalled && !!stallByStage[i]?.reason)
                        ) ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => resetStageBroadcast(i)}
                            className="rounded-lg border border-sky-500/50 bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-200 hover:bg-sky-500/25 disabled:opacity-40"
                            title="This tx was accepted by the relay but is not visible in the mempool or on any explorer. Click to unlock re-broadcast — try again after parent txs confirm, or switch to a different relay in Wallet settings."
                          >
                            ↺ Re-broadcast
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={!canClick}
                          onClick={() => void broadcastStage(st, i)}
                          className="rounded-lg bg-bg-tertiary px-3 py-1 text-xs font-semibold text-text-primary hover:bg-bg-secondary disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                          title={
                            !canClick && !broadcasted && i > 0
                              ? waitConfirms
                                ? 'Broadcast the previous step and wait until it is chain-ready'
                                : 'Broadcast the previous step first (parent must be accepted by your relay / mempool)'
                              : undefined
                          }
                        >
                          {broadcasted ? 'Already broadcast' : 'Broadcast this tx'}
                        </button>
                      </div>
                    </div>
                    {bumpFeeConfirm?.stage === i && (
                      <div className="mt-3">
                        <ConfirmBanner
                          variant="amber"
                          confirmLabel="Yes, bump fee"
                          busy={busy}
                          message={
                            <span>
                              Replace this transaction with a higher-fee version?{' '}
                              Smart-fee target ≈ <strong>{bumpFeeConfirm.est.toLocaleString()} koinu/kB</strong>.
                              Later steps will be re-signed to follow the new txid.
                              Uses your browser wallet when possible, or Dogecoin Core bumpfee if the tx is in your node wallet.
                            </span>
                          }
                          onConfirm={() => void executeBumpFee()}
                          onCancel={() => setBumpFeeConfirm(null)}
                        />
                      </div>
                    )}
                    <div className="mt-1 font-mono text-xs text-text-tertiary dark:text-white/45 break-all">{st.txid}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-tertiary dark:text-white/40">
                      <span className="inline-flex items-center gap-0.5">
                        Fee ≈ {(st.feeSatoshis / 1e8).toFixed(4)}
                        <DogeCurrencyIcon size="xs" className="opacity-90" />
                      </span>
                      {live !== undefined ? (
                        minedOnChain ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2 py-1 text-[11px] font-medium text-emerald-100">
                            <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
                            Explorers: ~{live} confirmation{live !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span>
                            Explorers: ~{live} conf
                            {!broadcasted && live > 0 ? (
                              <span className="ml-1 text-amber-300/90">(tx found — synced from chain)</span>
                            ) : null}
                          </span>
                        )
                      ) : (
                        <span className="text-text-tertiary dark:text-white/35">Explorers: not probed yet</span>
                      )}
                      {stallByStage[i]?.reason ? <span className="text-amber-300/85">Stall hint: {stallByStage[i]!.reason}</span> : null}
                    </div>
                    {showConfPollUi ? (
                      <TxConfirmationPollProgress
                        active
                        nextCheckSec={nextCheckSec}
                        intervalSec={pollIntervalSec}
                        variant="doginals"
                        explorerLagHint={(live ?? 0) < 1}
                        className="mt-2"
                      />
                    ) : null}
                    {(stageAttempts[i] ?? []).length > 0 ? (
                      <div
                        className={cn(
                          'mt-2 border-t pt-2',
                          minedOnChain ? 'border-border-primary/40 dark:border-white/[0.08]' : 'border-border-primary dark:border-white/10',
                        )}
                      >
                        <BroadcastRelayAttempts
                          attempts={stageAttempts[i]!}
                          title="Relay status"
                          variant="doginals"
                          tone={minedOnChain ? 'archived' : 'standard'}
                          dense
                          embedded
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>

            <div className="mt-6 space-y-4 border-t border-border-primary dark:border-white/10 pt-6">
              <h3 className="text-sm font-bold uppercase tracking-wide text-text-tertiary dark:text-white/50">Indexer &amp; archive</h3>
              <p className="text-[11px] text-text-tertiary dark:text-white/45">
                Last chain refresh:{' '}
                {lastChainRefreshAt ? new Date(lastChainRefreshAt).toLocaleString() : 'not refreshed yet this session'}.
              </p>
              <div
                className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${
                  indexerPhase === 'verified'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                    : indexerPhase === 'mismatch'
                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-100'
                      : indexerPhase === 'error'
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                        : 'border-border-primary bg-bg-secondary text-text-secondary dark:border-white/10 dark:bg-black/35 dark:text-white/75'
                }`}
              >
                <div className="font-semibold text-text-primary dark:text-white">
                  {indexerPhase === 'idle' && 'Indexer idle'}
                  {indexerPhase === 'awaiting_confirmation' && 'Waiting for confirmation'}
                  {indexerPhase === 'polling' && 'Polling MyDoge API'}
                  {indexerPhase === 'verifying' && 'Verifying against CDN'}
                  {indexerPhase === 'verified' && 'Verified on indexer'}
                  {indexerPhase === 'mismatch' && 'Content mismatch'}
                  {indexerPhase === 'error' && 'Indexer / network issue'}
                </div>
                {indexerDetail ? <p className="mt-2 text-xs opacity-95">{indexerDetail}</p> : null}
                {indexerSha256 ? (
                  <p className="mt-2 break-all font-mono text-[11px] text-text-secondary dark:text-white/60">SHA-256: {indexerSha256}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={mydogeInscriptionApiUrl(plan.inscriptionId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-[#FCD34D]/35 bg-[#FCD34D]/10 px-3 py-1.5 text-xs font-semibold text-[#FCD34D] hover:bg-[#FCD34D]/20"
                  >
                    Open MyDoge API
                  </a>
                  {indexerMeta?.content ? (
                    <a
                      href={indexerMeta.content}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-border-primary px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:bg-bg-tertiary dark:border-white/20 dark:text-white/85 dark:hover:bg-white/10"
                    >
                      Open CDN content
                    </a>
                  ) : null}
                  {(indexerPhase === 'error' || indexerPhase === 'mismatch') && contentBuffer ? (
                    <button
                      type="button"
                      onClick={() => retryIndexerCheck()}
                      className="rounded-lg bg-bg-tertiary px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-bg-secondary dark:bg-white/15 dark:text-white dark:hover:bg-white/25"
                    >
                      Retry check
                    </button>
                  ) : null}
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-text-tertiary dark:text-white/45">
                  After the reveal tx has 1+ confirmations, Dojakweb polls{' '}
                  <span className="font-mono text-text-secondary dark:text-white/55">api.mydoge.com/inscription/&lt;id&gt;</span> about every 30s
                  until metadata appears, then fetches the <span className="font-mono text-text-secondary dark:text-white/55">cdn.doggy.market</span>{' '}
                  URL once and compares bytes to your file. A match is saved to this browser&apos;s archive for this
                  wallet. Public explorer confirmation checks are cached ~28s; BlockCypher is used only if it remains in your
                  Wallet broadcast order and the browser allows its API (CORS). Configure RPC for faster, private reads.
                </p>
              </div>

              {inscribeArchive.length > 0 ? (
                <div className="rounded-xl border border-border-primary bg-bg-secondary dark:border-white/10 dark:bg-black/30 p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-text-tertiary dark:text-white/45">Verified archive (this wallet)</div>
                  <ul className="mt-3 max-h-56 space-y-3 overflow-y-auto text-xs">
                    {inscribeArchive.map((row) => (
                      <li key={row.inscriptionId} className="rounded-lg border border-border-primary bg-bg-tertiary dark:border-white/10 dark:bg-black/40 p-3">
                        <div className="font-mono text-[#FCD34D]/90 break-all">{row.inscriptionId}</div>
                        <div className="mt-1 text-text-secondary dark:text-white/55">
                          {row.fileName} · {(row.contentLength / 1024).toFixed(1)} KB ·{' '}
                          {new Date(row.verifiedAt).toLocaleString()}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <a
                            href={row.mydogeApiUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#FCD34D] underline"
                          >
                            API
                          </a>
                          <a
                            href={row.cdnContentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-300 underline"
                          >
                            CDN
                          </a>
                        </div>
                        <div className="mt-1 break-all font-mono text-[10px] text-text-tertiary dark:text-white/40">SHA-256 {row.sha256Hex}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
        )}
        </>)}
      </div>
    </div>
  );
};
