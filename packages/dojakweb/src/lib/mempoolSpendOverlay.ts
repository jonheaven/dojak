/**
 * Session overlay for spendable UTXOs after local broadcasts.
 * Indexers lag → stale "unspent" coins → bad-txns-inputs-spent.
 * Track spent outpoints + our change so the next send can chain.
 */

export type PaymentUtxo = {
  txid: string;
  vout: number;
  value: number;
  scriptPubKey?: string;
};

const STORAGE_KEY = 'dogeco:mempool-utxo-v1';
/** Also read legacy keys from casino / earlier dojakweb sessions. */
const LEGACY_STORAGE_KEYS = [
  'dojakweb:mempool-utxo-v1',
  'dogecoin.games:mempool-utxo-v1',
] as const;
const ENTRY_TTL_MS = 2 * 60 * 60 * 1000;

type OutpointKey = string;

type LocalChange = PaymentUtxo & { createdAt: number };

type AddressBag = {
  spent: Record<OutpointKey, number>;
  change: LocalChange[];
};

type Store = Record<string, AddressBag>;

function outpointKey(txid: string, vout: number): OutpointKey {
  return `${txid.trim().toLowerCase()}:${vout}`;
}

function addrKey(address: string): string {
  return address.trim().toLowerCase();
}

function loadStore(): Store {
  if (typeof sessionStorage === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Store;
      if (parsed && typeof parsed === 'object') return parsed;
    }
    // Migrate / merge legacy overlays (casino bets on dogecoin.games, older dojakweb).
    const merged: Store = {};
    for (const key of LEGACY_STORAGE_KEYS) {
      const legacy = sessionStorage.getItem(key);
      if (!legacy) continue;
      try {
        const parsed = JSON.parse(legacy) as Store;
        if (!parsed || typeof parsed !== 'object') continue;
        for (const [addr, bag] of Object.entries(parsed)) {
          const cur = merged[addr] ?? { spent: {}, change: [] };
          merged[addr] = {
            spent: { ...cur.spent, ...(bag.spent ?? {}) },
            change: [...(cur.change ?? []), ...(bag.change ?? [])],
          };
        }
      } catch {
        /* ignore bad legacy */
      }
    }
    if (Object.keys(merged).length) {
      saveStore(merged);
      return merged;
    }
    return {};
  } catch {
    return {};
  }
}

function saveStore(store: Store): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

function pruneBag(bag: AddressBag, t = Date.now()): AddressBag {
  const spent: Record<OutpointKey, number> = {};
  for (const [k, ts] of Object.entries(bag.spent)) {
    if (t - ts < ENTRY_TTL_MS) spent[k] = ts;
  }
  const change = bag.change.filter((c) => t - c.createdAt < ENTRY_TTL_MS);
  return { spent, change };
}

function getBag(address: string): AddressBag {
  const store = loadStore();
  const bag = store[addrKey(address)];
  if (!bag) return { spent: {}, change: [] };
  return pruneBag(bag);
}

function putBag(address: string, bag: AddressBag): void {
  const store = loadStore();
  const key = addrKey(address);
  const pruned = pruneBag(bag);
  if (Object.keys(pruned.spent).length === 0 && pruned.change.length === 0) {
    delete store[key];
  } else {
    store[key] = pruned;
  }
  saveStore(store);
}

export function markOutpointsSpent(
  address: string,
  spent: Array<{ txid: string; vout: number }>,
): void {
  const bag = getBag(address);
  const t = Date.now();
  const next = { ...bag.spent };
  for (const s of spent) {
    next[outpointKey(s.txid, s.vout)] = t;
  }
  putBag(address, {
    spent: next,
    change: bag.change.filter((c) => !next[outpointKey(c.txid, c.vout)]),
  });
}

export function recordPaymentBroadcast(params: {
  address: string;
  txid: string;
  spent: Array<{ txid: string; vout: number }>;
  change: { vout: number; value: number } | null;
}): void {
  markOutpointsSpent(params.address, params.spent);
  const bag = getBag(params.address);
  let change = bag.change;
  if (params.change && params.change.value > 0) {
    const txid = params.txid.trim().toLowerCase();
    const vout = params.change.vout;
    change = change.filter((c) => outpointKey(c.txid, c.vout) !== outpointKey(txid, vout));
    change.push({
      txid,
      vout,
      value: params.change.value,
      createdAt: Date.now(),
    });
  }
  putBag(params.address, { spent: bag.spent, change });
}

/**
 * Merge indexer UTXOs with local spent/change.
 * Only reconcile spent markers against a non-empty indexer snapshot.
 */
export function mergePaymentUtxos(address: string, indexed: PaymentUtxo[]): PaymentUtxo[] {
  const bag = getBag(address);
  const indexedKeys = new Set(indexed.map((u) => outpointKey(u.txid, u.vout)));
  const canReconcile = indexed.length > 0;

  let spent = bag.spent;
  let change = bag.change;

  if (canReconcile) {
    let dirty = false;
    const nextChange = bag.change.filter((c) => {
      if (indexedKeys.has(outpointKey(c.txid, c.vout))) {
        dirty = true;
        return false;
      }
      return true;
    });
    const nextSpent: Record<OutpointKey, number> = {};
    for (const [k, ts] of Object.entries(bag.spent)) {
      if (indexedKeys.has(k)) nextSpent[k] = ts;
      else dirty = true;
    }
    if (dirty || nextChange.length !== bag.change.length) {
      putBag(address, { spent: nextSpent, change: nextChange });
    }
    spent = nextSpent;
    change = nextChange;
  }

  const fromIndex = indexed.filter((u) => !spent[outpointKey(u.txid, u.vout)]);
  const localOnly = change
    .filter(
      (c) =>
        !spent[outpointKey(c.txid, c.vout)] &&
        !indexedKeys.has(outpointKey(c.txid, c.vout)),
    )
    .sort((a, b) => b.createdAt - a.createdAt);

  const merged = [
    ...localOnly.map(({ txid, vout, value, scriptPubKey }) => ({
      txid,
      vout,
      value,
      scriptPubKey,
    })),
    ...fromIndex.sort((a, b) => b.value - a.value),
  ];

  const seen = new Set<OutpointKey>();
  const out: PaymentUtxo[] = [];
  for (const u of merged) {
    const k = outpointKey(u.txid, u.vout);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(u);
  }
  return out;
}

/** Outpoints this session still treats as spent (plus their values if still in `indexed`). */
export function getLocalHoldStats(
  address: string,
  indexed?: PaymentUtxo[],
): { heldCount: number; heldKoinu: number } {
  const bag = getBag(address);
  const spentKeys = Object.keys(bag.spent);
  if (!spentKeys.length) return { heldCount: 0, heldKoinu: 0 };
  if (!indexed?.length) {
    return { heldCount: spentKeys.length, heldKoinu: 0 };
  }
  const byKey = new Map(indexed.map((u) => [outpointKey(u.txid, u.vout), u.value] as const));
  let heldKoinu = 0;
  let heldCount = 0;
  for (const k of spentKeys) {
    const v = byKey.get(k);
    if (v == null) continue;
    heldCount += 1;
    heldKoinu += v;
  }
  return { heldCount, heldKoinu };
}

/** Drop local spent/change markers so coins can be retried after a failed / stuck broadcast. */
export function clearMempoolOverlayForAddress(address: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const store = loadStore();
    delete store[addrKey(address)];
    saveStore(store);
    for (const key of LEGACY_STORAGE_KEYS) {
      try {
        const raw = sessionStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as Store;
        if (!parsed || typeof parsed !== 'object') continue;
        delete parsed[addrKey(address)];
        sessionStorage.setItem(key, JSON.stringify(parsed));
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

export function isInputsSpentBroadcastError(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err ?? '');
  const lower = m.toLowerCase();
  return (
    lower.includes('bad-txns-inputs-spent') ||
    lower.includes('already been spent') ||
    lower.includes('already spent') ||
    lower.includes('missing inputs') ||
    lower.includes('txn-mempool-conflict') ||
    lower.includes('inputs missing')
  );
}

export function friendlyPaymentSendError(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  if (isInputsSpentBroadcastError(err)) {
    return (
      'Those coins were already spent (often from a recent casino bet or send). ' +
      'We refreshed your spendable UTXOs — try again in a moment with a smaller amount or Max.'
    );
  }
  // Prefer our detailed estimate messages as-is
  if (/not enough spendable|no spendable doge|spendable right now/i.test(m)) {
    return m;
  }
  if (/insufficient/i.test(m)) {
    return (
      'Not enough spendable DOGE for this amount plus network fee. ' +
      'Wallet total can look higher when coins are locked in Doginals/inscriptions or still settling after a bet.'
    );
  }
  if (/no spendable/i.test(m)) {
    return 'No spendable DOGE found yet. Wait for recent transactions to appear, then retry.';
  }
  if (/address/i.test(m) && /valid/i.test(m)) {
    return m;
  }
  if (/wallet.*locked|private key/i.test(m)) {
    return 'Unlock your Local Browser Wallet and try again.';
  }
  if (/all broadcast providers failed|broadcast/i.test(m)) {
    return `Broadcast failed: ${m.replace(/^Invalid transaction\.\s*/i, '').trim()}. The coins were NOT sent — try again.`;
  }
  return m.replace(/^Invalid transaction\.\s*/i, '').trim() || m;
}
