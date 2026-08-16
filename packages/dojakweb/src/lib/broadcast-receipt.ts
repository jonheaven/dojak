/**
 * Persist last broadcast txids per flow so a refresh still shows the explorer
 * link while the indexer / UI catches up.
 */
import { useCallback, useSyncExternalStore } from 'react';

const KEY = 'dojakweb:broadcastReceipts:v1';
const CHANGED = 'dojakweb:broadcastReceipts:changed';
const MAX_ENTRIES = 40;

export type BroadcastReceipt = {
  txid: string;
  commitTxid?: string;
  label?: string;
  extra?: Record<string, string>;
  at: number;
};

function canStore(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** Same raw localStorage string → same map object (React 19 getSnapshot must be referentially stable). */
let cachedRaw: string | null | undefined;
let cachedMap: Record<string, BroadcastReceipt> = {};

function parseAll(raw: string | null): Record<string, BroadcastReceipt> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, BroadcastReceipt> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const row = v as BroadcastReceipt;
      if (typeof row.txid === 'string' && row.txid.trim()) out[k] = row;
    }
    return out;
  } catch {
    return {};
  }
}

function loadAll(): Record<string, BroadcastReceipt> {
  if (!canStore()) {
    cachedRaw = undefined;
    cachedMap = {};
    return cachedMap;
  }
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cachedMap;
  }
  if (cachedMap && cachedRaw === raw) return cachedMap;
  cachedRaw = raw;
  cachedMap = parseAll(raw);
  return cachedMap;
}

function writeAll(map: Record<string, BroadcastReceipt>): void {
  if (!canStore()) return;
  const entries = Object.entries(map).sort((a, b) => (b[1].at ?? 0) - (a[1].at ?? 0));
  const trimmed = Object.fromEntries(entries.slice(0, MAX_ENTRIES));
  const serialized = JSON.stringify(trimmed);
  window.localStorage.setItem(KEY, serialized);
  cachedRaw = serialized;
  cachedMap = trimmed;
  window.dispatchEvent(new Event(CHANGED));
}

export function loadBroadcastReceipt(flowKey: string): BroadcastReceipt | null {
  const key = flowKey.trim();
  if (!key) return null;
  return loadAll()[key] ?? null;
}

export function saveBroadcastReceipt(
  flowKey: string,
  receipt: Omit<BroadcastReceipt, 'at'> & { at?: number },
): void {
  const key = flowKey.trim();
  const txid = receipt.txid.trim();
  if (!key || !txid) return;
  const map = loadAll();
  map[key] = {
    ...receipt,
    txid,
    commitTxid: receipt.commitTxid?.trim() || undefined,
    at: receipt.at ?? Date.now(),
  };
  writeAll(map);
}

export function clearBroadcastReceipt(flowKey: string): void {
  const key = flowKey.trim();
  if (!key) return;
  const map = loadAll();
  if (!(key in map)) return;
  delete map[key];
  writeAll(map);
}

function subscribe(cb: () => void): () => void {
  if (!canStore()) return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) {
      cachedRaw = undefined;
      cb();
    }
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGED, cb);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGED, cb);
  };
}

function getServerSnapshot(): BroadcastReceipt | null {
  return null;
}

/** Last broadcast for this flow, restored from localStorage after refresh. */
export function useBroadcastReceipt(flowKey: string | null): {
  receipt: BroadcastReceipt | null;
  remember: (receipt: Omit<BroadcastReceipt, 'at'> & { at?: number }) => void;
  clear: () => void;
} {
  const key = flowKey?.trim() || '';
  const receipt = useSyncExternalStore(
    subscribe,
    () => (key ? loadBroadcastReceipt(key) : null),
    getServerSnapshot,
  );
  const remember = useCallback(
    (next: Omit<BroadcastReceipt, 'at'> & { at?: number }) => {
      if (!key) return;
      saveBroadcastReceipt(key, next);
    },
    [key],
  );
  const clear = useCallback(() => {
    if (!key) return;
    clearBroadcastReceipt(key);
  }, [key]);
  return { receipt, remember, clear };
}
