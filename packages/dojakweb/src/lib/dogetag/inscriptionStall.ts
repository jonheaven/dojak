/**
 * Detect under-fee / long-waiting mempool txs for the inscription chain.
 * Uses Wallet RPC when configured; otherwise Command.dog (`/v1/tx/.../status` + `/mempool`) + `getFeeEstimate`.
 */

import {
  browserRpcProxyAbsoluteUrl,
  rpcViaProxyDetailed,
  type RpcCredentials,
} from '../rpc-proxy-client';
import { loadBroadcastConfig } from '../broadcast/dogecoinTxBroadcast';
import {
  fetchCommandDogTxMempoolEntry,
  fetchCommandDogTxStatus,
  getCommandDogApiBaseUrl,
  type CommandDogTxMempoolBody,
} from '../../utils/api';
import { getFeeEstimate } from '../../utils/txBroadcaster';

const STALL_LOG = '[dojakweb:stall]';
const FIFTEEN_MIN_SEC = 15 * 60;
/** Mark stalled if mempool feerate is below this fraction of the 6-block smart fee (koinu/kB). */
const LOW_FEE_RATIO = 0.8;

export type MempoolReplaceability = {
  inMempool: boolean;
  /** Core `bip125-replaceable` — false means bumpfee / RBF replacement will not work. */
  bip125Replaceable: boolean;
  /** Seconds since entry entered mempool (when available). */
  timeInMempoolSec: number | null;
  /** Effective feerate in koinu per kB (mempool), if computable. */
  feeRateKoinuPerKb: number | null;
};

export type TxStallResult = {
  stalled: boolean;
  /**
   * True when stall logic used the browser RPC proxy (`getrawtransaction` / `getmempoolentry`).
   * False when using Command.dog-only or when no backend was available.
   */
  usedRpc: boolean;
  replaceability: MempoolReplaceability | null;
  reason?: string;
};

function rpcCredsOrNull(): RpcCredentials | null {
  if (typeof window === 'undefined') return null;
  if (!browserRpcProxyAbsoluteUrl()) return null;
  const cfg = loadBroadcastConfig();
  const url = cfg.rpcUrl?.trim();
  const user = cfg.rpcUser?.trim();
  const pass = cfg.rpcPass;
  if (!url || !user || pass === undefined || pass === '') return null;
  return { rpcUrl: url, rpcUser: user, rpcPass: pass };
}

/**
 * Mempool entry shape from Dogecoin Core (Bitcoin-compatible fields).
 */
function feerateKoinuPerKbFromMempoolEntry(entry: Record<string, unknown>): number | null {
  const vsize =
    (typeof entry.vsize === 'number' && entry.vsize > 0 ? entry.vsize : null) ??
    (typeof entry.size === 'number' && entry.size > 0 ? entry.size : null);
  if (!vsize) return null;
  const fees = entry.fees as Record<string, unknown> | undefined;
  const base =
    fees && typeof fees.base === 'number' && Number.isFinite(fees.base) && fees.base >= 0 ? fees.base : null;
  if (base == null) return null;
  // Core reports fee in DOGE for Dogecoin? Check: Bitcoin uses BTC; Dogecoin Core typically uses DOGE in RPC.
  // In Bitcoin Core 22+, mempool entry "fees" uses { base, modified } in **BTC**.
  // Dogecoin Core follows Bitcoin — fee in **DOGE** as float → convert to koinu.
  const feeKoinu = Math.round(base * 1e8);
  if (!Number.isFinite(feeKoinu) || feeKoinu < 0) return null;
  return (feeKoinu * 1000) / vsize;
}

/**
 * Fetch mempool replaceability and feerate for a txid. If not in mempool, `inMempool` is false.
 */
export async function fetchMempoolReplaceability(txid: string): Promise<MempoolReplaceability | null> {
  const creds = rpcCredsOrNull();
  if (!creds) return null;
  const mem = await rpcViaProxyDetailed<Record<string, unknown>>('getmempoolentry', [txid], creds);
  if (!mem.ok || !mem.result || typeof mem.result !== 'object') {
    return null;
  }
  const e = mem.result;
  const br = e['bip125-replaceable'];
  const bip125Replaceable = br === true;
  const t = e.time;
  const timeInMempoolSec =
    typeof t === 'number' && Number.isFinite(t) ? Math.max(0, Math.floor(Date.now() / 1000 - t)) : null;
  return {
    inMempool: true,
    bip125Replaceable,
    timeInMempoolSec,
    feeRateKoinuPerKb: feerateKoinuPerKbFromMempoolEntry(e),
  };
}

function mempoolBodyToReplaceability(body: CommandDogTxMempoolBody | null): MempoolReplaceability | null {
  if (!body?.in_mempool) return null;
  const t = body.time_unix;
  const timeInMempoolSec =
    typeof t === 'number' && Number.isFinite(t) ? Math.max(0, Math.floor(Date.now() / 1000 - t)) : null;
  const fr = body.fee_rate_koinu_per_kb;
  return {
    inMempool: true,
    bip125Replaceable: body.bip125_replaceable === true,
    timeInMempoolSec,
    feeRateKoinuPerKb: typeof fr === 'number' && Number.isFinite(fr) && fr > 0 ? fr : null,
  };
}

async function resolveSmartFeeKoinuPerKb(current?: number): Promise<number | null> {
  if (current != null && Number.isFinite(current) && current > 0) return current;
  try {
    const n = await getFeeEstimate(6);
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * True if the tx appears stuck: unconfirmed, in mempool, and (low feerate vs estimate OR long wait).
 */
export async function isTxStalled(
  txid: string,
  currentSmartFeeKoinuPerKb?: number,
): Promise<TxStallResult> {
  if (typeof window !== 'undefined' && getCommandDogApiBaseUrl().trim().length > 0) {
    return isTxStalledViaCommandDog(txid, currentSmartFeeKoinuPerKb);
  }

  const creds = rpcCredsOrNull();
  if (!creds) {
    return {
      stalled: false,
      usedRpc: false,
      replaceability: null,
      reason: 'Configure Command.dog API URL or Wallet RPC for stall detection.',
    };
  }

  const verbose = await rpcViaProxyDetailed<Record<string, unknown>>('getrawtransaction', [txid, true], creds);
  let confirmations = 0;
  if (verbose.ok && verbose.result && typeof verbose.result === 'object') {
    const c = verbose.result.confirmations;
    if (typeof c === 'number' && Number.isFinite(c)) confirmations = Math.max(0, Math.floor(c));
  }

  if (confirmations >= 1) {
    return { stalled: false, usedRpc: true, replaceability: null };
  }

  const rep = await fetchMempoolReplaceability(txid);
  if (!rep?.inMempool) {
    return {
      stalled: false,
      usedRpc: true,
      replaceability: rep,
      reason: 'Not in local mempool (still propagating or unknown to this node)',
    };
  }

  const smart = await resolveSmartFeeKoinuPerKb(currentSmartFeeKoinuPerKb);

  const lowFee =
    rep.feeRateKoinuPerKb != null &&
    smart != null &&
    smart > 0 &&
    rep.feeRateKoinuPerKb < smart * LOW_FEE_RATIO;

  const longWait =
    rep.timeInMempoolSec != null && rep.timeInMempoolSec >= FIFTEEN_MIN_SEC && confirmations === 0;

  const stalled = Boolean(lowFee || longWait);
  const reason = stalled
    ? lowFee
      ? `Mempool feerate (~${Math.round(rep.feeRateKoinuPerKb ?? 0)} koinu/kB) is well below current estimate (~${Math.round(smart ?? 0)} koinu/kB)`
      : 'Unconfirmed for 15+ minutes in local mempool'
    : undefined;

  if (stalled) {
    console.info(STALL_LOG, { txid: txid.slice(0, 16), lowFee, longWait, replaceable: rep.bip125Replaceable });
  }

  return { stalled, usedRpc: true, replaceability: rep, reason };
}

/** Stall hints without wallet RPC: Command.dog tx status + mempool + `getFeeEstimate`. */
async function isTxStalledViaCommandDog(
  txid: string,
  currentSmartFeeKoinuPerKb?: number,
): Promise<TxStallResult> {
  const status = await fetchCommandDogTxStatus(txid);
  if (!status) {
    return {
      stalled: false,
      usedRpc: false,
      replaceability: null,
      reason: 'Could not reach Command.dog for stall check',
    };
  }
  if (!status.known) {
    return {
      stalled: false,
      usedRpc: false,
      replaceability: null,
      reason: 'Transaction not known to Command.dog node yet',
    };
  }

  const confirmations = Math.max(0, Math.floor(status.confirmations ?? 0));
  if (confirmations >= 1 || status.in_block === true) {
    return { stalled: false, usedRpc: false, replaceability: null };
  }

  const memJson = await fetchCommandDogTxMempoolEntry(txid);
  const rep = mempoolBodyToReplaceability(memJson);
  if (!rep?.inMempool) {
    return {
      stalled: false,
      usedRpc: false,
      replaceability: rep,
      reason: 'Not in Command.dog mempool (still propagating or unknown to this node)',
    };
  }

  const smart = await resolveSmartFeeKoinuPerKb(currentSmartFeeKoinuPerKb);

  const lowFee =
    rep.feeRateKoinuPerKb != null &&
    smart != null &&
    smart > 0 &&
    rep.feeRateKoinuPerKb < smart * LOW_FEE_RATIO;

  const longWait =
    rep.timeInMempoolSec != null && rep.timeInMempoolSec >= FIFTEEN_MIN_SEC && confirmations === 0;

  const stalled = Boolean(lowFee || longWait);
  const reason = stalled
    ? lowFee
      ? `Mempool feerate (~${Math.round(rep.feeRateKoinuPerKb ?? 0)} koinu/kB) is well below current estimate (~${Math.round(smart ?? 0)} koinu/kB)`
      : 'Unconfirmed for 15+ minutes in Command.dog mempool'
    : undefined;

  if (stalled) {
    console.info(STALL_LOG, { txid: txid.slice(0, 16), lowFee, longWait, replaceable: rep.bip125Replaceable });
  }

  return { stalled, usedRpc: false, replaceability: rep, reason };
}

export type RpcBumpFeeSuccess = {
  txid: string;
  /** Replacement raw hex when Core returns it (depends on version / options). */
  hex?: string;
  origFee?: number;
  fee?: number;
  raw: unknown;
};

export type RpcBumpFeeResult =
  | { ok: true; data: RpcBumpFeeSuccess }
  | { ok: false; error: string };

/**
 * Wallet RPC `bumpfee` via the same-origin proxy. Requires the tx to be tracked by the node's wallet.
 */
export async function rpcBumpFee(
  txid: string,
  options?: Record<string, unknown>,
): Promise<RpcBumpFeeResult> {
  const creds = rpcCredsOrNull();
  if (!creds) {
    return { ok: false, error: 'RPC not configured in Wallet Settings.' };
  }
  const params = options && Object.keys(options).length > 0 ? [txid, options] : [txid];
  const r = await rpcViaProxyDetailed<Record<string, unknown>>('bumpfee', params, creds);
  if (!r.ok) {
    return { ok: false, error: r.error };
  }
  const res = r.result;
  if (!res || typeof res !== 'object') {
    return { ok: false, error: 'bumpfee returned an unexpected result' };
  }
  const newId = res.txid;
  if (typeof newId !== 'string' || newId.length !== 64) {
    return { ok: false, error: 'bumpfee did not return a valid txid' };
  }
  const hex = typeof res.hex === 'string' ? res.hex : undefined;
  const origFee = typeof res.origfee === 'number' ? res.origfee : undefined;
  const fee = typeof res.fee === 'number' ? res.fee : undefined;
  return { ok: true, data: { txid: newId, hex, origFee, fee, raw: res } };
}

/**
 * Fetch non-wallet raw hex for a tx (confirmed or mempool).
 */
export async function rpcGetRawTransactionHex(txid: string): Promise<string | null> {
  const creds = rpcCredsOrNull();
  const r = await rpcViaProxyDetailed<string>('getrawtransaction', [txid, false], creds);
  return r.ok && typeof r.result === 'string' && r.result.length > 0 ? r.result : null;
}
