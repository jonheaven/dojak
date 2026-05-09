// lib/broadcast/dogecoinTxBroadcast.ts
// Dogecoin raw-transaction broadcast (relay order, RPC preflight, propagation checks) and
// shared conservative UTXO selection for spends. Also builds/signs short DogeTag:tx (OP_RETURN)
// messages as standard OP_RETURN txs (separate from P2SH file-inscription chains).

import { createP2PKHTransaction, DogeMemoryWallet } from 'doge-sdk';
import { broadcastHexViaCommandDog, fetchCommandDogTxStatus, getCommandDogApiBaseUrl } from '../../utils/api';
import { browserRpcProxyAbsoluteUrl, rpcViaProxy, rpcViaProxyDetailed } from '../rpc-proxy-client';
import {
  buildOpReturnLockingScript,
  estimateOpReturnOutputsTxWeight,
  MAX_SCRIPT_ELEMENT_BYTES,
  utf8PayloadForDogetagMessage,
} from '../tx/opReturn';
import { planPaymentOutputsWithOptionalOpReturns } from '../tx/outputPlan';
import type { DogetagTip } from '../tx/types';

export type { DogetagTip } from '../tx/types';

// --------------------------------------------------------------------------
// Normalised UTXO shape (used internally)
// --------------------------------------------------------------------------

export interface NormalisedUtxo {
  tx_hash: string;
  tx_output_n: number;
  value: number; // satoshis
}

/**
 * 0.001 DOGE in koinu. UTXOs at exactly this value are almost always inscription
 * carriers on Dogecoin (the canonical Doginals dust amount). We NEVER spend them
 * in plain payment or OP_RETURN transactions to avoid destroying inscriptions.
 */
const INSCRIPTION_CARRIER_VALUE = 100_000; // koinu

/**
 * Absolute minimum fee rate we will ever use. Dogecoin's minimum relay fee is
 * 100 koinu/byte (0.001 DOGE/kB); using anything lower guarantees rejection.
 * Callers should prefer 1000 koinu/byte (10×) for reliable inclusion.
 */
export const MIN_FEE_RATE_KOINU_PER_BYTE = 100;

function normalizeOutpointKey(txid: string, vout: number): string {
  return `${txid.toLowerCase()}:${vout}`;
}

function filterExcludedUtxos(
  utxos: NormalisedUtxo[],
  excludedOutpoints?: string[],
): { spendable: NormalisedUtxo[]; excludedCount: number } {
  if (!excludedOutpoints?.length) {
    return { spendable: utxos, excludedCount: 0 };
  }

  const excludedSet = new Set(excludedOutpoints.map((o) => o.trim().toLowerCase()).filter(Boolean));
  const spendable = utxos.filter((u) => !excludedSet.has(normalizeOutpointKey(u.tx_hash, u.tx_output_n)));
  return { spendable, excludedCount: utxos.length - spendable.length };
}

/**
 * Strip inscription-likely UTXOs from a list before coin selection.
 *
 * A UTXO is considered inscription-likely (and therefore MUST NOT be spent in
 * any plain/OP_RETURN transaction) if ANY of the following is true:
 *
 *  1. Its value is exactly INSCRIPTION_CARRIER_VALUE (100 000 koinu = 0.001 DOGE).
 *     This is the canonical Doginals dust amount — nearly all Doginals live here.
 *
 *  2. It appears in the dojakweb per-address lock registry stored in localStorage
 *     (`dojakweb-locked-utxos-{address}`). The UTXO manager auto-locks outputs that
 *     are tagged by MyDoge / InuBits inscription indexers.
 *
 * Both checks are intentionally conservative: false positives (a plain 0.001 DOGE
 * UTXO gets skipped) waste a tiny amount of DOGE; false negatives (an inscription
 * carrier gets spent) permanently destroy an NFT. Always err on the side of safety.
 */
export function filterSafeSpendableUtxos(
  address: string,
  utxos: NormalisedUtxo[],
): { safe: NormalisedUtxo[]; skippedCount: number } {
  // Load the dojakweb lock registry for this address (populated by UTXO manager auto-lock + user locks).
  let lockedKeys = new Set<string>();
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(`dojakweb-locked-utxos-${address}`);
      if (raw) lockedKeys = new Set(JSON.parse(raw) as string[]);
    }
  } catch {
    /* non-fatal — proceed without registry */
  }

  const safe = utxos.filter((u) => {
    // Never spend 0.001 DOGE outputs — inscription carrier sentinel value.
    if (u.value === INSCRIPTION_CARRIER_VALUE) return false;
    // Never spend locked UTXOs (inscription-tagged or manually locked by user).
    if (lockedKeys.has(normalizeOutpointKey(u.tx_hash, u.tx_output_n))) return false;
    return true;
  });

  const skippedCount = utxos.length - safe.length;
  if (skippedCount > 0) {
    console.log(
      `[dojakweb:doge-tx] filterSafeSpendableUtxos: skipped ${skippedCount} inscription-likely UTXO(s) ` +
      `(value=0.001 DOGE or in lock registry) — will not be used as fee inputs.`,
    );
  }
  return { safe, skippedCount };
}

// --------------------------------------------------------------------------
// Blockchair UTXO fetch (primary — actually propagates to DOGE nodes)
// --------------------------------------------------------------------------

/**
 * Fetch spendable confirmed UTXOs from Blockchair.
 * Blockchair's output endpoint returns values in satoshis.
 */
async function fetchUtxosFromBlockchair(address: string): Promise<NormalisedUtxo[]> {
  const url =
    `https://api.blockchair.com/dogecoin/outputs` +
    `?q=recipient(${address}),is_spent(false)` +
    `&fields=transaction_hash,index,value,block_id` +
    `&limit=50&offset=0`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Blockchair UTXO fetch failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const rows: Array<{ transaction_hash: string; index: number; value: number; block_id: number | null }> =
    data?.data ?? [];

  console.log('[dojakweb:doge-tx] Blockchair UTXO response', {
    address,
    total: rows.length,
    confirmed: rows.filter(r => r.block_id !== null).length,
  });

  // block_id === null means unconfirmed — exclude those
  return rows
    .filter(r => r.block_id !== null)
    .map(r => ({ tx_hash: r.transaction_hash, tx_output_n: r.index, value: r.value }));
}

// --------------------------------------------------------------------------
// BlockCypher UTXO fetch (fallback)
// --------------------------------------------------------------------------

interface BlockCypherUtxo {
  tx_hash: string;
  tx_output_n: number;
  value: number; // always satoshis
  confirmations: number;
  script: string;
}

/**
 * Fetch spendable UTXOs from BlockCypher (fallback only).
 */
async function fetchUtxosFromBlockCypher(address: string): Promise<NormalisedUtxo[]> {
  const url =
    `https://api.blockcypher.com/v1/doge/main/addrs/${address}` +
    `?unspentOnly=true&includeScript=true&limit=100`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`BlockCypher UTXO fetch failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  console.log('[dojakweb:doge-tx] BlockCypher UTXO response', {
    address: data?.address,
    balance: data?.balance,
    txrefsCount: data?.txrefs?.length ?? 0,
  });
  const confirmed: BlockCypherUtxo[] = data?.txrefs ?? [];
  return confirmed
    .filter(u => u.confirmations >= 1)
    .map(u => ({ tx_hash: u.tx_hash, tx_output_n: u.tx_output_n, value: u.value }));
}

// --------------------------------------------------------------------------
// MyDoge API UTXOs — https://api.mydoge.com/utxos/<address>
// --------------------------------------------------------------------------

const MYDOGE_UTXO_API = 'https://api.mydoge.com/utxos';

interface MyDogeUtxoRow {
  txid: string;
  vout: number;
  satoshis: string | number;
  confirmations?: number;
}

/**
 * Spendable confirmed UTXOs from MyDoge’s indexer (inscription-aware, same source as MyDoge wallet).
 * @see https://api.mydoge.com/utxos/<address>
 */
async function fetchUtxosFromMyDogeApi(address: string): Promise<NormalisedUtxo[]> {
  const collected: NormalisedUtxo[] = [];
  let cursor: string | null | undefined = undefined;
  const maxPages = 25;

  for (let page = 0; page < maxPages; page++) {
    const base = `${MYDOGE_UTXO_API}/${encodeURIComponent(address)}`;
    const url =
      cursor == null || cursor === ''
        ? base
        : `${base}?cursor=${encodeURIComponent(String(cursor))}`;

    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`MyDoge UTXO fetch failed (${res.status}): ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      utxos?: MyDogeUtxoRow[];
      next_cursor?: string | null;
    };
    const rows: MyDogeUtxoRow[] = data?.utxos ?? [];

    console.log('[dojakweb:doge-tx] MyDoge UTXO response', {
      address: address.slice(0, 10) + '…',
      page,
      batch: rows.length,
    });

    for (const row of rows) {
      const conf = row.confirmations ?? 0;
      if (conf < 1) continue;
      const sat =
        typeof row.satoshis === 'string' ? parseInt(row.satoshis, 10) : Number(row.satoshis);
      if (!Number.isFinite(sat) || sat <= 0) continue;
      if (!row.txid || !Number.isInteger(row.vout) || row.vout < 0) continue;
      collected.push({
        tx_hash: row.txid,
        tx_output_n: row.vout,
        value: sat,
      });
    }

    const next = data?.next_cursor;
    if (next == null || next === '') break;
    cursor = next;
  }

  return collected;
}

function utxoOutpointKey(u: NormalisedUtxo): string {
  return `${u.tx_hash.toLowerCase()}:${u.tx_output_n}`;
}

/**
 * Coin selection for inscriptions: prefer [MyDoge API](https://api.mydoge.com/utxos/&lt;address&gt;)
 * intersected with Blockchair and/or BlockCypher so no single stale indexer can pick a spent output.
 */
export async function fetchSpendableUtxosConservativeForAddress(address: string): Promise<NormalisedUtxo[]> {
  const [myDoge, chair, cypher] = await Promise.all([
    fetchUtxosFromMyDogeApi(address).catch(() => [] as NormalisedUtxo[]),
    fetchUtxosFromBlockchair(address).catch(() => [] as NormalisedUtxo[]),
    fetchUtxosFromBlockCypher(address).catch(() => [] as NormalisedUtxo[]),
  ]);

  const chairK = new Set(chair.map(utxoOutpointKey));
  const cypherK = new Set(cypher.map(utxoOutpointKey));

  if (myDoge.length > 0) {
    let picked: NormalisedUtxo[];

    if (chair.length > 0 && cypher.length > 0) {
      picked = myDoge.filter(
        (u) => chairK.has(utxoOutpointKey(u)) && cypherK.has(utxoOutpointKey(u)),
      );
      if (picked.length > 0) {
        console.log('[dojakweb:doge-tx] UTXO MyDoge ∩ Blockchair ∩ BlockCypher', {
          mydoge: myDoge.length,
          picked: picked.length,
        });
        return picked;
      }
    }

    if (chair.length > 0) {
      picked = myDoge.filter((u) => chairK.has(utxoOutpointKey(u)));
      if (picked.length > 0) {
        console.log('[dojakweb:doge-tx] UTXO MyDoge ∩ Blockchair', {
          mydoge: myDoge.length,
          picked: picked.length,
        });
        return picked;
      }
    }

    if (cypher.length > 0) {
      picked = myDoge.filter((u) => cypherK.has(utxoOutpointKey(u)));
      if (picked.length > 0) {
        console.log('[dojakweb:doge-tx] UTXO MyDoge ∩ BlockCypher', {
          mydoge: myDoge.length,
          picked: picked.length,
        });
        return picked;
      }
    }

    console.warn(
      '[dojakweb:doge-tx] MyDoge UTXOs had no Blockchair/BlockCypher overlap; using MyDoge list only',
      { mydoge: myDoge.length },
    );
    return myDoge;
  }

  if (chair.length > 0 && cypher.length > 0) {
    const bKeys = new Set(cypher.map(utxoOutpointKey));
    const inter = chair.filter((u) => bKeys.has(utxoOutpointKey(u)));
    if (inter.length > 0) {
      console.log('[dojakweb:doge-tx] UTXO Blockchair ∩ BlockCypher (no MyDoge)', {
        blockchair: chair.length,
        blockcypher: cypher.length,
        intersect: inter.length,
      });
      return inter;
    }
    console.warn('[dojakweb:doge-tx] UTXO intersect empty; using BlockCypher list only');
    return cypher;
  }
  if (cypher.length > 0) return cypher;
  return chair;
}

/**
 * Confirmed spendable UTXOs for coin selection — MyDoge ∩ Blockchair ∩ BlockCypher when possible
 * (never Blockchair alone; avoids stale `is_spent(false)` ghosts → “already been spent” / Missing inputs).
 */
export async function fetchSpendableUtxosForAddress(address: string): Promise<NormalisedUtxo[]> {
  return fetchSpendableUtxosConservativeForAddress(address);
}

// --------------------------------------------------------------------------
// Broadcast
// --------------------------------------------------------------------------

const BLOCKCHAIR_URL = 'https://api.blockchair.com/dogecoin';
const BROADCAST_CONFIG_KEY = 'dojakweb-broadcast-config';
const RELAY_CALL_TIMEOUT_MS = 20_000;
const RPC_READ_TIMEOUT_MS = 8_000;
const INDEXER_READ_TIMEOUT_MS = 8_000;

type BroadcastRelayProvider = 'blockchair' | 'blockcypher' | 'tatum' | 'rpc' | 'commanddog';
type BroadcastProvider = 'auto' | BroadcastRelayProvider;
/**
 * Default relay order for browser wallets: Command.dog (Core-backed relay) and public APIs first;
 * local JSON-RPC last (often misconfigured for MyDoge addresses — `sendrawtransaction` is not “wallet-only”
 * but the proxy/Core must accept the tx).
 */
const DEFAULT_BROADCAST_PRIORITY: BroadcastRelayProvider[] = [
  'commanddog',
  'blockcypher',
  'blockchair',
  'tatum',
  'rpc',
];

export interface BroadcastConfig {
  broadcastProvider: BroadcastProvider;
  broadcastPriority: BroadcastRelayProvider[];
  rpcUrl: string;
  rpcUser: string;
  rpcPass: string;
  tatumApiKey: string;
}

async function withTimeout<T>(label: string, ms: number, work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalizeBroadcastPriority(priority: unknown): BroadcastRelayProvider[] {
  /** Order used when filling missing relays — matches DEFAULT_BROADCAST_PRIORITY. */
  const allowed: BroadcastRelayProvider[] = ['rpc', 'tatum', 'blockcypher', 'blockchair', 'commanddog'];
  const input = Array.isArray(priority) ? priority : [];
  const picked = input.filter((item): item is BroadcastRelayProvider =>
    typeof item === 'string' && allowed.includes(item as BroadcastRelayProvider),
  );
  const unique = [...new Set(picked)];
  for (const item of allowed) {
    if (!unique.includes(item)) unique.push(item);
  }
  return unique;
}

/** Single-relay `broadcastProvider` (legacy) → try that relay first, then the rest of the saved order. */
function resolvedBroadcastRelayOrder(cfg: BroadcastConfig): BroadcastRelayProvider[] {
  const base = normalizeBroadcastPriority(cfg.broadcastPriority);
  if (cfg.broadcastProvider === 'auto') return base;
  const pinned = cfg.broadcastProvider as BroadcastRelayProvider;
  const rest = base.filter((x) => x !== pinned);
  return [pinned, ...rest];
}

/**
 * Core-backed reads via Command.dog (`GET /v1/tx/.../status`, `/rpc/...`) whenever a base URL is set
 * (default `https://api.command.dog`, tunnel, or `VITE_COMMAND_DOG_API_URL`).
 */
export function commandDogChainReadsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return getCommandDogApiBaseUrl().trim().length > 0;
}

/** JSON-RPC reads: Command.dog `/rpc/*` and/or wallet Core via same-origin proxy. */
function browserCoreBackedJsonRpcReadsAvailable(cfg: BroadcastConfig): boolean {
  if (typeof window === 'undefined') return false;
  if (getCommandDogApiBaseUrl().trim().length > 0) return true;
  return Boolean(browserRpcProxyAbsoluteUrl() && hasBroadcastRpcConfiguredFromCfg(cfg));
}

async function fetchConfirmationsFromCommandDog(txid: string): Promise<number | null> {
  if (!commandDogChainReadsEnabled()) return null;
  const st = await withTimeout(
    'Command.dog tx status',
    INDEXER_READ_TIMEOUT_MS,
    fetchCommandDogTxStatus(txid),
  ).catch(() => null);
  if (!st?.known) return null;
  const c = st.confirmations;
  if (typeof c === 'number' && Number.isFinite(c)) return Math.max(0, Math.floor(c));
  return 0;
}

/** Command.dog `GET /v1/tx/{txid}/status` — Core-backed; no relay-order gate (used for propagation waits). */
async function probeCommandDogTxKnown(txid: string): Promise<boolean> {
  const st = await withTimeout(
    'Command.dog tx status',
    INDEXER_READ_TIMEOUT_MS,
    fetchCommandDogTxStatus(txid),
  ).catch(() => null);
  return Boolean(st?.known);
}

async function isCommandDogTxKnown(txid: string): Promise<boolean> {
  if (!commandDogChainReadsEnabled()) return false;
  return probeCommandDogTxKnown(txid);
}

export function loadBroadcastConfig(): BroadcastConfig {
  if (typeof window === 'undefined') {
    return {
      broadcastProvider: 'auto',
      broadcastPriority: DEFAULT_BROADCAST_PRIORITY,
      rpcUrl: 'http://127.0.0.1:22555',
      rpcUser: '',
      rpcPass: '',
      tatumApiKey: '',
    };
  }
  try {
    const raw = window.localStorage.getItem(BROADCAST_CONFIG_KEY);
    if (!raw) throw new Error('no config');
    const parsed = JSON.parse(raw) as Partial<BroadcastConfig>;
    return {
      broadcastProvider: 'auto',
      broadcastPriority: normalizeBroadcastPriority(parsed.broadcastPriority),
      rpcUrl: 'http://127.0.0.1:22555',
      rpcUser: '',
      rpcPass: '',
      tatumApiKey: '',
      ...parsed,
      broadcastPriority: normalizeBroadcastPriority(parsed.broadcastPriority),
    };
  } catch {
    return {
      broadcastProvider: 'auto',
      broadcastPriority: DEFAULT_BROADCAST_PRIORITY,
      rpcUrl: 'http://127.0.0.1:22555',
      rpcUser: '',
      rpcPass: '',
      tatumApiKey: '',
    };
  }
}

/** True when Wallet Settings has RPC URL + user + password (used for reads, not only broadcast order). */
function hasBroadcastRpcConfigured(): boolean {
  return hasBroadcastRpcConfiguredFromCfg(loadBroadcastConfig());
}

export function hasBroadcastRpcConfiguredFromCfg(cfg: BroadcastConfig): boolean {
  return Boolean(
    cfg.rpcUrl?.trim() && cfg.rpcUser?.trim() && cfg.rpcPass !== undefined && cfg.rpcPass !== '',
  );
}

export type DogeConfirmationReadSourceId = 'rpc' | 'blockchair' | 'blockcypher' | 'tatum' | 'commanddog';

export interface DogeConfirmationReadSourceRow {
  id: DogeConfirmationReadSourceId;
  active: boolean;
  /** i18n key explaining why this source is off (tooltip). */
  offKey?: string;
}

/**
 * Sources merged by {@link getBestDogeTxConfirmations} (max confirmations).
 * Pass `preview` to reflect unsaved Wallet → Broadcast draft (settings modal).
 */
export function getDogeConfirmationReadSourceRows(preview?: BroadcastConfig): DogeConfirmationReadSourceRow[] {
  const cfg = preview ?? loadBroadcastConfig();
  const inBrowser = typeof window !== 'undefined';
  const useRpcReads = inBrowser && browserCoreBackedJsonRpcReadsAvailable(cfg);
  const order = resolvedBroadcastRelayOrder(cfg);
  const tatumKey = cfg.tatumApiKey?.trim() ?? '';

  const rpcActive = useRpcReads;
  const cypherActive = inBrowser ? order.includes('blockcypher') : !useRpcReads;
  const tatumActive = Boolean(tatumKey && order.includes('tatum'));
  const commandDogReads = order.includes('commanddog');

  return [
    {
      id: 'rpc',
      active: rpcActive,
      offKey: rpcActive ? undefined : 'chain.confirmReads.off.rpc',
    },
    {
      id: 'commanddog',
      active: commandDogReads,
      offKey: commandDogReads ? undefined : 'chain.confirmReads.off.commanddog',
    },
    { id: 'blockchair', active: true },
    {
      id: 'blockcypher',
      active: cypherActive,
      offKey: cypherActive
        ? undefined
        : inBrowser
          ? 'chain.confirmReads.off.blockcypher.browser'
          : 'chain.confirmReads.off.blockcypher.rpcPriority',
    },
    {
      id: 'tatum',
      active: tatumActive,
      offKey: tatumActive ? undefined : 'chain.confirmReads.off.tatum',
    },
  ];
}

/**
 * Confirmations from Core via Command.dog JSON-RPC and/or wallet RPC proxy (`getrawtransaction` / `getmempoolentry`).
 * Returns `null` if no backend is available, or the node does not know the tx yet.
 */
async function fetchConfirmationsFromRpc(txid: string): Promise<number | null> {
  if (typeof window === 'undefined') return null;
  const cfg = loadBroadcastConfig();
  if (!browserCoreBackedJsonRpcReadsAvailable(cfg)) return null;

  const url = cfg.rpcUrl?.trim();
  const user = cfg.rpcUser?.trim();
  const pass = cfg.rpcPass;
  const creds =
    browserRpcProxyAbsoluteUrl() && url && user && pass !== undefined && pass !== ''
      ? { rpcUrl: url, rpcUser: user, rpcPass: pass }
      : null;

  try {
    const verbose = await withTimeout(
      'RPC getrawtransaction',
      RPC_READ_TIMEOUT_MS,
      rpcViaProxyDetailed<Record<string, unknown>>('getrawtransaction', [txid, true], creds),
    );
    if (verbose.ok && verbose.result && typeof verbose.result === 'object') {
      const c = verbose.result.confirmations;
      if (typeof c === 'number' && Number.isFinite(c)) return Math.max(0, Math.floor(c));
      if (typeof verbose.result.hex === 'string') return 0;
    }

    const mem = await withTimeout(
      'RPC getmempoolentry',
      RPC_READ_TIMEOUT_MS,
      rpcViaProxyDetailed<Record<string, unknown>>('getmempoolentry', [txid], creds),
    );
    if (mem.ok && mem.result && typeof mem.result === 'object') return 0;
    return null;
  } catch {
    return null;
  }
}

async function isTxVisibleOnRpc(txid: string): Promise<boolean> {
  return (await fetchConfirmationsFromRpc(txid)) !== null;
}

/**
 * When Core supports it, reject non-standard / policy-broken txs before `sendrawtransaction`.
 * Skips silently if the method is missing (older Core) or parents are not in this node's view yet
 * (common for child txs in a commit→reveal chain).
 */
async function preflightTestMempoolAccept(rawTxHex: string, cfg: BroadcastConfig): Promise<void> {
  const interpretResult = (result: unknown): 'ok' | 'missing_parent' | 'rejected' | 'unknown' => {
    const row = Array.isArray(result) ? (result[0] as Record<string, unknown> | undefined) : undefined;
    if (!row || typeof row !== 'object') return 'unknown';
    if (row.allowed === true) return 'ok';
    if (row.allowed === false) {
      const reason = String(row['reject-reason'] ?? row['reject_reason'] ?? '').toLowerCase();
      if (
        reason.includes('missing') ||
        reason.includes('bad-txns-inputs-missingorspent') ||
        reason.includes('inputs-missingorspent')
      ) {
        return 'missing_parent';
      }
      return 'rejected';
    }
    return 'unknown';
  };

  const params = [[rawTxHex]];

  const url = cfg.rpcUrl?.trim();
  const user = cfg.rpcUser?.trim();
  const pass = cfg.rpcPass;
  const creds =
    browserRpcProxyAbsoluteUrl() && url && user && pass !== undefined && pass !== ''
      ? { rpcUrl: url, rpcUser: user, rpcPass: pass }
      : null;
  const canCommandDog = getCommandDogApiBaseUrl().trim().length > 0;
  if (!creds && !canCommandDog) return;

  if (browserRpcProxyAbsoluteUrl() || canCommandDog) {
    const r = await withTimeout(
      'RPC proxy testmempoolaccept',
      RPC_READ_TIMEOUT_MS,
      rpcViaProxyDetailed<unknown>('testmempoolaccept', params, creds),
    );
    if (!r.ok) {
      const err = r.error.toLowerCase();
      if (err.includes('method not found') || err.includes('not found')) {
        console.info('[dojakweb:doge-tx] testmempoolaccept not supported; skipping preflight');
        return;
      }
      throw new Error(`testmempoolaccept RPC error: ${r.error}`);
    }
    const verdict = interpretResult(r.result);
    if (verdict === 'ok' || verdict === 'unknown') return;
    if (verdict === 'missing_parent') {
      console.warn(
        '[dojakweb:doge-tx] testmempoolaccept: inputs not in this node yet (child tx or unsynced mempool) — continuing',
      );
      return;
    }
    const row = Array.isArray(r.result) ? (r.result[0] as Record<string, unknown>) : {};
    const reason =
      row && typeof row === 'object' && typeof row['reject-reason'] === 'string'
        ? row['reject-reason']
        : JSON.stringify(r.result);
    throw new Error(`Transaction rejected by your node (testmempoolaccept): ${reason}`);
  }

  if (!creds) return;

  const rpcPayload = { jsonrpc: '1.0', id: 'dogetag', method: 'testmempoolaccept', params };
  const auth = btoa(`${cfg.rpcUser}:${cfg.rpcPass}`);
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), RPC_READ_TIMEOUT_MS);
  const res = await fetch(cfg.rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(rpcPayload),
    signal: ac.signal,
  }).finally(() => clearTimeout(timeout));
  const data = await res.json().catch(() => null);
  if (data?.error) {
    const msg = String(data.error?.message ?? JSON.stringify(data.error)).toLowerCase();
    if (msg.includes('method not found') || msg.includes('not found')) {
      console.info('[dojakweb:doge-tx] testmempoolaccept not supported; skipping preflight');
      return;
    }
    throw new Error(`testmempoolaccept RPC error: ${data.error.message ?? JSON.stringify(data.error)}`);
  }
  const verdict = interpretResult(data?.result);
  if (verdict === 'ok' || verdict === 'unknown') return;
  if (verdict === 'missing_parent') {
    console.warn(
      '[dojakweb:doge-tx] testmempoolaccept: inputs not in this node yet — continuing with sendrawtransaction',
    );
    return;
  }
  throw new Error(`Transaction rejected by your node (testmempoolaccept): ${JSON.stringify(data?.result)}`);
}

/**
 * Broadcast via the user's local Dogecoin RPC node (highest priority).
 * Uses sendrawtransaction over JSON-RPC.
 */
async function broadcastViaRpc(rawTxHex: string, cfg: BroadcastConfig): Promise<string> {
  if (!cfg.rpcUrl || !cfg.rpcUser || !cfg.rpcPass) {
    throw new Error('RPC mode is selected but RPC URL/user/password are missing in Wallet Settings.');
  }

  await preflightTestMempoolAccept(rawTxHex, cfg);

  // Browser: always prefer same-origin proxy (Core does not send CORS headers on JSON-RPC).
  if (browserRpcProxyAbsoluteUrl()) {
    const txid = await withTimeout(
      'RPC proxy sendrawtransaction',
      RELAY_CALL_TIMEOUT_MS,
      rpcViaProxy<string>('sendrawtransaction', [rawTxHex], {
        rpcUrl: cfg.rpcUrl,
        rpcUser: cfg.rpcUser,
        rpcPass: cfg.rpcPass,
      }),
    );
    if (txid && typeof txid === 'string') return txid;
    throw new Error(
      'RPC proxy did not return a txid. Check /api/rpc-proxy, Core rpcallowip, and credentials in Wallet Settings.',
    );
  }

  const rpcPayload = { jsonrpc: '1.0', id: 'dogetag', method: 'sendrawtransaction', params: [rawTxHex] };
  const auth = btoa(`${cfg.rpcUser}:${cfg.rpcPass}`);
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), RELAY_CALL_TIMEOUT_MS);
  const res = await fetch(cfg.rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(rpcPayload),
    signal: ac.signal,
  }).finally(() => clearTimeout(timeout));
  const data = await res.json();
  if (data.error) throw new Error(`RPC error: ${data.error.message ?? JSON.stringify(data.error)}`);
  if (!data.result) throw new Error('RPC returned no txid');
  return data.result as string;
}

/**
 * Broadcast via Blockchair (public relay; default order is after BlockCypher).
 * Blockchair uses form-encoded `data=<hex>` and returns `data.transaction_hash`.
 */
async function broadcastViaBlockchair(rawTxHex: string): Promise<string> {
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), RELAY_CALL_TIMEOUT_MS);
  const res = await fetch(`${BLOCKCHAIR_URL}/push/transaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${rawTxHex}`,
    signal: ac.signal,
  }).finally(() => clearTimeout(timeout));
  const data = await res.json();
  console.log('[dojakweb:doge-tx] Blockchair broadcast response', JSON.stringify(data));
  if (data?.data?.transaction_hash) return data.data.transaction_hash as string;
  const err = data?.context?.error as string | undefined;
  throw new Error(err ?? `Blockchair broadcast failed (${res.status})`);
}

/**
 * Broadcast via BlockCypher (default first public relay in Auto mode).
 * If propagation cannot be verified, retry from Wallet Settings (RPC preferred).
 */
async function broadcastViaBlockCypher(rawTxHex: string): Promise<string> {
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), RELAY_CALL_TIMEOUT_MS);
  const res = await fetch('https://api.blockcypher.com/v1/doge/main/txs/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tx: rawTxHex }),
    signal: ac.signal,
  }).finally(() => clearTimeout(timeout));

  if (!res.ok) {
    const errText = await res.text().catch(() => String(res.status));
    console.error('[dojakweb:doge-tx] BlockCypher broadcast error', { status: res.status, body: errText });
    throw new Error(`BlockCypher broadcast failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  console.log('[dojakweb:doge-tx] BlockCypher broadcast response', { hash: data?.tx?.hash ?? data?.hash });
  const hash = data?.tx?.hash || data?.hash;
  if (!hash) throw new Error('BlockCypher returned no transaction hash');
  return hash;
}

async function broadcastViaCommandDog(rawTxHex: string): Promise<string> {
  return withTimeout(
    'Command.dog broadcast',
    RELAY_CALL_TIMEOUT_MS,
    broadcastHexViaCommandDog(rawTxHex),
  );
}

async function broadcastViaTatum(rawTxHex: string, cfg: BroadcastConfig): Promise<string> {
  const key = cfg.tatumApiKey?.trim();
  if (!key) {
    throw new Error('Tatum broadcast provider requires an API key in Wallet Settings.');
  }
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), RELAY_CALL_TIMEOUT_MS);
  const res = await fetch('https://api.tatum.io/v3/dogecoin/broadcast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
    },
    body: JSON.stringify({ txData: rawTxHex }),
    signal: ac.signal,
  }).finally(() => clearTimeout(timeout));
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

async function isTxVisibleOnBlockchair(txid: string): Promise<boolean> {
  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), INDEXER_READ_TIMEOUT_MS);
    const res = await fetch(`https://api.blockchair.com/dogecoin/dashboards/transaction/${txid}`, {
      signal: ac.signal,
    }).finally(() => clearTimeout(timeout));
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return !!data?.data?.[txid]?.transaction?.hash;
  } catch {
    return false;
  }
}

async function isTxVisibleOnBlockCypher(txid: string): Promise<boolean> {
  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), INDEXER_READ_TIMEOUT_MS);
    const res = await fetch(`https://api.blockcypher.com/v1/doge/main/txs/${txid}`, {
      signal: ac.signal,
    }).finally(() => clearTimeout(timeout));
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Broadcast using Wallet Settings relay order (default: RPC → Tatum → … when credentials / keys exist).
 * Every path waits for the same propagation checks as {@link broadcastTxWithStatus} (no “orphan txid”).
 */
async function broadcastTransaction(rawTxHex: string): Promise<string> {
  const cfg = loadBroadcastConfig();
  const order = resolvedBroadcastRelayOrder(cfg);

  const tryRelay = async (provider: BroadcastRelayProvider): Promise<string> => {
    let relayTxid: string;
    if (provider === 'rpc') {
      relayTxid = await broadcastViaRpc(rawTxHex, cfg);
      console.log('[dojakweb:doge-tx] RPC relay accepted', { relayTxid, rpcUrl: cfg.rpcUrl });
    } else if (provider === 'blockchair') {
      relayTxid = await broadcastViaBlockchair(rawTxHex);
    } else if (provider === 'blockcypher') {
      relayTxid = await broadcastViaBlockCypher(rawTxHex);
    } else if (provider === 'commanddog') {
      relayTxid = await broadcastViaCommandDog(rawTxHex);
    } else {
      relayTxid = await broadcastViaTatum(rawTxHex, cfg);
      console.log('[dojakweb:doge-tx] Tatum relay accepted', { relayTxid });
    }

    const { txid: canonical } = await resolveCanonicalDogeTxidFromRelay(relayTxid, rawTxHex);
    await waitForBroadcastAcceptance(canonical, cfg);
    console.log('[dojakweb:doge-tx] broadcast verified', { provider, txid: canonical });
    return canonical;
  };

  let lastError: unknown = null;
  for (const provider of order) {
    if (provider === 'rpc' && (!cfg.rpcUser || !cfg.rpcPass || !cfg.rpcUrl)) {
      console.info('[dojakweb:doge-tx] skipping RPC in broadcast order: credentials missing');
      continue;
    }
    if (provider === 'tatum' && !cfg.tatumApiKey?.trim()) {
      console.info('[dojakweb:doge-tx] skipping Tatum in broadcast order: API key missing');
      continue;
    }
    try {
      return await tryRelay(provider);
    } catch (error) {
      lastError = error;
      console.warn(`[dojakweb:doge-tx] ${provider} failed, trying next provider:`, error);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('All broadcast providers failed.');
}

// --------------------------------------------------------------------------
// Public types
// --------------------------------------------------------------------------

export interface BroadcastOpReturnParams {
  /** UTF-8 message to embed in OP_RETURN (max 80 bytes when encoded). */
  message: string;
  /** Sender's Dogecoin address. */
  fromAddress: string;
  /**
   * Private key in WIF format.
   * Available from `useBrowserWallet().wallet?.privateKey` after unlock.
   */
  privateKeyWIF: string;
  /**
   * Fee rate in satoshis per kilobyte. Defaults to 1 000 sat/kB
   * (Dogecoin minimum relay fee).
   */
  feeRate?: number;
  /**
   * Optional tip to include as a standard P2PKH output in the same transaction.
   * Lets users tip a friend, charity, or the protocol in the same OP_RETURN tx.
   */
  tip?: DogetagTip;
  /**
   * Optional outpoints that must never be spent (format: "<txid>:<vout>").
   * Used to protect inscription-bearing outputs from accidental selection.
   */
  excludedOutpoints?: string[];
  /**
   * Extra OP_RETURN payloads after the main message — one tx output per buffer (e.g. Dogenals Era-2 line).
   * Each must be ≤ 520 bytes (max script push). Does not apply to P2SH file inscriptions.
   */
  additionalOpReturnPayloads?: Buffer[];
}

export interface OpReturnFeeEstimate {
  /** Estimated fee in satoshis. */
  feeSatoshis: number;
  /** Estimated fee in DOGE (human-readable). */
  feeDoge: string;
  /** Change that will return to the sender, in satoshis. */
  changeSatoshis: number;
  /** Total input satoshis selected. */
  totalInputSatoshis: number;
  /** Number of UTXOs being consumed. */
  inputCount: number;
}

/** A signed but not yet broadcast transaction, ready to push to the network. */
export interface SignedOpReturnTx {
  /** Raw serialised transaction hex — ready to broadcast. */
  rawHex: string;
  /** Fee paid in satoshis. */
  feeSatoshis: number;
  /** Change returning to the sender in satoshis. */
  changeSatoshis: number;
  /** Total satoshis consumed from UTXOs. */
  totalInputSatoshis: number;
  /** Number of UTXOs consumed. */
  inputCount: number;
  /** Tip included in the transaction, if any. */
  tip?: DogetagTip;
  /** The specific UTXOs that were selected as inputs — shown in the review UI. */
  selectedUtxos: Array<{ txid: string; vout: number; value: number }>;
}

// --------------------------------------------------------------------------
// Fee estimation (exported so the UI can show a preview)
// --------------------------------------------------------------------------

export async function estimateOpReturnFee(
  message: string,
  fromAddress: string,
  feeRate = 1000,
  tip?: DogetagTip,
  excludedOutpoints?: string[],
  additionalOpReturnPayloads?: Buffer[],
): Promise<OpReturnFeeEstimate> {
  const msgBytes = utf8PayloadForDogetagMessage(message);
  feeRate = Math.max(MIN_FEE_RATE_KOINU_PER_BYTE, feeRate);

  const extra = additionalOpReturnPayloads ?? [];
  for (const b of extra) {
    if (!b.length) throw new Error('Additional OP_RETURN payload cannot be empty');
    if (b.length > MAX_SCRIPT_ELEMENT_BYTES) {
      throw new Error(`Additional OP_RETURN payload too large (${b.length} bytes, max ${MAX_SCRIPT_ELEMENT_BYTES})`);
    }
  }
  const payloads = [msgBytes, ...extra];

  const utxos = await fetchSpendableUtxosConservativeForAddress(fromAddress);
  if (!utxos.length) throw new Error('No confirmed UTXOs found for this address.');
  const { spendable: afterExcludes } = filterExcludedUtxos(utxos, excludedOutpoints);
  const { safe: spendable } = filterSafeSpendableUtxos(fromAddress, afterExcludes);
  if (!spendable.length) {
    throw new Error('No spendable UTXOs remain after excluding protected and inscription-likely outputs.');
  }

  const tipSats = tip?.satoshis ?? 0;
  const tipOutputSize = tip ? 34 : 0;

  // tx size estimate: 10 overhead + 148/input + 34 change + OP_RETURN output(s) + optional tip output
  const opReturnOutputsWeight = estimateOpReturnOutputsTxWeight(payloads);
  const singleInputSize = 10 + 148 + 34 + opReturnOutputsWeight + tipOutputSize;
  const feeSatoshis = Math.max(100_000, Math.ceil((singleInputSize * feeRate) / 1000));
  const totalNeeded = feeSatoshis + tipSats;

  const sorted = [...spendable].sort((a, b) => b.value - a.value);
  const selected: typeof sorted = [];
  let total = 0;
  for (const u of sorted) {
    selected.push(u);
    total += u.value;
    if (total >= totalNeeded + 100_000) break;
  }

  if (!Number.isFinite(total) || total < totalNeeded) {
    throw new Error(
      `Insufficient funds: need ${(totalNeeded / 1e8).toFixed(4)} DOGE (fee + tip), ` +
      `have ${(total / 1e8).toFixed(4)} DOGE.`,
    );
  }

  return {
    feeSatoshis,
    feeDoge: (feeSatoshis / 1e8).toFixed(4),
    changeSatoshis: total - totalNeeded,
    totalInputSatoshis: total,
    inputCount: selected.length,
  };
}

// --------------------------------------------------------------------------
// Core: build and sign (does NOT broadcast)
// --------------------------------------------------------------------------

/**
 * Build and sign an OP_RETURN transaction client-side.
 * Returns the raw signed hex and transaction details.
 * Call `broadcastSignedTransaction` separately to push it to the network.
 */
export async function signOpReturnTransaction(
  params: BroadcastOpReturnParams,
): Promise<SignedOpReturnTx> {
  const {
    message,
    fromAddress,
    privateKeyWIF,
    feeRate: rawFeeRate = 1000,
    tip,
    excludedOutpoints,
    additionalOpReturnPayloads,
  } = params;
  const feeRate = Math.max(MIN_FEE_RATE_KOINU_PER_BYTE, rawFeeRate);
  if (rawFeeRate < MIN_FEE_RATE_KOINU_PER_BYTE) {
    console.warn(`[dojakweb:doge-tx] feeRate ${rawFeeRate} below minimum relay fee — clamped to ${MIN_FEE_RATE_KOINU_PER_BYTE} koinu/byte`);
  }

  const msgBytes = utf8PayloadForDogetagMessage(message);
  const extra = additionalOpReturnPayloads ?? [];
  for (const b of extra) {
    if (!b.length) throw new Error('Additional OP_RETURN payload cannot be empty');
    if (b.length > MAX_SCRIPT_ELEMENT_BYTES) {
      throw new Error(`Additional OP_RETURN payload too large (${b.length} bytes, max ${MAX_SCRIPT_ELEMENT_BYTES})`);
    }
  }
  const opReturnPayloads = [msgBytes, ...extra];

  // --- Validate tip ---
  const tipSats = tip?.satoshis ?? 0;
  if (tip) {
    if (!tip.address) throw new Error('Tip address cannot be empty.');
    if (!Number.isFinite(tipSats) || tipSats < 100_000) {
      throw new Error('Tip amount must be at least 0.001 DOGE (100 000 sat) to avoid dust rejection.');
    }
  }

  // --- Fetch UTXOs (MyDoge ∩ indexers — never Blockchair-only; stale lists break broadcast) ---
  console.log('[dojakweb:doge-tx] fetching UTXOs (conservative)', { fromAddress });
  const utxos = await fetchSpendableUtxosConservativeForAddress(fromAddress);
  console.log('[dojakweb:doge-tx] UTXOs received', utxos.map(u => ({
    txid: u.tx_hash, vout: u.tx_output_n, value: u.value,
  })));
  if (!utxos.length) {
    throw new Error('No confirmed UTXOs found. Your wallet needs DOGE to cover the fee.');
  }

  const { spendable: afterExcludes, excludedCount } = filterExcludedUtxos(utxos, excludedOutpoints);
  if (excludedCount > 0) {
    console.log('[dojakweb:doge-tx] excluded protected UTXOs', { excludedCount });
  }
  const { safe: spendableUtxos } = filterSafeSpendableUtxos(fromAddress, afterExcludes);
  if (!spendableUtxos.length) {
    throw new Error('No spendable UTXOs remain after excluding protected and inscription-likely outputs. Ensure you have plain DOGE UTXOs > 0.001 DOGE.');
  }

  // --- Fee & coin selection ---
  // tx size: 10 overhead + 148/input + 34 change + OP_RETURN output(s) + 34 tip output (if any)
  const opReturnOutputsWeight = estimateOpReturnOutputsTxWeight(opReturnPayloads);
  const tipOutputSize = tip ? 34 : 0;
  const baseSize = 10 + 34 + opReturnOutputsWeight + tipOutputSize; // overhead + change + OP_RETURN(s) + optional tip
  const perInputSize = 148;
  // Minimum relay fee floor: 1 DOGE = well above mempool minimums on all miners
  // Dogecoin minimum relay fee is 1000 sat/kB; a ~220-byte tx needs ~220 sat.
  // We use 100 000 sat (0.001 DOGE) as a safe floor — accepted by all nodes.
  const MIN_FEE = 100_000;

  let feeSatoshis = Math.max(MIN_FEE, Math.ceil(((baseSize + perInputSize) * feeRate) / 1000));

  const sorted = [...spendableUtxos].sort((a, b) => b.value - a.value);
  const selected: NormalisedUtxo[] = [];
  let totalSats = 0;
  const needed = () => feeSatoshis + tipSats + 100_000; // fee + tip + dust guard on change

  for (const utxo of sorted) {
    const sats = utxo.value;
    if (!Number.isFinite(sats) || sats <= 0) {
      console.warn('[dojakweb:doge-tx] skipping malformed UTXO', utxo);
      continue;
    }

    selected.push(utxo);
    totalSats += sats;

    feeSatoshis = Math.max(
      MIN_FEE,
      Math.ceil(((baseSize + perInputSize * selected.length) * feeRate) / 1000),
    );

    if (totalSats >= needed()) break;
  }

  console.log('[dojakweb:doge-tx] coin selection', {
    selectedCount: selected.length,
    totalSats,
    feeSatoshis,
    tipSats,
    changeWouldBe: totalSats - feeSatoshis - tipSats,
    needed: needed(),
  });

  if (!Number.isFinite(totalSats) || totalSats <= 0) {
    throw new Error('Could not read UTXO values from the network. Try again in a moment.');
  }

  const totalNeeded = feeSatoshis + tipSats;
  if (totalSats < totalNeeded) {
    const shortfall = ((totalNeeded - totalSats) / 1e8).toFixed(4);
    throw new Error(
      `Insufficient funds: need ${(totalNeeded / 1e8).toFixed(4)} DOGE (fee + tip), ` +
      `have ${(totalSats / 1e8).toFixed(4)} DOGE. Short by ${shortfall} DOGE.`,
    );
  }

  const changeAmount = totalSats - feeSatoshis - tipSats;

  if (!Number.isFinite(changeAmount) || changeAmount < 0) {
    throw new Error(
      `Fee calculation produced invalid change (${changeAmount}). ` +
      'Please report this to the wzrd.dog team.',
    );
  }

  // --- Build outputs (one OP_RETURN per payload; then tip; then change) ---
  const planned = planPaymentOutputsWithOptionalOpReturns({
    tip,
    changeAddress: fromAddress,
    changeSats: changeAmount,
    opReturnPayloads,
  });
  const outputs: Array<{ value: number; script?: Uint8Array; address?: string }> = planned.map((o) => {
    if (o.script !== undefined) return { value: o.value, script: o.script };
    if (o.address !== undefined) return { value: o.value, address: o.address };
    return { value: o.value };
  });

  console.log('[dojakweb:doge-tx] outputs', outputs.map(o => ({
    value: o.value,
    address: o.address ?? '(OP_RETURN script)',
  })));

  // --- Sign ---
  console.log('[dojakweb:doge-tx] signing with DogeMemoryWallet');
  const signer = DogeMemoryWallet.fromWIF(privateKeyWIF, 'doge');

  const txBuilder = createP2PKHTransaction(signer, {
    address: fromAddress,
    inputs: selected.map(u => ({
      txid: u.tx_hash,
      vout: u.tx_output_n,
      value: u.value,
    })),
    outputs: outputs as any,
  });

  const signedTx = await txBuilder.finalizeAndSign();
  const rawHex = signedTx.toHex();
  console.log('[dojakweb:doge-tx] signed', { rawHexLength: rawHex.length, rawHexPreview: rawHex.slice(0, 80) + '…' });

  return {
    rawHex,
    feeSatoshis,
    changeSatoshis: changeAmount,
    totalInputSatoshis: totalSats,
    inputCount: selected.length,
    tip: tip && tipSats > 0 ? tip : undefined,
    selectedUtxos: selected.map(u => ({ txid: u.tx_hash, vout: u.tx_output_n, value: u.value })),
  };
}

// --------------------------------------------------------------------------
// PSBT builder — for external signers (MyDoge, Dojak, Ledger)
// --------------------------------------------------------------------------

export interface BuiltOpReturnPSDT {
  /** PSBT as base64 — pass to signPSBTOnly / wallet extension. */
  psbtBase64:          string;
  /** Number of inputs in the PSBT (pass all as indexes to the wallet). */
  inputCount:          number;
  feeSatoshis:         number;
  changeSatoshis:      number;
  totalInputSatoshis:  number;
  tip?:                DogetagTip;
  selectedUtxos:       Array<{ txid: string; vout: number; value: number }>;
}

/**
 * Build an unsigned OP_RETURN transaction as a PSBT so it can be signed by an
 * extension wallet (MyDoge, Dojak) via their signPSBT API.
 *
 * Performs the same coin selection as signOpReturnTransaction. The returned
 * PSBT has each input's nonWitnessUtxo populated (raw previous-tx hex fetched
 * from Blockchair) so the wallet can verify the amounts before signing.
 */
export async function buildOpReturnPSDT(
  message:     string,
  fromAddress: string,
  rawFeeRate = 1000,
  tip?:        DogetagTip,
  excludedOutpoints?: string[],
  additionalOpReturnPayloads?: Buffer[],
): Promise<BuiltOpReturnPSDT> {
  const feeRate = Math.max(MIN_FEE_RATE_KOINU_PER_BYTE, rawFeeRate);

  const msgBytes = utf8PayloadForDogetagMessage(message);
  const extra = additionalOpReturnPayloads ?? [];
  for (const b of extra) {
    if (!b.length) throw new Error('Additional OP_RETURN payload cannot be empty');
    if (b.length > MAX_SCRIPT_ELEMENT_BYTES) {
      throw new Error(`Additional OP_RETURN payload too large (${b.length} bytes, max ${MAX_SCRIPT_ELEMENT_BYTES})`);
    }
  }
  const payloads = [msgBytes, ...extra];

  const tipSats = tip?.satoshis ?? 0;
  if (tip) {
    if (!tip.address) throw new Error('Tip address cannot be empty.');
    if (!Number.isFinite(tipSats) || tipSats < 100_000) throw new Error('Tip amount must be at least 0.001 DOGE.');
  }

  // --- Coin selection (same logic as signOpReturnTransaction) ---
  const utxos = await fetchSpendableUtxosConservativeForAddress(fromAddress);
  if (!utxos.length) throw new Error('No confirmed UTXOs found. Your wallet needs DOGE to cover the fee.');
  const { spendable: afterExcludes, excludedCount } = filterExcludedUtxos(utxos, excludedOutpoints);
  if (excludedCount > 0) {
    console.log('[dojakweb:doge-tx] excluded protected UTXOs', { excludedCount });
  }
  const { safe: spendableUtxos } = filterSafeSpendableUtxos(fromAddress, afterExcludes);
  if (!spendableUtxos.length) {
    throw new Error('No spendable UTXOs remain after excluding protected and inscription-likely outputs. Ensure you have plain DOGE UTXOs > 0.001 DOGE.');
  }

  const opReturnOutputsWeight = estimateOpReturnOutputsTxWeight(payloads);
  const tipOutputSize = tip ? 34 : 0;
  const baseSize = 10 + 34 + opReturnOutputsWeight + tipOutputSize;
  const perInputSize = 148;
  const MIN_FEE = 100_000;

  let feeSatoshis = Math.max(MIN_FEE, Math.ceil(((baseSize + perInputSize) * feeRate) / 1000));
  const sorted = [...spendableUtxos].sort((a, b) => b.value - a.value);
  const selected: NormalisedUtxo[] = [];
  let totalSats = 0;
  const needed = () => feeSatoshis + tipSats + 100_000;

  for (const utxo of sorted) {
    const sats = utxo.value;
    if (!Number.isFinite(sats) || sats <= 0) continue;
    selected.push(utxo);
    totalSats += sats;
    feeSatoshis = Math.max(MIN_FEE, Math.ceil(((baseSize + perInputSize * selected.length) * feeRate) / 1000));
    if (totalSats >= needed()) break;
  }

  if (!Number.isFinite(totalSats) || totalSats < feeSatoshis + tipSats) {
    throw new Error(
      `Insufficient funds: need ${((feeSatoshis + tipSats) / 1e8).toFixed(4)} DOGE, ` +
      `have ${(totalSats / 1e8).toFixed(4)} DOGE.`,
    );
  }

  const changeAmount = totalSats - feeSatoshis - tipSats;

  // --- Fetch raw previous-tx hex for nonWitnessUtxo (required for P2PKH PSBT) ---
  const rawTxHexes = await Promise.all(
    selected.map(async (u) => {
      const res = await fetch(`https://api.blockchair.com/dogecoin/raw/transaction/${u.tx_hash}`);
      if (!res.ok) throw new Error(`Could not fetch raw tx for UTXO ${u.tx_hash}`);
      const data = await res.json();
      const hex = data?.data?.[u.tx_hash]?.raw_transaction as string | undefined;
      if (!hex) throw new Error(`Raw transaction hex missing for ${u.tx_hash}`);
      return hex;
    }),
  );

  // --- Build PSBT ---
  // Dynamic import keeps bitcoinjs-lib out of the initial bundle for this module.
  const bitcoin = await import('bitcoinjs-lib');
  const DOGE_NETWORK = {
    messagePrefix: '\x19Dogecoin Signed Message:\n',
    bech32: 'dc',
    bip32: { public: 0x02facafd, private: 0x02fac398 },
    pubKeyHash: 0x1e,
    scriptHash: 0x16,
    wif: 0x9e,
  };

  const psbt = new bitcoin.Psbt({ network: DOGE_NETWORK, version: 1 });

  for (let i = 0; i < selected.length; i++) {
    const u = selected[i];
    psbt.addInput({
      hash:             u.tx_hash,
      index:            u.tx_output_n,
      nonWitnessUtxo:   Buffer.from(rawTxHexes[i], 'hex'),
      sighashType:      bitcoin.Transaction.SIGHASH_ALL,
    });
  }

  for (const data of payloads) {
    const script = buildOpReturnLockingScript(data);
    psbt.addOutput({ script, value: BigInt(0) } as any);
  }

  if (tip && tipSats > 0) psbt.addOutput({ address: tip.address, value: BigInt(tipSats) } as any);
  if (changeAmount > 0)   psbt.addOutput({ address: fromAddress, value: BigInt(changeAmount) } as any);

  return {
    psbtBase64:         psbt.toBase64(),
    inputCount:         selected.length,
    feeSatoshis,
    changeSatoshis:     changeAmount,
    totalInputSatoshis: totalSats,
    tip:                tip && tipSats > 0 ? tip : undefined,
    selectedUtxos:      selected.map(u => ({ txid: u.tx_hash, vout: u.tx_output_n, value: u.value })),
  };
}

// --------------------------------------------------------------------------
// Broadcast a pre-signed transaction
// --------------------------------------------------------------------------

/**
 * Push a raw signed transaction hex using the configured broadcast relay order.
 * @returns The broadcast transaction ID.
 */
export async function broadcastSignedTransaction(rawHex: string): Promise<string> {
  console.log('[dojakweb:doge-tx] broadcasting raw hex (wallet relay order)', { rawHexLength: rawHex.length });
  const txid = await broadcastTransaction(rawHex);
  console.log('[dojakweb:doge-tx] broadcast success', { txid });
  return txid;
}

// --------------------------------------------------------------------------
// DogeTag:tx — OP_RETURN message tx (sign + broadcast in one call)
// --------------------------------------------------------------------------

/**
 * Build, sign, and broadcast a short on-chain OP_RETURN message (DogeTag:tx text flow).
 * This is not the P2SH multi-tx file inscription path — use `doginal-chain` + `broadcastTxWithStatus` for those.
 *
 * @returns The broadcast transaction ID.
 * @throws on validation failure, insufficient funds, signing error, or broadcast failure.
 */
export async function signAndBroadcastOpReturnDogetag(
  params: BroadcastOpReturnParams,
): Promise<string> {
  const { rawHex } = await signOpReturnTransaction(params);
  return broadcastTransaction(rawHex);
}

// --------------------------------------------------------------------------
// Step-by-step broadcast primitives (inscriptions, Dogetag, listings — shared)
// --------------------------------------------------------------------------

/** Status of one provider attempt in broadcastTxWithStatus(). */
export type BroadcastAttemptStatus = 'trying' | 'verifying' | 'success' | 'already_exists' | 'failed';

/** Where we saw a tx during visibility / duplicate checks (trusted reads vs public indexers). */
export type DogeTxVisibilitySource = 'rpc' | 'commanddog' | 'blockchair' | 'blockcypher';

export interface BroadcastAttemptUpdate {
  provider: BroadcastRelayProvider;
  status: BroadcastAttemptStatus;
  /** Set when status is 'success' or 'already_exists'. */
  txid?: string;
  /** Set when status is 'failed'. */
  error?: string;
  /**
   * Relay returned OK but Blockchair / your RPC still did not see this tx after background probes — common with API-only relays;
   * tx may still propagate or may have been rejected by most nodes (try another relay / RPC push).
   */
  propagationUnverified?: boolean;
  /** Relay’s txid field disagreed with the hash derived from the signed hex — UI uses the local hash. */
  relayTxidMismatch?: boolean;
  /** Source that reported tx visibility (RPC / Command.dog / public indexer). */
  visibilitySource?: DogeTxVisibilitySource;
}

/** Human-readable provider labels for UI display. */
export const PROVIDER_LABELS: Record<BroadcastRelayProvider, string> = {
  blockchair: 'Blockchair',
  blockcypher: 'BlockCypher',
  commanddog: 'Command.dog',
  rpc: 'RPC node',
  tatum: 'Tatum',
};

/**
 * Benign relay responses: the tx is already known. Never treat `txn-mempool-conflict`
 * here — that usually means a *different* tx spent the same inputs (stale UTXO set).
 */
function isBenignDuplicateBroadcastError(msg: string): boolean {
  const lc = msg.toLowerCase();
  return (
    lc.includes('already exists') ||
    lc.includes('already in mempool') ||
    lc.includes('transaction already in block chain') ||
    lc.includes('duplicate transaction') ||
    lc.includes('already have') ||
    lc.includes('reject: duplicate')
  );
}

function isMempoolConflictError(msg: string): boolean {
  const lc = msg.toLowerCase();
  return lc.includes('txn-mempool-conflict') || /\b258\b/.test(lc);
}

async function sleepMs(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * After a relay returns HTTP success, wait until the tx is visible on a **trusted read path** when
 * configured (browser RPC proxy to your Core, or Command.dog tx status). Only if neither is enabled
 * do we poll Blockchair / BlockCypher.
 */
/** Live visibility flags while waiting for mempool/indexer propagation (UI diagnostics). */
export type BroadcastPropagationProbe = {
  attemptIndex: number;
  rpcV: boolean;
  cdV: boolean;
  chair: boolean;
  cypher: boolean;
};

export type BroadcastPropagationWaitOptions = {
  onProbe?: (probe: BroadcastPropagationProbe) => void;
};

async function waitForBroadcastAcceptance(
  txid: string,
  cfg: BroadcastConfig,
  waitOpts?: BroadcastPropagationWaitOptions,
): Promise<void> {
  const inBrowser = typeof window !== 'undefined';
  const rpcReads = inBrowser && browserCoreBackedJsonRpcReadsAvailable(cfg);
  /** In the browser we always have a Command.dog base (public or proxy) — use Core-backed status instead of Blockchair/Cypher. */
  const cdPropagationReads = inBrowser;
  const skipPublicIndexers = rpcReads || cdPropagationReads;
  const maxAttempts = 40;
  let chairStreak = 0;

  for (let i = 0; i < maxAttempts; i++) {
    let rpcV = false;
    let cdV = false;
    let chair = false;
    let cypher = false;
    try {
      const rpcP = rpcReads ? isTxVisibleOnRpc(txid) : Promise.resolve(false);
      const cdP = cdPropagationReads ? probeCommandDogTxKnown(txid) : Promise.resolve(false);
      const chairP = skipPublicIndexers ? Promise.resolve(false) : isTxVisibleOnBlockchair(txid);
      const cypherP = skipPublicIndexers
        ? Promise.resolve(false)
        : isTxVisibleOnBlockCypher(txid).catch(() => false);
      [rpcV, cdV, chair, cypher] = await Promise.all([rpcP, cdP, chairP, cypherP]);
    } catch {
      /* transient */
    }

    waitOpts?.onProbe?.({ attemptIndex: i, rpcV, cdV, chair, cypher });

    if (rpcReads && rpcV) return;
    if (cdPropagationReads && cdV) return;

    if (skipPublicIndexers) {
      const delayMs = i < 4 ? 400 : i < 10 ? 900 : 1900;
      await sleepMs(delayMs);
      continue;
    }

    if (chair && cypher) return;
    if (chair && (rpcV || cdV)) return;
    if (cypher && (rpcV || cdV)) return;

    if (chair) chairStreak += 1;
    else chairStreak = 0;

    if (!rpcReads && chairStreak >= 2 && i >= 3) return;
    if (chairStreak >= 3 && i >= 12) return;

    const delayMs = i < 4 ? 400 : i < 10 ? 900 : 1900;
    await sleepMs(delayMs);
  }

  throw new Error(
    'Relay accepted the transaction but it was not visible to your configured read sources (RPC / Command.dog) or public indexers after waiting. ' +
      'It likely did not propagate — use “Re-broadcast”, raise the fee, or put Dogecoin RPC first in Wallet → Broadcast.',
  );
}

/**
 * First source that sees this tx: RPC proxy, Command.dog (browser), then public indexers (non-browser only).
 * In the browser, Blockchair/BlockCypher are not used — Command.dog + optional RPC cover propagation.
 */
export async function getDogeTxVisibilitySource(txid: string): Promise<DogeTxVisibilitySource | null> {
  const cfg = loadBroadcastConfig();
  const inBrowser = typeof window !== 'undefined';
  const rpcReads = inBrowser && browserCoreBackedJsonRpcReadsAvailable(cfg);
  const cdPropagationReads = inBrowser;
  const needPublic = !rpcReads && !cdPropagationReads;
  try {
    const rpcP = rpcReads ? isTxVisibleOnRpc(txid) : Promise.resolve(false);
    const cdP = cdPropagationReads ? probeCommandDogTxKnown(txid) : Promise.resolve(false);
    const pubP = needPublic ? getDogePublicVisibilitySource(txid) : Promise.resolve(null);
    const [rpcV, cdV, pub] = await Promise.all([rpcP, cdP, pubP]);
    if (rpcV) return 'rpc';
    if (cdV) return 'commanddog';
    return pub;
  } catch {
    return null;
  }
}

/** @see {@link getDogeTxVisibilitySource} */
export async function isDogeTxVisibleOnExplorers(txid: string): Promise<boolean> {
  return (await getDogeTxVisibilitySource(txid)) !== null;
}

/** Returns which truly public source currently sees this txid (if any). */
export async function getDogePublicVisibilitySource(
  txid: string,
): Promise<'blockchair' | 'blockcypher' | null> {
  const chair = await isTxVisibleOnBlockchair(txid);
  if (chair) return 'blockchair';
  // BlockCypher tx GET can fail from browser CORS on some deployments — same try pattern as
  // waitForBroadcastAcceptance so “visible to explorers” matches what the broadcast wait saw.
  try {
    if (await isTxVisibleOnBlockCypher(txid)) return 'blockcypher';
  } catch {
    /* CORS / rate limit / offline */
  }
  return null;
}

/**
 * Compute the txid (big-endian hex) of a raw transaction using the
 * browser's built-in Web Crypto (double-SHA256, then byte-reverse).
 */
export async function txidFromRawHex(rawTxHex: string): Promise<string> {
  const bytes = Uint8Array.from({ length: rawTxHex.length / 2 }, (_, i) =>
    parseInt(rawTxHex.slice(i * 2, i * 2 + 2), 16),
  );
  const h1 = await crypto.subtle.digest('SHA-256', bytes);
  const h2 = await crypto.subtle.digest('SHA-256', h1);
  return Array.from(new Uint8Array(h2))
    .reverse()
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Normalize a relay’s txid against the hash implied by the signed hex (detect bogus API ids).
 */
export async function resolveCanonicalDogeTxidFromRelay(
  relayTxid: string,
  rawHex: string,
): Promise<{ txid: string; relayTxidMismatch: boolean }> {
  const relayTrim = relayTxid.trim();
  const relayLooksLikeTxid = /^[a-fA-F0-9]{64}$/.test(relayTrim);
  const computedTxid = await txidFromRawHex(rawHex);
  const relayNorm = relayLooksLikeTxid ? relayTrim.toLowerCase() : '';
  const relayTxidMismatch =
    relayLooksLikeTxid && relayNorm !== computedTxid.toLowerCase();
  const txid = relayLooksLikeTxid && !relayTxidMismatch ? relayNorm : computedTxid;
  return { txid, relayTxidMismatch };
}

/** Same visibility wait as inscription / OP_RETURN flows — uses current Wallet broadcast config. */
export async function waitForBroadcastPropagationVerified(
  txid: string,
  opts?: BroadcastPropagationWaitOptions,
): Promise<void> {
  await waitForBroadcastAcceptance(txid, loadBroadcastConfig(), opts);
}

/** `testmempoolaccept` on configured Core before send — no-op if RPC unset or method missing. */
export async function preflightDogecoinRpcMempoolAccept(rawHex: string): Promise<void> {
  await preflightTestMempoolAccept(rawHex, loadBroadcastConfig());
}

/**
 * Broadcast a raw transaction with per-provider status callbacks.
 *
 * Iterates through the user's configured broadcast order one provider at a
 * time, calling onAttempt before and after each attempt.  Unlike the
 * internal broadcastTransaction(), this function:
 *   - Never tries more than one provider at a time
 *   - Treats "already in mempool" responses as SUCCESS (the tx was broadcast
 *     in a previous session and is still pending confirmation)
 *   - When browser RPC reads and/or Command.dog reads are configured, propagation waits use only those paths
 *     (no Blockchair/BlockCypher in that wait).
 */
export type BroadcastTxWithStatusOptions = {
  /** Fires while waiting for Blockchair / Command.dog / RPC corroboration (interval varies by attempt). */
  onPropagationProbe?: (probe: BroadcastPropagationProbe) => void;
};

export async function broadcastTxWithStatus(
  rawTxHex: string,
  onAttempt: (update: BroadcastAttemptUpdate) => void,
  options?: BroadcastTxWithStatusOptions,
): Promise<string> {
  const cfg = loadBroadcastConfig();
  const order = resolvedBroadcastRelayOrder(cfg);
  const activeOrder = order.filter((provider) => {
    if (provider === 'rpc' && (!cfg.rpcUser || !cfg.rpcPass || !cfg.rpcUrl)) return false;
    if (provider === 'tatum' && !cfg.tatumApiKey?.trim()) return false;
    return true;
  });

  let lastError: string | null = null;

  for (let orderIndex = 0; orderIndex < order.length; orderIndex++) {
    const provider = order[orderIndex]!;
    if (provider === 'rpc' && (!cfg.rpcUser || !cfg.rpcPass || !cfg.rpcUrl)) {
      console.info(`[dojakweb:broadcast] skipping ${provider}: credentials missing`);
      continue;
    }
    if (provider === 'tatum' && !cfg.tatumApiKey?.trim()) {
      console.info(`[dojakweb:broadcast] skipping ${provider}: API key missing`);
      continue;
    }

    onAttempt({ provider, status: 'trying' });
    console.log(`[dojakweb:broadcast] trying ${provider}`);

    try {
      let relayTxid: string;
      if (provider === 'rpc') {
        relayTxid = await broadcastViaRpc(rawTxHex, cfg);
      } else if (provider === 'blockchair') {
        relayTxid = await broadcastViaBlockchair(rawTxHex);
      } else if (provider === 'blockcypher') {
        relayTxid = await broadcastViaBlockCypher(rawTxHex);
      } else if (provider === 'commanddog') {
        relayTxid = await broadcastViaCommandDog(rawTxHex);
      } else {
        relayTxid = await broadcastViaTatum(rawTxHex, cfg);
      }
      const { txid: canonicalTxid, relayTxidMismatch } = await resolveCanonicalDogeTxidFromRelay(
        relayTxid,
        rawTxHex,
      );

      console.log(`[dojakweb:broadcast] ${provider} relay accepted`, {
        txid: canonicalTxid,
        relayReturned: relayTxid.trim(),
        relayTxidMismatch,
      });
      onAttempt({
        provider,
        status: 'verifying',
        txid: canonicalTxid,
        ...(relayTxidMismatch ? { relayTxidMismatch: true } : {}),
      });
      try {
        await waitForBroadcastAcceptance(canonicalTxid, cfg, {
          onProbe: options?.onPropagationProbe,
        });
      } catch (probeErr) {
        const pmsg = probeErr instanceof Error ? probeErr.message : String(probeErr);
        const activeIndex = activeOrder.indexOf(provider);
        const isLastActiveRelay = activeIndex >= 0 && activeIndex === activeOrder.length - 1;
        if (isLastActiveRelay) {
          onAttempt({
            provider,
            status: 'success',
            txid: canonicalTxid,
            propagationUnverified: true,
            error: pmsg,
            ...(relayTxidMismatch ? { relayTxidMismatch: true } : {}),
          });
          console.warn(
            `[dojakweb:broadcast] ${provider} accepted tx but propagation remained unverified before timeout; returning provisional success`,
            { txid: canonicalTxid },
          );
          return canonicalTxid;
        }
        onAttempt({
          provider,
          status: 'failed',
          txid: canonicalTxid,
          error: pmsg,
          ...(relayTxidMismatch ? { relayTxidMismatch: true } : {}),
        });
        lastError = pmsg;
        console.warn(`[dojakweb:broadcast] ${provider} propagation verify failed:`, pmsg);
        continue;
      }
      onAttempt({
        provider,
        status: 'success',
        txid: canonicalTxid,
        ...(relayTxidMismatch ? { relayTxidMismatch: true } : {}),
      });
      console.log(`[dojakweb:broadcast] ${provider} verified`, { txid: canonicalTxid });
      return canonicalTxid;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const computedTxid = await txidFromRawHex(rawTxHex);

      const seenBy = await getDogeTxVisibilitySource(computedTxid);
      if (seenBy) {
        onAttempt({ provider, status: 'already_exists', txid: computedTxid, visibilitySource: seenBy });
        console.log(`[dojakweb:broadcast] ${provider} tx visible (${seenBy})`, { txid: computedTxid });
        return computedTxid;
      }

      if (isBenignDuplicateBroadcastError(msg)) {
        await sleepMs(1800);
        const seenByAfterWait = await getDogeTxVisibilitySource(computedTxid);
        if (seenByAfterWait) {
          onAttempt({
            provider,
            status: 'already_exists',
            txid: computedTxid,
            visibilitySource: seenByAfterWait,
          });
          console.log(`[dojakweb:broadcast] ${provider} already_in_mempool after wait`, { txid: computedTxid });
          return computedTxid;
        }
      }

      if (isMempoolConflictError(msg)) {
        const detail =
          'Mempool conflict: this transaction spends a UTXO that is already used by another pending transaction. ' +
          'Wait for your previous transaction to confirm, refresh balance/UTXOs, then rebuild — or use “rebuild” in the UI if offered.';
        lastError = detail;
        onAttempt({ provider, status: 'failed', error: detail });
        console.warn(`[dojakweb:broadcast] ${provider} mempool conflict (not treating as duplicate)`, { computedTxid });
        throw new Error(detail);
      }

      lastError = msg;
      onAttempt({ provider, status: 'failed', error: msg });
      console.warn(`[dojakweb:broadcast] ${provider} failed:`, msg);
    }
  }

  throw new Error(lastError ?? 'All broadcast providers failed.');
}

/** Short-lived cache so multi-tx UIs (e.g. 18-step inscribe) do not refetch the same tx every few seconds. */
const dogeConfirmCache = new Map<string, { at: number; value: number }>();
const DOGE_CONFIRM_CACHE_TTL_MS = 28_000;
const DOGE_CONFIRM_CACHE_MAX_KEYS = 160;

function dogeConfirmCacheGet(id: string): number | null {
  const e = dogeConfirmCache.get(id);
  if (!e) return null;
  if (Date.now() - e.at > DOGE_CONFIRM_CACHE_TTL_MS) {
    dogeConfirmCache.delete(id);
    return null;
  }
  return e.value;
}

function dogeConfirmCacheSet(id: string, value: number): void {
  dogeConfirmCache.set(id, { at: Date.now(), value });
  while (dogeConfirmCache.size > DOGE_CONFIRM_CACHE_MAX_KEYS) {
    const k = dogeConfirmCache.keys().next().value;
    if (k === undefined) break;
    dogeConfirmCache.delete(k);
  }
}

/** Drop cached confirmation counts so the next {@link getBestDogeTxConfirmations} hits the network (e.g. after “Refresh chain status”). */
export function invalidateDogeTxConfirmationsCache(txids: string | readonly string[]): void {
  const list = typeof txids === 'string' ? [txids] : txids;
  for (const raw of list) {
    const id = raw.trim().toLowerCase();
    if (/^[0-9a-f]{64}$/.test(id)) dogeConfirmCache.delete(id);
  }
}

/** Blockchair dashboard `/dogecoin/dashboards/transaction/{txid}` — derive depth when `confirmations` is omitted. */
export function confirmationsFromBlockchairDashboard(json: unknown, txidLower: string): number {
  if (!json || typeof json !== 'object') return 0;
  const root = json as Record<string, unknown>;
  const rawData = root.data;
  const ctx = root.context as Record<string, unknown> | undefined;
  const tip = typeof ctx?.state === 'number' ? ctx.state : null;

  if (!rawData || typeof rawData !== 'object') return 0;
  const block = rawData as Record<string, unknown>;
  type TxRow = {
    confirmations?: number;
    block_id?: number | null;
  };
  let tx: TxRow | undefined = (block[txidLower] as { transaction?: TxRow } | undefined)?.transaction;
  if (tx == null) {
    const first = Object.values(block)[0] as { transaction?: TxRow } | undefined;
    tx = first?.transaction;
  }
  if (tx == null || typeof tx !== 'object') return 0;

  if (typeof tx.confirmations === 'number' && tx.confirmations >= 0) return tx.confirmations;

  const bid = typeof tx.block_id === 'number' ? tx.block_id : null;
  // Mempool / unknown: Blockchair often omits confirmations and uses block_id <= 0 or null-ish
  if (bid == null || bid <= 0) return 0;

  if (tip != null && tip >= bid) return tip - bid + 1;

  // Included in a block but tip missing from payload — still mined (unlock “wait 1 conf” UX)
  return 1;
}

/**
 * Best confirmation depth: local Core (when configured) plus public indexers (max).
 *
 * **Broadcast settings:** relay order in Wallet → Broadcast controls **pushing** txs; for **reads** we also
 * respect that order for optional providers: **command.dog** `GET /v1/tx/{txid}/status` (your Core when
 * command.dog is in the relay list), BlockCypher tx GET and **Tatum** `GET /v3/dogecoin/tx/{hash}` when a
 * **Tatum API key** is saved (see [Tatum Dogecoin](https://docs.tatum.io/reference/rpc-dogecoin)).
 * Blockchair is always tried; BlockCypher may fail CORS in browsers.
 */
export async function getBestDogeTxConfirmations(txid: string): Promise<number> {
  const id = txid.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(id)) return 0;

  const cached = dogeConfirmCacheGet(id);
  if (cached !== null) return cached;

  const inBrowser = typeof window !== 'undefined';
  const cfg = loadBroadcastConfig();
  const useRpcReads = inBrowser && browserCoreBackedJsonRpcReadsAvailable(cfg);
  const broadcastOrder = resolvedBroadcastRelayOrder(cfg);
  const blockcypherEnabledInSettings = broadcastOrder.includes('blockcypher');
  const tatumKey = cfg.tatumApiKey?.trim() ?? '';
  const queryTatum = Boolean(tatumKey && broadcastOrder.includes('tatum'));

  const fromBlockchair = async (): Promise<number> => {
    try {
      const res = await fetch(`https://api.blockchair.com/dogecoin/dashboards/transaction/${id}`);
      if (!res.ok) return 0;
      const data = await res.json().catch(() => null);
      return confirmationsFromBlockchairDashboard(data, id);
    } catch {
      return 0;
    }
  };

  const fromBlockCypher = async (): Promise<number> => {
    try {
      const res = await fetch(`https://api.blockcypher.com/v1/doge/main/txs/${id}`);
      if (!res.ok) return 0;
      const data = await res.json().catch(() => null);
      return typeof data?.confirmations === 'number' ? data.confirmations : 0;
    } catch {
      return 0;
    }
  };

  const fromTatum = async (): Promise<number> => {
    if (!queryTatum) return 0;
    try {
      const res = await fetch(`https://api.tatum.io/v3/dogecoin/tx/${id}`, {
        headers: { 'x-api-key': tatumKey, Accept: 'application/json' },
      });
      if (!res.ok) return 0;
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!data) return 0;
      const conf = data.confirmations;
      if (typeof conf === 'number' && conf >= 0) return conf;
      const blockNum = data.blockNumber ?? data.block;
      if (typeof blockNum === 'number' && blockNum > 0) return 1;
      return 0;
    } catch {
      return 0;
    }
  };

  const rPromise = useRpcReads ? fetchConfirmationsFromRpc(id) : Promise.resolve(null);
  const cdPromise = commandDogChainReadsEnabled() ? fetchConfirmationsFromCommandDog(id) : Promise.resolve(null);
  const aPromise = fromBlockchair();
  const queryCypher = inBrowser ? blockcypherEnabledInSettings : !useRpcReads;
  const bPromise = queryCypher ? fromBlockCypher() : Promise.resolve(0);
  const tatPromise = queryTatum ? fromTatum() : Promise.resolve(0);
  const [r, cd, a, b, tat] = await Promise.all([rPromise, cdPromise, aPromise, bPromise, tatPromise]);

  const parts: number[] = [a, b, tat];
  if (r !== null) parts.push(r);
  if (cd !== null) parts.push(cd);
  const best = Math.max(...parts);
  const cypherLabel = queryCypher
    ? String(b)
    : inBrowser
      ? 'skipped(browser; BlockCypher not in Wallet broadcast order)'
      : 'skipped';
  const tatumLabel = queryTatum ? String(tat) : 'skipped(no key or not in relay order)';
  const cdLabel = commandDogChainReadsEnabled() ? String(cd ?? '—') : 'skipped(not in relay order)';
  console.log(
    `[dojakweb:poll] ${id.slice(0, 8)}… confirmations rpc=${r ?? '—'} commanddog=${cdLabel} chair=${a} cypher=${cypherLabel} tatum=${tatumLabel} → max=${best}`,
  );
  dogeConfirmCacheSet(id, best);
  return best;
}

/**
 * Default interval for {@link pollTxForConfirmation} (matches wallet RPC + explorer setup).
 * Use in UI for static hints (e.g. “checks about every N seconds”).
 *
 * Dogecoin targets ~1 minute blocks; polling every few seconds mostly burns API quota before the first conf.
 * RPC path is still faster than browser-only (no Cypher), but not aggressive.
 */
export function getConfirmationPollIntervalMs(): number {
  const inBrowser = typeof window !== 'undefined';
  const cfg = loadBroadcastConfig();
  const coreBackedPollFast =
    inBrowser &&
    (getCommandDogApiBaseUrl().trim().length > 0 ||
      (browserRpcProxyAbsoluteUrl() && hasBroadcastRpcConfiguredFromCfg(cfg)));
  const commandDogPollFast =
    inBrowser && resolvedBroadcastRelayOrder(cfg).includes('commanddog');
  return coreBackedPollFast || commandDogPollFast ? 26_000 : 42_000;
}

/**
 * Poll until txid has at least targetConfirmations (RPC + command.dog + Blockchair + optional BlockCypher / Tatum per Wallet broadcast order + API key).
 * Calls onUpdate with the best confirmation count after each pass.
 * Throws DOMException('AbortError') if AbortSignal aborts.
 * Throws Error after maxWaitMs (default 45m) so the UI is not stuck if all APIs lag.
 */
export async function pollTxForConfirmation(
  txid: string,
  onUpdate: (confirmations: number) => void,
  options: {
    signal?: AbortSignal;
    intervalMs?: number;
    targetConfirmations?: number;
    maxWaitMs?: number;
    /**
     * Called immediately before sleeping until the next poll (not called after the final success).
     * Use for UI countdowns (“next check in …”) so users know we are not stuck.
     */
    onBeforeSleep?: (args: { ms: number; confirmations: number }) => void;
  } = {},
): Promise<void> {
  const {
    signal,
    intervalMs: intervalMsOpt,
    targetConfirmations = 1,
    maxWaitMs = 45 * 60 * 1000,
    onBeforeSleep,
  } = options;
  const intervalMs = intervalMsOpt ?? getConfirmationPollIntervalMs();

  const started = Date.now();

  const sleep = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, ms);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(t);
          reject(new DOMException('Polling aborted', 'AbortError'));
        },
        { once: true },
      );
    });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (signal?.aborted) throw new DOMException('Polling aborted', 'AbortError');
    if (Date.now() - started > maxWaitMs) {
      throw new Error(
        'Timed out waiting for confirmations on public indexers. If an explorer or your wallet shows the tx mined, ' +
          'uncheck “wait for 1 confirmation”, click “Refresh chain status”, or continue manually.',
      );
    }

    let confThisRound = 0;
    try {
      confThisRound = await getBestDogeTxConfirmations(txid);
      onUpdate(confThisRound);
      if (confThisRound >= targetConfirmations) return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      console.warn('[dojakweb:poll] transient error:', err);
    }

    onBeforeSleep?.({ ms: intervalMs, confirmations: confThisRound });
    await sleep(intervalMs);
  }
}
