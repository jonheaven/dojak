/**
 * Browser-safe Dogecoin Core JSON-RPC:
 *
 * 1. **Dogex desktop:** `dogex_json_rpc` → local dogex HTTP `/rpc` (when Tauri bridge is active).
 * 2. **Command.dog:** `POST {COMMAND_DOG}/rpc/{method}` with `{ params }` — no wallet Core credentials
 *    (public allowlist on api.command.dog; self-hosted can widen via `COMMAND_DOG_API_ALLOW_RAW_RPC`).
 * 3. **Legacy:** same-origin `/api/rpc-proxy` (or env override) with Wallet Settings URL + user/pass.
 *
 * Architecture, wallet-only methods (`bumpfee`, `listunspent`), and `walletCoreOnly`:
 * **`docs/chain-rpc-and-command-dog.md`**
 */
import { getCommandDogApiBaseUrl } from '../utils/api';

function proxyPathFromEnv(): string {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_DOGE_RPC_PROXY) {
    const v = process.env.NEXT_PUBLIC_DOGE_RPC_PROXY;
    if (v.startsWith('http://') || v.startsWith('https://')) return v;
    return v.startsWith('/') ? v : `/${v}`;
  }
  return '/api/rpc-proxy';
}

/**
 * Absolute URL to the JSON-RPC proxy. Empty string on the server — never use direct Core from
 * the browser when this is non-empty (avoids CORS preflight failures on Authorization).
 */
export function browserRpcProxyAbsoluteUrl(): string {
  if (typeof window === 'undefined') return '';
  const base = proxyPathFromEnv();
  if (base.startsWith('http://') || base.startsWith('https://')) return base;
  return `${window.location.origin}${base.startsWith('/') ? base : `/${base}`}`;
}

/** @deprecated use browserRpcProxyAbsoluteUrl() */
export function getBrowserRpcProxyUrl(): string | null {
  const u = browserRpcProxyAbsoluteUrl();
  return u || null;
}

export interface RpcCredentials {
  rpcUrl: string;
  rpcUser: string;
  rpcPass: string;
}

/** Options for {@link rpcViaProxyDetailed}. */
export type RpcViaProxyOptions = {
  /**
   * Skip Command.dog and only use the wallet-configured Core (same-origin proxy + creds).
   * Use for “Test RPC” and other checks that must validate **your** node, not the public API.
   */
  walletCoreOnly?: boolean;
};

/**
 * POST JSON-RPC-shaped call via Next proxy (remote-rpc provider).
 * Returns parsed `result` or null on failure.
 */
export type RpcProxyResult<T> =
  | { ok: true; result: T }
  | { ok: false; error: string };

function dogexHttpBaseFromEnv(): string {
  const v = import.meta.env.VITE_DOGEX_HTTP_BASE;
  if (typeof v === 'string' && v.trim()) return v.trim().replace(/\/+$/, '');
  return 'http://127.0.0.1:8080';
}

let tauriDogexProbe: Promise<boolean> | null = null;
let tauriDogexActive: boolean | null = null;

async function tauriDogexBridgeEnabled(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (tauriDogexActive === true) return true;
  if (tauriDogexActive === false) return false;
  if (!tauriDogexProbe) {
    tauriDogexProbe = (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const full = await invoke<Record<string, unknown>>('dogex_json_rpc', {
          dogexBase: dogexHttpBaseFromEnv(),
          method: 'ping',
          params: [],
        });
        if (full && typeof full === 'object' && 'error' in full && full.error != null) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    })();
  }
  const ok = await tauriDogexProbe;
  tauriDogexActive = ok;
  return ok;
}

function parseDogexFullRpcResponse<T>(full: unknown): RpcProxyResult<T> {
  if (!full || typeof full !== 'object') {
    return { ok: false, error: 'Empty dogex RPC response' };
  }
  const o = full as { result?: T; error?: { message?: string } | null };
  if (o.error != null) {
    if (typeof o.error === 'object' && o.error && 'message' in o.error && typeof o.error.message === 'string') {
      return { ok: false, error: o.error.message };
    }
    return { ok: false, error: JSON.stringify(o.error) };
  }
  return { ok: true, result: o.result as T };
}

function hasUsableWalletRpcCreds(creds: RpcCredentials | null | undefined): creds is RpcCredentials {
  if (creds == null) return false;
  const url = creds.rpcUrl?.trim();
  const user = creds.rpcUser?.trim();
  const pass = creds.rpcPass;
  return Boolean(url && user && pass !== undefined && pass !== '');
}

/**
 * `POST /rpc/{method}` on Command.dog — response body is the Core **result** value (not a JSON-RPC envelope).
 * Returns `null` when Command.dog base URL is unset (skip), otherwise an ok/err result.
 */
async function tryCommandDogRpcDetailed<T>(method: string, params: unknown[]): Promise<RpcProxyResult<T> | null> {
  if (typeof window === 'undefined') return null;
  const base = getCommandDogApiBaseUrl().trim().replace(/\/+$/, '');
  if (!base) return null;
  try {
    const res = await fetch(`${base}/rpc/${encodeURIComponent(method)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params }),
    });
    const data = (await res.json().catch(() => null)) as
      | (Record<string, unknown> & { error?: string })
      | null;
    if (!res.ok) {
      const msg =
        data && typeof data.error === 'string' && data.error
          ? data.error
          : `Command.dog /rpc/${method} HTTP ${res.status}`;
      return { ok: false, error: msg };
    }
    return { ok: true, result: data as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

/**
 * Same as {@link rpcViaProxy} but returns structured errors (for UI like “Test RPC”).
 *
 * When `creds` is omitted or null, only Tauri (if any) and Command.dog are used — no same-origin wallet proxy.
 */
export async function rpcViaProxyDetailed<T = unknown>(
  method: string,
  params: unknown[],
  creds?: RpcCredentials | null,
  opts?: RpcViaProxyOptions,
): Promise<RpcProxyResult<T>> {
  if (await tauriDogexBridgeEnabled()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const full = await invoke<unknown>('dogex_json_rpc', {
        dogexBase: dogexHttpBaseFromEnv(),
        method,
        params,
      });
      return parseDogexFullRpcResponse<T>(full);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Tauri dogex_json_rpc failed' };
    }
  }

  const cd =
    opts?.walletCoreOnly !== true ? await tryCommandDogRpcDetailed<T>(method, params) : null;
  if (cd?.ok) return cd;

  if (!hasUsableWalletRpcCreds(creds)) {
    if (cd && !cd.ok) return cd;
    if (opts?.walletCoreOnly) {
      return { ok: false, error: 'Enter RPC URL, username, and password to test your Core.' };
    }
    return {
      ok: false,
      error:
        'No wallet RPC credentials in Wallet Settings and Command.dog did not return a result (set VITE_COMMAND_DOG_API_URL or enter Core URL + user + password).',
    };
  }

  const url = browserRpcProxyAbsoluteUrl();
  if (!url) {
    if (cd && !cd.ok) return cd;
    return {
      ok: false,
      error:
        'No same-origin RPC proxy URL (e.g. /api/rpc-proxy) — cannot reach your Core from the browser without Command.dog or dogex.',
    };
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method,
        params,
        provider: 'remote-rpc',
        providerConfig: {
          remoteRpcUrl: creds.rpcUrl,
          remoteRpcUser: creds.rpcUser,
          remoteRpcPass: creds.rpcPass,
        },
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      result?: T;
      error?: string;
      message?: string;
    };
    if (!res.ok) {
      const msg =
        (typeof data.error === 'string' && data.error) ||
        (typeof data.message === 'string' && data.message) ||
        `HTTP ${res.status}`;
      return { ok: false, error: msg };
    }
    if (data.error != null) {
      return { ok: false, error: typeof data.error === 'string' ? data.error : String(data.error) };
    }
    return { ok: true, result: data.result as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

export async function rpcViaProxy<T = unknown>(
  method: string,
  params: unknown[],
  creds?: RpcCredentials | null,
  opts?: RpcViaProxyOptions,
): Promise<T | null> {
  const r = await rpcViaProxyDetailed<T>(method, params, creds, opts);
  return r.ok ? r.result : null;
}

/** `getblockcount` via proxy — confirms URL, credentials, and Core reachability from your app. */
export type RpcChainTipResult =
  | { ok: true; blocks: number }
  | { ok: false; error: string };

export async function fetchRpcChainTipHeight(creds: RpcCredentials): Promise<RpcChainTipResult> {
  const r = await rpcViaProxyDetailed<number>('getblockcount', [], creds, { walletCoreOnly: true });
  if (!r.ok) return { ok: false, error: r.error };
  const n = r.result;
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    return { ok: false, error: 'RPC returned an unexpected value (expected chain height number).' };
  }
  return { ok: true, blocks: Math.floor(n) };
}

type BlockchainInfoRpc = {
  chain?: string;
  blocks?: number;
  headers?: number;
  verificationprogress?: number;
  initialblockdownload?: boolean;
};

/** `getblockchaininfo` via proxy — chain tip plus sync state for settings UI “Test RPC”. */
export type RpcDetailedHealthResult =
  | {
      ok: true;
      blocks: number;
      headers: number | undefined;
      verificationProgressPercent: number | undefined;
      chain: string | undefined;
      initialBlockDownload: boolean | undefined;
    }
  | { ok: false; error: string };

export async function fetchRpcDetailedHealth(creds: RpcCredentials): Promise<RpcDetailedHealthResult> {
  const r = await rpcViaProxyDetailed<BlockchainInfoRpc>('getblockchaininfo', [], creds, {
    walletCoreOnly: true,
  });
  if (!r.ok) return { ok: false, error: r.error };
  const b = r.result;
  const blocks = typeof b?.blocks === 'number' && Number.isFinite(b.blocks) ? Math.floor(b.blocks) : NaN;
  if (!Number.isFinite(blocks)) {
    return { ok: false, error: 'getblockchaininfo returned no usable block height.' };
  }
  const headers = typeof b?.headers === 'number' && Number.isFinite(b.headers) ? Math.floor(b.headers) : undefined;
  const vp = b?.verificationprogress;
  const verificationProgressPercent =
    typeof vp === 'number' && Number.isFinite(vp) ? Math.min(100, Math.max(0, vp <= 1 ? vp * 100 : vp)) : undefined;
  const chain = typeof b?.chain === 'string' && b.chain ? b.chain : undefined;
  const ibd = b?.initialblockdownload;
  const initialBlockDownload = typeof ibd === 'boolean' ? ibd : undefined;
  return {
    ok: true,
    blocks,
    headers,
    verificationProgressPercent,
    chain,
    initialBlockDownload,
  };
}

/** Dogecoin Core default relay minimum ≈0.001 DOGE/kB (koinu per kB). */
const MIN_RELAY_KOINU_PER_KB = 100_000;
const INCLUSION_FLOOR_KOINU_PER_KB = 1_000_000;
const MAX_SANE_FEE_KOINU_PER_KB = 1_000_000_000; // 10 DOGE/kB cap against bad RPC data

export type RpcSmartFeeResult =
  | { ok: true; koinuPerKb: number; blocks: number; source: 'estimatesmartfee' | 'estimatefee' }
  | { ok: false; error: string };

type EstimateSmartFeeRpc = {
  feerate?: number | string;
  blocks?: number;
  errors?: string[];
};

function parseDogePerKb(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  if (typeof v === 'string') {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/**
 * Fee rate in koinu per kB (same unit as inscription `feeRate`), from Core `estimatesmartfee` or `estimatefee`.
 * Clamped to at least relay-minimum koinu/kB.
 */
export async function fetchRpcSmartFeeKoinuPerKb(
  creds: RpcCredentials,
  targetBlocks = 6,
): Promise<RpcSmartFeeResult> {
  const smart = await rpcViaProxyDetailed<EstimateSmartFeeRpc>(
    'estimatesmartfee',
    [targetBlocks],
    creds,
    { walletCoreOnly: true },
  );
  if (smart.ok) {
    const dogePerKb = parseDogePerKb(smart.result?.feerate);
    if (dogePerKb != null) {
      const koinuPerKb = Math.min(
        Math.max(Math.ceil(dogePerKb * 1e8), INCLUSION_FLOOR_KOINU_PER_KB),
        MAX_SANE_FEE_KOINU_PER_KB,
      );
      const blocks =
        typeof smart.result?.blocks === 'number' && Number.isFinite(smart.result.blocks)
          ? smart.result.blocks
          : targetBlocks;
      return { ok: true, koinuPerKb, blocks, source: 'estimatesmartfee' };
    }
  }

  const legacy = await rpcViaProxyDetailed<number>('estimatefee', [targetBlocks], creds, {
    walletCoreOnly: true,
  });
  if (legacy.ok) {
    const v = legacy.result;
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      const koinuPerKb = Math.min(
        Math.max(Math.ceil(v * 1e8), INCLUSION_FLOOR_KOINU_PER_KB),
        MAX_SANE_FEE_KOINU_PER_KB,
      );
      return { ok: true, koinuPerKb, blocks: targetBlocks, source: 'estimatefee' };
    }
  }

  const err = !smart.ok
    ? smart.error
    : !legacy.ok
      ? legacy.error
      : 'estimatesmartfee returned no positive feerate; estimatefee also unavailable';
  return { ok: false, error: err };
}
