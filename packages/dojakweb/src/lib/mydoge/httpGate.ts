/**
 * Shared GET gate for api.mydoge.com.
 *
 * Wallet UI, charms, coin selection, listing polls, and inscription lookups all
 * used to fire parallel `cache: 'no-store'` fetches. MyDoge then 429s and the
 * console fills with duplicate `/utxos/:addr` lines.
 *
 * This gate:
 *  - coalesces in-flight GETs per URL
 *  - serializes MyDoge GETs (one at a time, ≥400ms between starts)
 *  - TTL-caches JSON (UTXOs ~20s, inscriptions longer)
 *  - on 429: honors Retry-After, pauses the whole gate, serves stale if any
 *
 * Lives on `globalThis` so React Strict Mode / HMR share one queue.
 */

const STORE_KEY = '__dojakMydogeGate_v1';
const MIN_GAP_MS = 400;
const DEFAULT_TTL_MS = 25_000;
const UTXO_TTL_MS = 20_000;
const INSCRIPTION_LIST_TTL_MS = 45_000;
const INSCRIPTION_TTL_MS = 60_000;
const DRC20_TTL_MS = 45_000;
const WALLET_INFO_TTL_MS = 20_000;
const STALE_MS = 5 * 60_000;
const DEFAULT_429_MS = 60_000;
const MAX_429_MS = 5 * 60_000;
const MAX_CACHE = 200;
const WORK_TTL_MS = 20_000;

export class MydogeHttpError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`Request failed (${status}): ${body || 'rate limited'}`.trim());
    this.name = 'MydogeHttpError';
    this.status = status;
    this.body = body;
  }
}

type CacheEnt = { at: number; json: unknown; status: number };
type WorkEnt = { at: number; value: unknown };

type GateStore = {
  chain: Promise<void>;
  lastStart: number;
  cooldownUntil: number;
  cache: Map<string, CacheEnt>;
  inflight: Map<string, Promise<unknown>>;
  workCache: Map<string, WorkEnt>;
  workInflight: Map<string, Promise<unknown>>;
  logged429At: number;
};

function emptyStore(): GateStore {
  return {
    chain: Promise.resolve(),
    lastStart: 0,
    cooldownUntil: 0,
    cache: new Map(),
    inflight: new Map(),
    workCache: new Map(),
    workInflight: new Map(),
    logged429At: 0,
  };
}

function getStore(): GateStore {
  const g = globalThis as typeof globalThis & { [STORE_KEY]?: GateStore };
  if (!g[STORE_KEY]) g[STORE_KEY] = emptyStore();
  return g[STORE_KEY]!;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function isMydogeApiUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'api.mydoge.com' || host.endsWith('.mydoge.com');
  } catch {
    return /api\.mydoge\.com/i.test(url);
  }
}

function ttlForUrl(url: string): number {
  const path = url.toLowerCase();
  if (path.includes('/utxos/')) return UTXO_TTL_MS;
  if (path.includes('/inscriptions/')) return INSCRIPTION_LIST_TTL_MS;
  if (path.includes('/inscription/')) return INSCRIPTION_TTL_MS;
  if (path.includes('/drc20/')) return DRC20_TTL_MS;
  if (path.includes('/wallet/info')) return WALLET_INFO_TTL_MS;
  return DEFAULT_TTL_MS;
}

function cacheKey(url: string): string {
  return url.trim();
}

function evictIfNeeded(map: Map<string, { at: number }>): void {
  if (map.size <= MAX_CACHE) return;
  const oldest = [...map.entries()].sort((a, b) => a[1].at - b[1].at);
  const drop = map.size - MAX_CACHE + 20;
  for (let i = 0; i < drop && i < oldest.length; i++) {
    map.delete(oldest[i]![0]);
  }
}

function parseRetryAfterMs(header: string | null): number {
  if (!header) return DEFAULT_429_MS;
  const sec = Number(header.trim());
  if (Number.isFinite(sec) && sec >= 0) {
    return Math.min(MAX_429_MS, Math.max(5_000, Math.round(sec * 1000)));
  }
  return DEFAULT_429_MS;
}

function enqueue<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const store = getStore();
  const run = store.chain.then(async () => {
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    }
    const now = Date.now();
    const waitCd = store.cooldownUntil - now;
    if (waitCd > 0) await sleep(waitCd, signal);
    const gap = MIN_GAP_MS - (Date.now() - store.lastStart);
    if (gap > 0) await sleep(gap, signal);
    store.lastStart = Date.now();
    return fn();
  });
  store.chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function fetchOnce(
  url: string,
  opts?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<{ status: number; json: unknown; retryAfterMs?: number }> {
  const timeoutMs = opts?.timeoutMs ?? 8_000;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const onParentAbort = () => ctrl?.abort();
  opts?.signal?.addEventListener('abort', onParentAbort, { once: true });
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const response = await fetch(url, {
      signal: ctrl?.signal ?? opts?.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const retryAfterMs =
      response.status === 429 ? parseRetryAfterMs(response.headers.get('Retry-After')) : undefined;
    if (response.status === 429) {
      return { status: 429, json: null, retryAfterMs };
    }
    const text = await response.text().catch(() => '');
    if (!response.ok) {
      throw new MydogeHttpError(response.status, text || response.statusText);
    }
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
    }
    return { status: response.status, json };
  } catch (error: unknown) {
    if (error instanceof MydogeHttpError) throw error;
    const name = error instanceof Error ? error.name : '';
    if (error instanceof TypeError || name === 'AbortError') {
      throw error;
    }
    throw error;
  } finally {
    if (timer != null) clearTimeout(timer);
    opts?.signal?.removeEventListener('abort', onParentAbort);
  }
}

export type GatedMydogeGetOpts = {
  timeoutMs?: number;
  networkErrorMessage?: string;
  signal?: AbortSignal;
};

/**
 * Gated JSON GET for api.mydoge.com. Callers that already use `fetchJson`
 * should go through this automatically.
 */
export async function gatedMydogeGetJson(url: string, opts?: GatedMydogeGetOpts): Promise<any> {
  const store = getStore();
  const key = cacheKey(url);
  const ttl = ttlForUrl(url);
  const now = Date.now();
  const hit = store.cache.get(key);
  if (hit && now - hit.at < ttl) {
    return hit.json;
  }

  const existing = store.inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    try {
      // Fresh enough after waiting on the queue?
      const again = store.cache.get(key);
      const t0 = Date.now();
      if (again && t0 - again.at < ttl) return again.json;

      const result = await enqueue(() => fetchOnce(url, opts), opts?.signal);

      if (result.status === 429) {
        store.cooldownUntil = Math.max(
          store.cooldownUntil,
          Date.now() + (result.retryAfterMs ?? DEFAULT_429_MS),
        );
        if (Date.now() - store.logged429At > 5_000) {
          store.logged429At = Date.now();
          const stale = again ?? hit;
          console.warn('[mydoge-gate] 429 — pausing MyDoge GETs', {
            retryAfterMs: result.retryAfterMs ?? DEFAULT_429_MS,
            servingStale: Boolean(stale),
          });
        }
        const stale = store.cache.get(key) ?? hit;
        if (stale && Date.now() - stale.at < STALE_MS) {
          return stale.json;
        }
        throw new MydogeHttpError(429, 'Too Many Requests');
      }

      store.cache.set(key, { at: Date.now(), json: result.json, status: result.status });
      evictIfNeeded(store.cache);
      return result.json;
    } catch (error: unknown) {
      const stale = store.cache.get(key) ?? hit;
      if (stale && Date.now() - stale.at < STALE_MS) {
        const status = error instanceof MydogeHttpError ? error.status : 0;
        if (status === 429 || status >= 500 || status === 0) {
          return stale.json;
        }
      }
      if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) {
        throw new Error(
          opts?.networkErrorMessage ?? 'Balance service is unavailable. Please retry in a moment.',
        );
      }
      throw error;
    } finally {
      store.inflight.delete(key);
    }
  })();

  store.inflight.set(key, p);
  return p;
}

/** Address-level (or other) memo for multi-page UTXO walks. */
export function memoizeMydogeWork<T>(key: string, fn: () => Promise<T>, ttlMs = WORK_TTL_MS): Promise<T> {
  const store = getStore();
  const now = Date.now();
  const hit = store.workCache.get(key);
  if (hit && now - hit.at < ttlMs) {
    return Promise.resolve(hit.value as T);
  }
  const inflight = store.workInflight.get(key);
  if (inflight) return inflight as Promise<T>;

  const p = fn().then(
    (value) => {
      store.workCache.set(key, { at: Date.now(), value });
      evictIfNeeded(store.workCache);
      store.workInflight.delete(key);
      return value;
    },
    (err: unknown) => {
      store.workInflight.delete(key);
      if (hit && Date.now() - hit.at < STALE_MS) {
        return hit.value as T;
      }
      throw err;
    },
  );
  store.workInflight.set(key, p);
  return p;
}

/** Drop cached MyDoge JSON + UTXO memos (after broadcast or user force-refresh). */
export function invalidateMydogeCache(opts?: { address?: string; utxosOnly?: boolean }): void {
  const store = getStore();
  const addr = opts?.address?.trim().toLowerCase();
  const keep = (url: string): boolean => {
    if (opts?.utxosOnly && !url.toLowerCase().includes('/utxos/')) return true;
    if (addr) {
      return !url.toLowerCase().includes(addr) && !url.toLowerCase().includes(encodeURIComponent(addr));
    }
    return false;
  };
  for (const key of [...store.cache.keys()]) {
    if (!keep(key)) store.cache.delete(key);
  }
  for (const key of [...store.workCache.keys()]) {
    if (!addr || key.toLowerCase().includes(addr)) store.workCache.delete(key);
  }
}

export function invalidateMydogeUtxoCaches(address?: string): void {
  invalidateMydogeCache({ address, utxosOnly: true });
}
