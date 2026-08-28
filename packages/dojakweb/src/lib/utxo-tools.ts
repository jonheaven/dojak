/**
 * utxo-tools.ts
 *
 * UTXO management for the dojakweb browser wallet.
 * Handles:
 *   - Fetching ALL UTXOs (plain + inscribed) via Core RPC or wallet data provider (MyDoge first) + inscription tags
 *   - Persistent per-address lock registry (localStorage)
 *   - Auto-lock suggestion for inscription UTXOs
 *   - Fee estimation for merge/split
 *   - Building + signing merge transactions (doge-sdk)
 *   - Building + signing split transactions (doge-sdk)
 *   - Broadcasting via Wallet Settings order (default RPC → Tatum → BlockCypher → …; verified propagation)
 */

import * as bitcoin from 'bitcoinjs-lib';
import { createP2PKHTransaction, DogeMemoryWallet } from 'doge-sdk';
import { browserRpcProxyAbsoluteUrl, rpcViaProxy, rpcViaProxyDetailed } from './rpc-proxy-client';
import { broadcastHexViaCommandDog, getCommandDogApiBaseUrl, walletDataApi } from '../utils/api';
import {
  preflightDogecoinRpcMempoolAccept,
  resolveCanonicalDogeTxidFromRelay,
  waitForBroadcastPropagationVerified,
} from './broadcast/dogecoinTxBroadcast';
import { HARD_DUST_KOINU, SOFT_DUST_KOINU, softDustFeePenaltyKoinu } from './dogecoin/softDust';
import { enrichUtxosWithDogexDunes } from './duneOutpointGuard';

// ── Constants ─────────────────────────────────────────────────────────────────

const BLOCKCHAIR_URL = 'https://api.blockchair.com/dogecoin';
const LOCKED_UTXOS_KEY_PREFIX = 'dojakweb-locked-utxos-';
const BROADCAST_CONFIG_KEY = 'dojakweb-broadcast-config';

/** Hard dust / Doginals carrier floor (0.001 Ð). Soft dust is SOFT_DUST_KOINU (0.01 Ð). */
export const DUST_LIMIT = HARD_DUST_KOINU;
/** Same as hard dust — common doginals inscription carrier; auto-lock even without indexer hit. */
export const INSCRIPTION_LIKELY_UTXO_KOINU = DUST_LIMIT;

/**
 * Fallback floor only (10× Core min-relay). Prefer
 * `enforceBroadcastFeeRateKoinuPerByte` before any broadcast.
 */
export const FEE_RATE_KOINU_PER_BYTE = 1000; // koinu / byte fallback — NOT a safe broadcast rate
/** @deprecated use FEE_RATE_KOINU_PER_BYTE */
export const FEE_RATE_SATS_PER_BYTE = FEE_RATE_KOINU_PER_BYTE;
/** Floor: always pay at least this even for tiny transactions. */
export const MIN_RELAY_FEE = HARD_DUST_KOINU;

// ── Types ─────────────────────────────────────────────────────────────────────

/** A fully-enriched UTXO as managed by dojakweb. */
/** Ðune balances on this outpoint (dogex). Empty = checked, none. Absent = not enriched. */
export type ManagedUtxoDune = {
  duneId: string;
  amount: string;
  name?: string;
  spacedName?: string;
  symbol?: string;
  divisibility?: number;
};

export interface ManagedUtxo {
  txid: string;
  vout: number;
  /** Value in satoshis (koinu). */
  value: number;
  scriptPubKey: string;
  /**
   * Inscription IDs held in this output.
   * Empty array = plain DOGE, safe to spend freely.
   */
  inscriptions: string[];
  /**
   * dogex Ðune balances for this outpoint.
   * Empty = no Ðunes; undefined = indexer not queried / unknown.
   */
  dunes?: ManagedUtxoDune[];
  /**
   * User-locked. Locked UTXOs are excluded from coin-selection and
   * cannot be merged/split until explicitly unlocked.
   */
  locked: boolean;
  /**
   * Block confirmations from `listunspent` (Dogecoin Core). Omitted when
   * UTXOs come from Blockchair without this field.
   */
  confirmations?: number;
  /**
   * From Core `listunspent.spendable`. `false` = watch-only / cannot spend from this wallet.
   */
  rpcSpendable?: boolean;
}

export interface MergeFeeEstimate {
  feeSatoshis: number;
  inputCount: number;
  totalInputSatoshis: number;
  changeToWallet: number;
}

export interface SplitFeeEstimate {
  feeSatoshis: number;
  outputCount: number;
  totalOutputSatoshis: number;
}

export interface UtxoRef {
  txid: string;
  vout: number;
}

/**
 * `gettxout` via Wallet Settings RPC (includes mempool when third param is true).
 * `true` = UTXO exists, `false` = spent or missing, `null` = RPC not configured or call failed.
 */
export async function rpcGetTxOutSpendable(u: UtxoRef): Promise<boolean | null> {
  const cfg = loadBroadcastConfig();
  const url = cfg.rpcUrl?.trim();
  const user = cfg.rpcUser?.trim();
  const pass = cfg.rpcPass;
  const creds =
    browserRpcProxyAbsoluteUrl() && url && user && pass !== undefined && pass !== ''
      ? { rpcUrl: url, rpcUser: user, rpcPass: pass }
      : null;
  const canCd = typeof window !== 'undefined' && getCommandDogApiBaseUrl().trim().length > 0;
  try {
    if (typeof window !== 'undefined' && (browserRpcProxyAbsoluteUrl() || canCd)) {
      const r = await rpcViaProxyDetailed<any>('gettxout', [u.txid, u.vout, true], creds);
      if (!r.ok) return null;
      return r.result !== null;
    }
    if (!url || !user || pass === undefined || pass === '') return null;
    const auth = btoa(`${user}:${pass}`);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        jsonrpc: '1.0',
        id: 'utxo-tools',
        method: 'gettxout',
        params: [u.txid, u.vout, true],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (data?.error) return null;
    return data?.result !== null;
  } catch {
    return null;
  }
}

/**
 * Prefer command.dog `POST /v1/utxos/live` (batch Core gettxout). Fall back to
 * per-outpoint `/rpc/gettxout`. Never touches BlockCypher / Blockchair.
 * If Core is unreachable, returns `utxos` unchanged.
 */
export async function filterUtxosByRpcGetTxOutIfConfigured<T extends UtxoRef>(utxos: T[]): Promise<T[]> {
  if (utxos.length === 0) return utxos;
  const cfg = loadBroadcastConfig();
  const hasWalletRpc =
    Boolean(cfg.rpcUrl?.trim() && cfg.rpcUser?.trim() && cfg.rpcPass !== undefined && cfg.rpcPass !== '');
  const canCd = typeof window !== 'undefined' && getCommandDogApiBaseUrl().trim().length > 0;
  if (!hasWalletRpc && !canCd) return utxos;

  if (canCd) {
    const batched = await filterUtxosViaCommandDogLive(utxos);
    if (batched != null) return batched;
  }

  const kept: T[] = [];
  let dropped = 0;
  for (const u of utxos) {
    const rpc = await rpcGetTxOutSpendable(u);
    if (rpc === false) {
      dropped++;
      continue;
    }
    kept.push(u);
  }
  if (dropped > 0) {
    console.info(`[utxo-tools] filterUtxosByRpcGetTxOut: dropped ${dropped} stale/spent vs node`);
  }
  return kept;
}

/** Returns null when the batch endpoint is unavailable so callers can fall back. */
async function filterUtxosViaCommandDogLive<T extends UtxoRef>(utxos: T[]): Promise<T[] | null> {
  const base = getCommandDogApiBaseUrl().trim().replace(/\/+$/, '');
  if (!base) return null;
  try {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer =
      ctrl && typeof window !== 'undefined'
        ? window.setTimeout(() => ctrl.abort(), 20_000)
        : null;
    const res = await fetch(`${base}/v1/utxos/live`, {
      method: 'POST',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outpoints: utxos.map((u) => ({
          txid: String(u.txid).trim().toLowerCase(),
          vout: u.vout,
        })),
      }),
      signal: ctrl?.signal,
    });
    if (timer != null) window.clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      live?: Array<{ txid?: string; vout?: number }>;
      spent?: Array<{ txid?: string; vout?: number }>;
    };
    if (!Array.isArray(data?.live)) return null;
    const liveKeys = new Set(
      data.live
        .map((r) => {
          const t = String(r?.txid ?? '')
            .trim()
            .toLowerCase();
          const v = Number(r?.vout);
          return /^[0-9a-f]{64}$/.test(t) && Number.isFinite(v) ? `${t}:${v}` : '';
        })
        .filter(Boolean),
    );
    const kept = utxos.filter((u) =>
      liveKeys.has(`${String(u.txid).trim().toLowerCase()}:${u.vout}`),
    );
    const dropped = utxos.length - kept.length;
    if (dropped > 0) {
      console.info(
        `[utxo-tools] /v1/utxos/live: dropped ${dropped} spent/missing (Core gettxout); kept ${kept.length}`,
      );
    }
    return kept;
  } catch {
    return null;
  }
}

// ── Lock registry ─────────────────────────────────────────────────────────────

/** Load the set of locked UTXO keys (`"txid:vout"`) for an address. */
export function loadLockedUtxos(address: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(`${LOCKED_UTXOS_KEY_PREFIX}${address}`);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

/** Persist the lock registry for an address. */
export function saveLockedUtxos(address: string, locked: Set<string>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    `${LOCKED_UTXOS_KEY_PREFIX}${address}`,
    JSON.stringify([...locked]),
  );
}

/** Toggle lock state for one UTXO. Returns `true` if now locked, `false` if unlocked. */
export function toggleUtxoLock(address: string, txid: string, vout: number): boolean {
  const key = `${txid}:${vout}`;
  const locked = loadLockedUtxos(address);
  const nowLocked = !locked.has(key);
  if (nowLocked) locked.add(key);
  else locked.delete(key);
  saveLockedUtxos(address, locked);
  return nowLocked;
}

/** Lock a UTXO (idempotent). */
export function lockUtxo(address: string, txid: string, vout: number): void {
  const locked = loadLockedUtxos(address);
  locked.add(`${txid}:${vout}`);
  saveLockedUtxos(address, locked);
}

/** Unlock a UTXO (idempotent). */
export function unlockUtxo(address: string, txid: string, vout: number): void {
  const locked = loadLockedUtxos(address);
  locked.delete(`${txid}:${vout}`);
  saveLockedUtxos(address, locked);
}

/** Auto-lock inscription-bearing UTXOs and 0.001 DOGE outputs (likely inscription carriers). */
export function autoLockInscriptionUtxos(address: string, utxos: ManagedUtxo[]): number {
  const locked = loadLockedUtxos(address);
  let count = 0;
  for (const u of utxos) {
    const key = `${u.txid}:${u.vout}`;
    const hasIndexerInscription = u.inscriptions.length > 0;
    const likelyInscriptionCarrier = u.value === INSCRIPTION_LIKELY_UTXO_KOINU;
    if (hasIndexerInscription || likelyInscriptionCarrier) {
      if (!locked.has(key)) {
        locked.add(key);
        count++;
      }
    }
  }
  if (count > 0) saveLockedUtxos(address, locked);
  return count;
}

// ── UTXO fetch ────────────────────────────────────────────────────────────────

/**
 * Where the UTXO *list* (txid/vout/value) came from — inscription tags still use the wallet data API.
 * 'dogecoin-core-rpc' → RPC returned UTXOs for this address (includes mempool/0-conf)
 * 'mydoge'            → configured wallet data provider `/utxos/` (MyDoge by default)
 * Legacy explorer ids kept for UI type compat only (no longer returned by fetch).
 */
export type UtxoListSource =
  | 'dogecoin-core-rpc'
  | 'mydoge'
  | 'blockchair'
  | 'blockchair-rpc-no-index'
  | 'blockcypher'
  | 'tatum';

/**
 * Fetch ALL UTXOs for an address via Core RPC (if authoritative) or the wallet data provider.
 * Cross-reference against the inscription list to tag inscription-bearing outs.
 * Enrich with dogex Ðune outpoint balances (Coins & UTXOs).
 * Lock status is applied from localStorage automatically.
 */
export async function fetchAllAddressUtxosWithMeta(
  address: string,
): Promise<{ utxos: ManagedUtxo[]; source: UtxoListSource }> {
  const cfg = loadBroadcastConfig();

  // Inscription outputs: primary wallet data provider + optional InuBits merge (see wallet settings)
  let inscriptionOutputs = new Set<string>();
  const inscriptionByOutput = new Map<string, string>();
  try {
    const list = await walletDataApi.fetchInscriptions(address);
    for (const ins of list) {
      const raw = ins.output || ins.location;
      if (!raw) continue;
      const parts = raw.split(':');
      if (parts.length < 2) continue;
      const tx = parts[0]?.trim().toLowerCase() ?? '';
      const v = parts[parts.length - 1] ?? '';
      const key = `${tx}:${v}`;
      inscriptionOutputs.add(key);
      inscriptionByOutput.set(key, String(ins.inscriptionId ?? key));
    }
  } catch {
    /* non-fatal */
  }

  const locked = loadLockedUtxos(address);

  // ── Primary: Dogecoin Core RPC (only when it returns UTXOs for this address) ─
  const rpcUtxos = await fetchUtxosViaRpc(address, cfg);
  if (rpcUtxos !== null) {
    // RPC succeeded (listunspent OR scantxoutset) — trust the result even if empty.
    console.log(`[utxo-tools] RPC authoritative: ${rpcUtxos.length} UTXOs`);
    let utxos = rpcUtxos.map(u => {
      const key = `${u.txid}:${u.vout}`;
      return {
        ...u,
        inscriptions: inscriptionOutputs.has(key) ? [inscriptionByOutput.get(key) ?? key] : [],
        locked: locked.has(key),
      };
    });
    try {
      utxos = await enrichUtxosWithDogexDunes(utxos);
    } catch {
      /* non-fatal — manager still shows inscriptions */
    }
    return { utxos, source: 'dogecoin-core-rpc' };
  }

  const rpcWasConfigured = !!(cfg.rpcUser && cfg.rpcPass && cfg.rpcUrl);
  console.log(
    rpcWasConfigured
      ? '[utxo-tools] RPC available but address not in wallet and addressindex not enabled — wallet data provider'
      : '[utxo-tools] RPC not configured — wallet data provider',
  );

  // ── Wallet data provider (MyDoge by default; no Blockchair/BlockCypher) ──
  const providerRows = await walletDataApi.fetchUtxosPaginated(address);
  let utxos = providerRows.map((u) => {
    const key = `${u.txid}:${u.vout}`;
    return {
      txid: u.txid,
      vout: u.vout,
      value: u.value,
      scriptPubKey: u.scriptPubKey ?? '',
      inscriptions: inscriptionOutputs.has(key) ? [inscriptionByOutput.get(key) ?? key] : [],
      locked: locked.has(key),
      confirmations: u.confirmations,
      rpcSpendable: undefined,
    };
  });
  try {
    utxos = await enrichUtxosWithDogexDunes(utxos);
  } catch {
    /* non-fatal */
  }
  console.log(`[utxo-tools] wallet data provider: ${utxos.length} UTXOs`);
  return { utxos, source: 'mydoge' };
}

export async function fetchAllAddressUtxos(address: string): Promise<ManagedUtxo[]> {
  const { utxos } = await fetchAllAddressUtxosWithMeta(address);
  return utxos;
}

// ── Fee estimation ────────────────────────────────────────────────────────────

/** P2PKH tx-size estimate: 10 base + 148/input + 34/output bytes. */
function estimateTxSize(inputs: number, outputs: number): number {
  return 10 + inputs * 148 + outputs * 34;
}

/** Estimate merge fee for N plain UTXOs → 1 output. */
export function estimateMergeFee(inputCount: number): number {
  return Math.max(MIN_RELAY_FEE, estimateTxSize(inputCount, 1) * FEE_RATE_KOINU_PER_BYTE);
}

/** Estimate split fee for 1 UTXO → N outputs (includes soft-dust penalties). */
export function estimateSplitFee(outputCount: number, outputValues?: number[]): number {
  const sizeFee = Math.max(MIN_RELAY_FEE, estimateTxSize(1, outputCount) * FEE_RATE_KOINU_PER_BYTE);
  // Prefer soft-dust-safe outs; if caller creates hard-dust (0.001) carriers, add +0.01 each.
  const values = outputValues ?? Array.from({ length: outputCount }, () => SOFT_DUST_KOINU);
  return sizeFee + softDustFeePenaltyKoinu(values);
}

export function buildMergeFeeEstimate(utxos: ManagedUtxo[]): MergeFeeEstimate {
  const totalInput = utxos.reduce((s, u) => s + u.value, 0);
  const fee = estimateMergeFee(utxos.length);
  return {
    feeSatoshis: fee,
    inputCount: utxos.length,
    totalInputSatoshis: totalInput,
    changeToWallet: totalInput - fee,
  };
}

export function buildSplitFeeEstimate(
  utxo: ManagedUtxo,
  outputSatoshis: number[],
): SplitFeeEstimate {
  const fee = estimateSplitFee(outputSatoshis.length, outputSatoshis);
  return {
    feeSatoshis: fee,
    outputCount: outputSatoshis.length,
    totalOutputSatoshis: outputSatoshis.reduce((s, v) => s + v, 0),
  };
}

/**
 * Slack (koinu) allowed between policy fee and leftover when no change output is created.
 * Anything larger must come back as change — never silent miner donation.
 */
const SPLIT_FEE_SLACK_KOINU = 10_000;

/**
 * Custom split: requested dummy/payment outs, plus change when leftover ≥ hard dust.
 * Refuses to broadcast a split that would leave more than a dust-slack as miner fee.
 */
export function planSplitOutputs(
  inputValue: number,
  requested: number[],
): { outputs: number[]; feeSatoshis: number; changeSatoshis: number } {
  if (requested.length < 2) {
    throw new Error('Split must produce at least 2 outputs.');
  }
  const underDust = requested.filter((v) => v < DUST_LIMIT);
  if (underDust.length > 0) {
    throw new Error(
      `All outputs must be ≥ ${(DUST_LIMIT / 1e8).toFixed(3)} DOGE (dust limit). ` +
        `Found ${underDust.length} under-limit output(s).`,
    );
  }
  const requestedSum = requested.reduce((s, v) => s + v, 0);
  if (requestedSum <= 0) {
    throw new Error('Split outputs must sum to more than 0.');
  }

  let change = Math.max(0, inputValue - requestedSum - DUST_LIMIT);
  for (let i = 0; i < 4; i++) {
    const changeHint = Math.max(change, DUST_LIMIT);
    const fee = estimateSplitFee(requested.length + 1, [...requested, changeHint]);
    change = inputValue - requestedSum - fee;
  }

  if (change >= DUST_LIMIT) {
    const outputs = [...requested, change];
    const feeSatoshis = inputValue - outputs.reduce((s, v) => s + v, 0);
    if (feeSatoshis < 0) {
      throw new Error(
        `Outputs (${(requestedSum / 1e8).toFixed(4)} DOGE) + fee exceed input (${(inputValue / 1e8).toFixed(4)} DOGE).`,
      );
    }
    return { outputs, feeSatoshis, changeSatoshis: change };
  }

  const policyFee = estimateSplitFee(requested.length, requested);
  const leftover = inputValue - requestedSum;
  if (leftover < policyFee) {
    throw new Error(
      `Outputs (${(requestedSum / 1e8).toFixed(4)} DOGE) + fee (${(policyFee / 1e8).toFixed(4)} DOGE) ` +
        `exceed input (${(inputValue / 1e8).toFixed(4)} DOGE).`,
    );
  }
  if (leftover > policyFee + SPLIT_FEE_SLACK_KOINU) {
    throw new Error(
      `This split would pay ${(leftover / 1e8).toFixed(4)} Ð as miner fee instead of returning change. ` +
        `Nudge an amount so leftover change is ≥ 0.001 Ð, or use Equal split.`,
    );
  }
  return { outputs: requested, feeSatoshis: leftover, changeSatoshis: 0 };
}

/** Divide a UTXO value into N equal chunks (minus fee). Returns amounts in satoshis. */
export function calcEqualSplitOutputs(utxo: ManagedUtxo, count: number): number[] {
  if (count < 2) throw new Error('Need at least 2 outputs for a split');
  // Soft-dust-safe plain splits — each out ≥ 0.01 Ð so the split itself mines.
  const fee = estimateSplitFee(count, Array.from({ length: count }, () => SOFT_DUST_KOINU));
  const spendable = utxo.value - fee;
  if (spendable < count * SOFT_DUST_KOINU) {
    throw new Error(
      `Insufficient value to split into ${count} soft-dust-safe outputs after fee. ` +
      `Each output must be ≥ ${(SOFT_DUST_KOINU / 1e8).toFixed(3)} DOGE (Dogecoin soft dust).`,
    );
  }
  const base = Math.floor(spendable / count);
  const outputs = Array(count).fill(base);
  outputs[0] += spendable % count; // add remainder to first
  return outputs;
}

// ── Broadcast config (mirrors lib/broadcast/dogecoinTxBroadcast.ts) ────────────────────

type UtxoBroadcastRelay = 'rpc' | 'blockchair' | 'blockcypher' | 'tatum' | 'commanddog';

interface BroadcastConfig {
  broadcastProvider: 'auto' | 'blockchair' | 'blockcypher' | 'rpc' | 'tatum' | 'commanddog';
  broadcastPriority?: Array<'rpc' | 'blockchair' | 'blockcypher' | 'tatum' | 'commanddog'>;
  rpcUrl: string;
  rpcUser: string;
  rpcPass: string;
  tatumApiKey?: string;
}

function normalizeUtxoBroadcastPriority(priority: unknown): UtxoBroadcastRelay[] {
  /** Match Wallet Settings / dogecoinTxBroadcast: command.dog → Core RPC. Never auto-append
   *  BlockCypher / Tatum / Blockchair — their `/txs/push` can return a txid that never
   *  exists on our node or SoChain. */
  const allowed: UtxoBroadcastRelay[] = ['rpc', 'tatum', 'blockcypher', 'blockchair', 'commanddog'];
  const studioDefault: UtxoBroadcastRelay[] = ['commanddog', 'rpc'];
  const input = Array.isArray(priority) ? priority : [];
  const picked = input.filter((item): item is UtxoBroadcastRelay =>
    typeof item === 'string' && allowed.includes(item as UtxoBroadcastRelay)
  );
  const unique = [...new Set(picked)];
  for (const item of studioDefault) {
    if (!unique.includes(item)) unique.push(item);
  }
  return unique;
}

/** Legacy single-relay selection → that relay first, then saved order. */
function resolvedUtxoBroadcastOrder(cfg: BroadcastConfig): UtxoBroadcastRelay[] {
  const base = normalizeUtxoBroadcastPriority(cfg.broadcastPriority);
  const p = cfg.broadcastProvider;
  if (p === 'auto') return base;
  if (p === 'tatum' && !cfg.tatumApiKey?.trim()) return base;
  if (p !== 'rpc' && p !== 'blockchair' && p !== 'blockcypher' && p !== 'tatum' && p !== 'commanddog') return base;
  const pinned = p as UtxoBroadcastRelay;
  const rest = base.filter((x) => x !== pinned);
  return [pinned, ...rest];
}

function loadBroadcastConfig(): BroadcastConfig {
  const defaults: BroadcastConfig = {
    broadcastProvider: 'auto',
    rpcUrl: 'http://127.0.0.1:22555',
    rpcUser: '',
    rpcPass: '',
    tatumApiKey: '',
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(BROADCAST_CONFIG_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

/**
 * Thin RPC call helper — tries the browser proxy first, then direct fetch.
 * Returns `null` on any error (caller decides how to handle).
 */
async function rpcCall<T>(method: string, params: unknown[], cfg: BroadcastConfig): Promise<T | null> {
  try {
    if (browserRpcProxyAbsoluteUrl()) {
      return await rpcViaProxy<T>(method, params, {
        rpcUrl: cfg.rpcUrl,
        rpcUser: cfg.rpcUser,
        rpcPass: cfg.rpcPass,
      });
    }
    const auth = btoa(`${cfg.rpcUser}:${cfg.rpcPass}`);
    const res = await fetch(cfg.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify({ jsonrpc: '1.0', id: 'utxo-tools', method, params }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data || data.error != null) return null;
    return data.result as T;
  } catch {
    return null;
  }
}

/**
 * Fetch UTXOs for an address via Dogecoin Core RPC.
 *
 * Dogecoin Core 1.14.x does NOT have `scantxoutset` (Bitcoin Core 0.17+ only).
 * Two strategies are tried in order:
 *
 * 1. `listunspent [0, 9999999, [address]]`
 *    Works when the address is in the Core wallet (generated or importaddress'd).
 *    Returns 0-conf mempool UTXOs too.
 *
 * 2. `getaddressutxos {addresses: [address]}`  +  `getaddressmempool {addresses: [address]}`
 *    Works when Dogecoin Core is started with `-addressindex=1` in dogecoin.conf.
 *    Returns confirmed UTXOs + pending mempool outputs for ANY address.
 *    Add to dogecoin.conf:  addressindex=1
 *    Then restart Core and let it reindex (one-time, takes ~30 min).
 *
 * Returns null if neither strategy works (wallet data provider will be used).
 */
async function fetchUtxosViaRpc(address: string, cfg: BroadcastConfig): Promise<ManagedUtxo[] | null> {
  if (!cfg.rpcUser || !cfg.rpcPass || !cfg.rpcUrl) return null;

  try {
    // ── Strategy 1: listunspent ────────────────────────────────────────────────
    // Fast; requires address to be in the Core wallet.
    const listResult = await rpcCall<unknown[]>('listunspent', [0, 9999999, [address]], cfg);
    if (Array.isArray(listResult) && listResult.length > 0) {
      console.log(`[utxo-tools] listunspent: ${listResult.length} UTXOs`);
      return listResult.map((u: any) => ({
        txid: String(u.txid),
        vout: Number(u.vout),
        value: Math.round(Number(u.amount) * 1e8),
        scriptPubKey: String(u.scriptPubKey ?? ''),
        inscriptions: [],
        locked: false,
        confirmations: typeof u.confirmations === 'number' ? u.confirmations : undefined,
        rpcSpendable: typeof u.spendable === 'boolean' ? u.spendable : undefined,
      }));
    }

    // ── Strategy 2: getaddressutxos (requires -addressindex=1) ────────────────
    // Works for any address. Add `addressindex=1` to dogecoin.conf and reindex.
    console.log('[utxo-tools] listunspent returned 0 — trying getaddressutxos (addressindex)');
    const addrUtxos = await rpcCall<any[]>(
      'getaddressutxos',
      [{ addresses: [address] }],
      cfg,
    );

    if (!Array.isArray(addrUtxos)) {
      // getaddressutxos not supported (addressindex not enabled) — nothing more to try
      console.warn(
        '[utxo-tools] getaddressutxos unavailable. ' +
        'Add `addressindex=1` to dogecoin.conf and reindex to enable RPC UTXO lookup for browser wallet addresses. ' +
        'Falling back to wallet data provider.',
      );
      return null;
    }

    // getaddressutxos succeeded — also fetch mempool outputs for 0-conf visibility
    const blockCount = await rpcCall<number>('getblockcount', [], cfg);
    console.log(`[utxo-tools] getaddressutxos: ${addrUtxos.length} confirmed UTXOs, tip=${blockCount}`);

    const confirmed: ManagedUtxo[] = addrUtxos.map((u: any) => {
      const height = typeof u.height === 'number' ? u.height : null;
      const confirmations = blockCount !== null && height !== null
        ? Math.max(0, blockCount - height + 1)
        : undefined;
      return {
        txid: String(u.txid),
        vout: Number(u.outputIndex ?? u.vout ?? 0),
        value: Number(u.satoshis ?? u.value ?? 0),
        scriptPubKey: String(u.script ?? u.scriptPubKey ?? ''),
        inscriptions: [],
        locked: false,
        confirmations,
        rpcSpendable: true,
      };
    });

    // Supplement with mempool (pending) outputs for this address
    let mempool: ManagedUtxo[] = [];
    try {
      const mempoolResult = await rpcCall<any[]>(
        'getaddressmempool',
        [{ addresses: [address] }],
        cfg,
      );
      if (Array.isArray(mempoolResult)) {
        // mempoolResult entries: {address, txid, index, satoshis, timestamp, prevtxid, prevout}
        // Positive satoshis = incoming (new output), negative = spend
        const incomingKeys = new Set(
          confirmed.map((u) => `${u.txid}:${u.vout}`),
        );
        for (const m of mempoolResult) {
          const sats = Number(m.satoshis ?? 0);
          if (sats <= 0) continue; // outgoing spend — skip
          const key = `${String(m.txid)}:${Number(m.index ?? 0)}`;
          if (incomingKeys.has(key)) continue; // already confirmed
          mempool.push({
            txid: String(m.txid),
            vout: Number(m.index ?? 0),
            value: sats,
            scriptPubKey: '',
            inscriptions: [],
            locked: false,
            confirmations: 0, // mempool = 0 confirmations
            rpcSpendable: true,
          });
        }
        if (mempool.length > 0) {
          console.log(`[utxo-tools] getaddressmempool: +${mempool.length} pending UTXOs`);
        }
      }
    } catch {
      /* mempool supplement is non-fatal */
    }

    return [...confirmed, ...mempool];
  } catch {
    return null;
  }
}

async function broadcastViaRpc(rawHex: string, cfg: BroadcastConfig): Promise<string> {
  if (!cfg.rpcUrl || !cfg.rpcUser || !cfg.rpcPass) {
    throw new Error('RPC is not configured (missing URL/user/password).');
  }
  await preflightDogecoinRpcMempoolAccept(rawHex);
  if (browserRpcProxyAbsoluteUrl()) {
    // Use detailed proxy result so we preserve the actual Core error (instead of opaque "no txid").
    const r = await rpcViaProxyDetailed<string>('sendrawtransaction', [rawHex], {
      rpcUrl: cfg.rpcUrl,
      rpcUser: cfg.rpcUser,
      rpcPass: cfg.rpcPass,
    });
    if (!r.ok) throw new Error(`RPC error: ${r.error}`);
    const txid = r.result;
    if (!txid || typeof txid !== 'string') throw new Error('RPC returned no txid');
    return txid;
  }
  const auth = btoa(`${cfg.rpcUser}:${cfg.rpcPass}`);
  const res = await fetch(cfg.rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify({ jsonrpc: '1.0', id: 'utxo-tools', method: 'sendrawtransaction', params: [rawHex] }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = String(data?.error?.message ?? data?.message ?? `HTTP ${res.status}`);
    throw new Error(`RPC error: ${msg}`);
  }
  if (data.error) throw new Error(`RPC error: ${data.error.message ?? JSON.stringify(data.error)}`);
  if (!data.result) throw new Error('RPC returned no txid');
  return data.result as string;
}

async function broadcastViaBlockchair(rawHex: string): Promise<string> {
  const res = await fetch(`${BLOCKCHAIR_URL}/push/transaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${rawHex}`,
  });
  const data = await res.json();
  if (data?.data?.transaction_hash) return data.data.transaction_hash as string;
  throw new Error(data?.context?.error ?? `Blockchair broadcast failed (${res.status})`);
}

function localTxidFromRawHex(rawHex: string): string {
  try {
    return bitcoin.Transaction.fromHex(rawHex).getId();
  } catch {
    return '';
  }
}

function classifyBlockcypherBroadcastError(msg: string): 'already' | 'spent' | 'missing' | 'invalid' | null {
  const m = msg.toLowerCase();
  if (
    m.includes('already in block chain') ||
    m.includes('already in blockchain') ||
    m.includes('already exists') ||
    m.includes('already known') ||
    m.includes('txn-already-known') ||
    m.includes('transaction already in block chain')
  )
    return 'already';
  if (
    m.includes('mandatory-script-verify') ||
    m.includes('script failed') ||
    m.includes('non-standard') ||
    m.includes('bad-txns') ||
    m.includes('error validating transaction') ||
    m.includes('invalid opcode') ||
    (m.includes('signature') && (m.includes('invalid') || m.includes('failed') || m.includes('high-s')))
  )
    return 'invalid';
  if (
    m.includes('has already been spent') ||
    m.includes('already spent') ||
    m.includes('missing inputs') ||
    m.includes('txn-mempool-conflict') ||
    m.includes('bad-txns-inputs-spent') ||
    m.includes('inputs missing') ||
    m.includes('orphaned')
  )
    return m.includes('missing inputs') || m.includes('inputs missing') || m.includes('orphaned') ? 'missing' : 'spent';
  return null;
}

function formatBlockcypherPushError(data: unknown, httpStatus: number, rawText: string): string {
  const parts: string[] = [];
  if (httpStatus) parts.push(`HTTP ${httpStatus}`);
  if (rawText?.trim()) {
    try {
      const j = JSON.parse(rawText) as Record<string, unknown>;
      const e0 = j?.error;
      const errStr =
        typeof e0 === 'string'
          ? e0
          : e0 != null && typeof e0 === 'object' && 'error' in e0
            ? String((e0 as { error?: string }).error ?? '')
            : '';
      const arr = j?.errors as Array<{ error?: string }> | undefined;
      const fromArr = Array.isArray(arr) ? arr.map((x) => x?.error).filter(Boolean).join('; ') : '';
      const merged = [errStr, fromArr].filter(Boolean).join('; ');
      if (merged) parts.push(merged);
      else if (Object.keys(j).length) parts.push(JSON.stringify(j));
    } catch {
      parts.push(rawText.trim());
    }
  } else if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    const e0 = d.error;
    const top =
      typeof e0 === 'string'
        ? e0
        : e0 != null && typeof e0 === 'object' && 'error' in e0
          ? String((e0 as { error?: string }).error ?? '')
          : '';
    const arr = d.errors as Array<{ error?: string }> | undefined;
    const fromArr = Array.isArray(arr) ? arr.map((x) => x?.error).filter(Boolean).join('; ') : '';
    const merged = [top, fromArr].filter(Boolean).join('; ');
    if (merged) parts.push(merged);
    else parts.push(JSON.stringify(data));
  }
  return parts.join(' — ') || 'BlockCypher push failed';
}

function isRpcMempoolConflictError(e: unknown): boolean {
  const s = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return s.includes('mempool-conflict') || s.includes('txn-mempool-conflict');
}

async function broadcastViaBlockCypher(
  rawHex: string,
  options?: { trustHttp409Duplicate?: boolean },
): Promise<string> {
  const trust409 = options?.trustHttp409Duplicate !== false;
  const localTxid = localTxidFromRawHex(rawHex);
  const res = await fetch('https://api.blockcypher.com/v1/doge/main/txs/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tx: rawHex }),
  });
  const rawText = await res.text();
  let data: Record<string, unknown> | null = null;
  try {
    data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
  } catch {
    data = null;
  }

  if (res.ok && data?.tx && typeof (data.tx as { hash?: string }).hash === 'string') {
    const apiTxid = (data.tx as { hash: string }).hash;
    if (localTxid && apiTxid.toLowerCase() !== localTxid.toLowerCase()) {
      throw new Error(`BlockCypher returned unexpected txid: ${apiTxid} (expected ${localTxid})`);
    }
    return apiTxid;
  }

  const errMsg = formatBlockcypherPushError(data, res.status, rawText);
  const looksAlready = classifyBlockcypherBroadcastError(errMsg) === 'already';

  if (res.status === 409 && localTxid) {
    if (!trust409) {
      throw new Error(
        'BlockCypher returned HTTP 409, but Dogecoin Core already rejected this transaction with a mempool conflict. ' +
          'That usually means the same UTXOs are tied up by another pending transaction (or you already submitted this buy). ' +
          'Refresh UTXOs in the UTXO manager, rebuild the buy PSDT, and wait a block if a prior submit is still clearing.',
      );
    }
    const k = classifyBlockcypherBroadcastError(errMsg);
    if (k === 'spent' || k === 'missing' || k === 'invalid') {
      throw new Error(errMsg || `BlockCypher rejected the transaction (${res.status})`);
    }
    if (looksAlready || k === 'already') return localTxid;
    const m = errMsg.toLowerCase();
    if (
      !m.includes('missing') &&
      !m.includes('spent') &&
      !m.includes('orphan') &&
      !m.includes('invalid') &&
      !m.includes('script') &&
      !m.includes('verify')
    ) {
      return localTxid;
    }
  }

  if (looksAlready && localTxid) return localTxid;

  const kind = classifyBlockcypherBroadcastError(errMsg);
  if (kind === 'spent' || kind === 'missing' || kind === 'invalid') {
    throw new Error(errMsg || `BlockCypher broadcast failed (${res.status})`);
  }

  throw new Error(errMsg || `BlockCypher broadcast failed (${res.status})`);
}

/**
 * Tatum REST: POST /v3/dogecoin/broadcast — requires `x-api-key` (Wallet Settings).
 * @see https://docs.tatum.io/reference/dogebroadcast
 */
async function broadcastViaTatum(rawHex: string, apiKey: string): Promise<string> {
  const key = apiKey.trim();
  if (!key) throw new Error('Tatum API key is missing.');
  const res = await fetch('https://api.tatum.io/v3/dogecoin/broadcast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
    },
    body: JSON.stringify({ txData: rawHex }),
  });
  const data = await res.json().catch(() => null);
  if (res.ok && data && typeof data.txId === 'string' && data.txId.length > 0) {
    return data.txId as string;
  }
  const msg =
    data && (data.message || data.errorCode)
      ? [data.errorCode, data.message].filter(Boolean).join(': ')
      : JSON.stringify(data);
  throw new Error(`Tatum broadcast failed (${res.status}): ${msg || res.statusText}`);
}

/**
 * Guard against stale/mempool-spent coin selection right before signing/broadcast.
 * Throws if a UTXO is definitely spent. If status cannot be determined, returns silently.
 */
export async function assertUtxosCurrentlyUnspent(utxos: UtxoRef[]): Promise<void> {
  if (utxos.length === 0) return;

  const checkViaBlockchair = async (u: UtxoRef): Promise<boolean | null> => {
    try {
      const txid = String(u.txid).trim().toLowerCase();
      const res = await fetch(
        `${BLOCKCHAIR_URL}/outputs?q=transaction_hash(${txid}),index(${u.vout})&fields=is_spent&limit=1`,
      );
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      const rows: any[] = Array.isArray(data?.data) ? data.data : [];
      if (rows.length === 0) return null;
      const spent = rows.some((r: any) => r?.is_spent === true || String(r?.is_spent).toLowerCase() === 'true');
      return !spent;
    } catch {
      return null;
    }
  };

  for (const u of utxos) {
    const rpc = await rpcGetTxOutSpendable(u);
    if (rpc === false) {
      throw new Error(
        `Input ${u.txid}:${u.vout} is already spent (or spent in mempool). Refresh UTXOs and pick a different input.`,
      );
    }
    if (rpc === true) continue;
    const chair = await checkViaBlockchair(u);
    if (chair === false) {
      throw new Error(
        `Input ${u.txid}:${u.vout} is already spent. Refresh UTXOs and pick a different input.`,
      );
    }
  }
}

/** Broadcast: Wallet Settings order + propagation verification (same as OP_RETURN / inscribe flows). */
export async function broadcastUtxoTx(rawHex: string): Promise<string> {
  const cfg = loadBroadcastConfig();
  const order = resolvedUtxoBroadcastOrder(cfg);
  /** If Core already said mempool-conflict, do not treat BlockCypher HTTP 409 as “duplicate success” (masks a bad buy). */
  let rpcRejectedWithMempoolConflict = false;

  const tryRelay = async (provider: UtxoBroadcastRelay): Promise<string> => {
    let relayTxid: string;
    if (provider === 'rpc') {
      relayTxid = await broadcastViaRpc(rawHex, cfg);
      console.log('[utxo-tools] RPC relay accepted', relayTxid);
    } else if (provider === 'blockchair') {
      relayTxid = await broadcastViaBlockchair(rawHex);
    } else if (provider === 'tatum') {
      relayTxid = await broadcastViaTatum(rawHex, cfg.tatumApiKey ?? '');
      console.log('[utxo-tools] Tatum relay accepted', relayTxid);
    } else if (provider === 'commanddog') {
      relayTxid = await broadcastHexViaCommandDog(rawHex);
      console.log('[utxo-tools] Command.dog relay accepted', relayTxid);
    } else {
      relayTxid = await broadcastViaBlockCypher(rawHex, {
        trustHttp409Duplicate: !rpcRejectedWithMempoolConflict,
      });
      console.log('[utxo-tools] BlockCypher relay accepted', relayTxid);
    }
    const { txid } = await resolveCanonicalDogeTxidFromRelay(relayTxid, rawHex);
    await waitForBroadcastPropagationVerified(txid);
    console.log('[utxo-tools] broadcast verified', { provider, txid });
    return txid;
  };

  const PUBLIC_RELAYS: UtxoBroadcastRelay[] = ['blockcypher', 'blockchair', 'tatum'];

  let lastError: unknown = null;
  for (const provider of order) {
    if (PUBLIC_RELAYS.includes(provider)) {
      console.warn(
        `[utxo-tools] skipping ${provider}: public push APIs return phantom txids; this eco broadcasts via command.dog → Core`,
      );
      continue;
    }
    if (provider === 'rpc' && (!cfg.rpcUser || !cfg.rpcPass || !cfg.rpcUrl)) {
      continue;
    }
    if (provider === 'tatum' && !cfg.tatumApiKey?.trim()) {
      continue;
    }
    try {
      const txid = await tryRelay(provider);
      walletDataApi.invalidateUtxos();
      return txid;
    } catch (e) {
      if (provider === 'rpc' && isRpcMempoolConflictError(e)) {
        rpcRejectedWithMempoolConflict = true;
      }
      lastError = e;
      console.warn(`[utxo-tools] ${provider} failed, trying next provider:`, e);
    }
  }

  const hint =
    'command.dog broadcast needs Dogecoin Core RPC on :22555 (dogecoin-qt running). ' +
    'Check with: dogecoin-cli getblockcount. Public relays (BlockCypher) are not used — they ack txids that never land.';
  if (lastError instanceof Error) {
    throw new Error(`${lastError.message} — ${hint}`);
  }
  throw new Error(`Broadcast failed. ${hint}`);
}

// ── Transaction building ──────────────────────────────────────────────────────

/**
 * Build, sign and return raw hex for a MERGE transaction.
 * All selected UTXOs must be plain (no inscriptions) and unlocked.
 * Change goes back to `toAddress`.
 */
export async function buildAndSignMergeTx(
  utxos: ManagedUtxo[],
  toAddress: string,
  privateKeyWif: string,
): Promise<{ rawHex: string; feeSatoshis: number; changeToWallet: number }> {
  if (utxos.length < 2) throw new Error('Select at least 2 UTXOs to merge.');

  const inscribed = utxos.filter(u => u.inscriptions.length > 0);
  if (inscribed.length > 0) {
    throw new Error(
      `${inscribed.length} selected UTXO(s) contain inscriptions and cannot be merged.`,
    );
  }
  const locked = utxos.filter(u => u.locked);
  if (locked.length > 0) {
    throw new Error(`${locked.length} selected UTXO(s) are locked.`);
  }

  const totalInput = utxos.reduce((s, u) => s + u.value, 0);
  const fee = estimateMergeFee(utxos.length);
  const changeToWallet = totalInput - fee;

  if (changeToWallet <= 0) {
    throw new Error(
      `Insufficient funds: total input (${(totalInput / 1e8).toFixed(4)} DOGE) ` +
      `is less than estimated fee (${(fee / 1e8).toFixed(4)} DOGE).`,
    );
  }

  const signer = DogeMemoryWallet.fromWIF(privateKeyWif, 'doge');
  const txBuilder = createP2PKHTransaction(signer, {
    address: toAddress,
    inputs: utxos.map(u => ({ txid: u.txid, vout: u.vout, value: u.value })),
    outputs: [{ address: toAddress, value: changeToWallet }],
  });

  const signed = await txBuilder.finalizeAndSign();
  return { rawHex: signed.toHex(), feeSatoshis: fee, changeToWallet };
}

/**
 * Build, sign and return raw hex for a SPLIT transaction.
 * The source UTXO must be plain and unlocked.
 * Outputs are sent back to `toAddress` (same address, just fragmented).
 */
export async function buildAndSignSplitTx(
  utxo: ManagedUtxo,
  outputSatoshis: number[],
  toAddress: string,
  privateKeyWif: string,
): Promise<{ rawHex: string; feeSatoshis: number; outputs: number[] }> {
  if (utxo.inscriptions.length > 0) {
    throw new Error('Cannot split an inscribed UTXO — it holds an asset.');
  }
  if (utxo.locked) {
    throw new Error('UTXO is locked. Unlock it first.');
  }
  if (outputSatoshis.length < 2) {
    throw new Error('Split must produce at least 2 outputs.');
  }

  const dust = outputSatoshis.filter(v => v < DUST_LIMIT);
  if (dust.length > 0) {
    throw new Error(
      `All outputs must be ≥ ${(DUST_LIMIT / 1e8).toFixed(3)} DOGE (dust limit). ` +
      `Found ${dust.length} under-limit output(s).`,
    );
  }

  const fee = estimateSplitFee(outputSatoshis.length, outputSatoshis);
  const totalOut = outputSatoshis.reduce((s, v) => s + v, 0);

  if (totalOut + fee > utxo.value) {
    throw new Error(
      `Outputs (${(totalOut / 1e8).toFixed(4)} DOGE) + fee (${(fee / 1e8).toFixed(4)} DOGE) ` +
      `exceed input (${(utxo.value / 1e8).toFixed(4)} DOGE).`,
    );
  }

  const impliedFee = utxo.value - totalOut;
  if (impliedFee > fee + SPLIT_FEE_SLACK_KOINU) {
    throw new Error(
      `Refusing split: leftover ${(impliedFee / 1e8).toFixed(4)} Ð would be miner fee, not change. ` +
        `Custom amounts must leave ≥ 0.001 Ð for a change output (or use Equal split).`,
    );
  }

  const signer = DogeMemoryWallet.fromWIF(privateKeyWif, 'doge');
  const txBuilder = createP2PKHTransaction(signer, {
    address: toAddress,
    inputs: [{ txid: utxo.txid, vout: utxo.vout, value: utxo.value }],
    outputs: outputSatoshis.map(v => ({ address: toAddress, value: v })),
  });

  const signed = await txBuilder.finalizeAndSign();
  return { rawHex: signed.toHex(), feeSatoshis: fee, outputs: outputSatoshis };
}
