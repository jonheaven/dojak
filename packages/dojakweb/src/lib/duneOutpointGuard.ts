/**
 * Guard plain DOGE / fee coin-select against spending Ðune-bearing outpoints.
 *
 * MyDoge does not index our v2 Ðune magic. dogex `/api/dunes/outpoint/:txid/:vout`
 * is protocol truth. New sends park Ðunes on 0.001 Ð carriers (inscription
 * sentinel). Older bags still sit on 0.01 postage / large DOGE change — the
 * 0.001 skip alone is not enough for those.
 */
import { getIndexerFetchBases } from '../utils/api';

export type DuneGuardUtxo = {
  tx_hash: string;
  tx_output_n: number;
  value: number;
};

/** Protocol balance on one outpoint (dogex truth). */
export type DogexOutpointDune = {
  duneId: string;
  amount: string;
  name?: string;
  spacedName?: string;
  symbol?: string;
  divisibility?: number;
};

const OUTPOINT_TIMEOUT_MS = 2_500;
const CIRCUIT_OPEN_MS = 2 * 60_000;
const FAIL_OPEN_AFTER = 2;
let failStreak = 0;
let circuitOpenUntil = 0;

function dogexPaused(): boolean {
  return Date.now() < circuitOpenUntil;
}

function recordOk(): void {
  failStreak = 0;
  circuitOpenUntil = 0;
}

function recordFail(): void {
  failStreak += 1;
  if (failStreak >= FAIL_OPEN_AFTER) {
    circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
    failStreak = 0;
    console.warn(
      '[dojakweb:dunes] outpoint probes paused ~2m — dogex unreachable (spendable fails open)',
    );
  }
}

function outpointKey(u: { tx_hash: string; tx_output_n: number }): string {
  return `${String(u.tx_hash).trim().toLowerCase()}:${u.tx_output_n}`;
}

function dogexBases(): string[] {
  return getIndexerFetchBases();
}

/**
 * Fetch Ðune balances for one outpoint. `null` = indexer unreachable;
 * empty array = no Ðunes (or 404).
 */
export async function fetchDogexDuneBalancesForOutpoint(
  txid: string,
  vout: number,
): Promise<DogexOutpointDune[] | null> {
  if (dogexPaused()) return null;
  const tid = String(txid).trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(tid) || !Number.isFinite(vout) || vout < 0) return null;

  let sawFail = false;
  for (const base of dogexBases()) {
    const url = `${base}/api/dunes/outpoint/${encodeURIComponent(tid)}/${vout}`;
    try {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer =
        ctrl && typeof window !== 'undefined'
          ? window.setTimeout(() => ctrl.abort(), OUTPOINT_TIMEOUT_MS)
          : null;
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: ctrl?.signal,
      });
      if (timer != null) window.clearTimeout(timer);
      if (res.status === 404) {
        recordOk();
        return [];
      }
      if (!res.ok) {
        sawFail = true;
        continue;
      }
      const data = (await res.json()) as {
        dunes?: Array<{
          dune_id?: string;
          id?: string;
          amount?: string;
          name?: string | null;
          spaced_name?: string | null;
          symbol?: string | null;
          divisibility?: number | null;
        }>;
      };
      const rows = Array.isArray(data?.dunes) ? data.dunes : [];
      const out: DogexOutpointDune[] = [];
      for (const row of rows) {
        const duneId = String(row?.dune_id ?? row?.id ?? '').trim();
        const amount = String(row?.amount ?? '0');
        try {
          if (!duneId || BigInt(amount) <= 0n) continue;
        } catch {
          continue;
        }
        const name = row?.name != null ? String(row.name) : undefined;
        const spacedName = row?.spaced_name != null ? String(row.spaced_name) : undefined;
        const symbol = row?.symbol != null ? String(row.symbol) : undefined;
        const div =
          typeof row?.divisibility === 'number' && Number.isFinite(row.divisibility)
            ? row.divisibility
            : undefined;
        out.push({
          duneId,
          amount,
          name,
          spacedName,
          symbol,
          divisibility: div,
        });
      }
      recordOk();
      return out;
    } catch {
      sawFail = true;
    }
  }
  if (sawFail) recordFail();
  return null;
}

/** true = has Ðunes, false = none, null = indexer unreachable / unknown */
export async function outpointHasDogexDunes(
  txid: string,
  vout: number,
): Promise<boolean | null> {
  const rows = await fetchDogexDuneBalancesForOutpoint(txid, vout);
  if (rows === null) return null;
  return rows.length > 0;
}

/**
 * Attach dogex Ðune tags onto UTXOs (Coins & UTXOs manager).
 * On indexer failure for a row, leaves `dunes` undefined (unknown).
 */
export async function enrichUtxosWithDogexDunes<
  T extends { txid: string; vout: number; dunes?: DogexOutpointDune[] },
>(utxos: T[], opts?: { concurrency?: number }): Promise<T[]> {
  if (!utxos.length) return utxos;
  if (dogexPaused()) return utxos;
  const concurrency = Math.max(1, Math.min(opts?.concurrency ?? 6, 12));
  const out = utxos.slice();
  for (let i = 0; i < out.length; i += concurrency) {
    if (dogexPaused()) break;
    const batch = out.slice(i, i + concurrency);
    const tags = await Promise.all(
      batch.map((u) => fetchDogexDuneBalancesForOutpoint(u.txid, u.vout)),
    );
    for (let j = 0; j < batch.length; j++) {
      const rows = tags[j];
      if (rows === null) continue;
      out[i + j] = { ...out[i + j], dunes: rows };
    }
  }
  return out;
}

/**
 * Drop UTXOs dogex reports as Ðune-bearing.
 * Keys in `keepKeys` are always retained (Ðune-send mustInclude carriers).
 * On indexer failure for a row, keep it (fail-open) so the wallet still works offline.
 */
export async function excludeDogexDuneBearingUtxos<T extends DuneGuardUtxo>(
  utxos: T[],
  opts?: {
    keepKeys?: Set<string>;
    concurrency?: number;
    maxProbe?: number;
    /** Casino / house: drop unknown outpoints instead of spending them as plain DOGE. */
    failClosed?: boolean;
  },
): Promise<{
  safe: T[];
  skippedDuneCount: number;
  skippedDuneKoinu: number;
  unknownCount: number;
}> {
  if (!utxos.length) {
    return { safe: [], skippedDuneCount: 0, skippedDuneKoinu: 0, unknownCount: 0 };
  }

  const keep = opts?.keepKeys ?? new Set<string>();
  const failClosed = Boolean(opts?.failClosed);
  const keepOnly = (): T[] => utxos.filter((u) => keep.has(outpointKey(u)));

  // Tunnel down → don't N×probe. Wallet payments fail-open; bets/payouts must not.
  if (dogexPaused()) {
    if (failClosed) {
      return {
        safe: keepOnly(),
        skippedDuneCount: 0,
        skippedDuneKoinu: 0,
        unknownCount: utxos.length - keepOnly().length,
      };
    }
    return {
      safe: utxos.slice(),
      skippedDuneCount: 0,
      skippedDuneKoinu: 0,
      unknownCount: utxos.length,
    };
  }

  const concurrency = Math.max(1, Math.min(opts?.concurrency ?? 6, 12));
  const maxProbe = Math.max(1, opts?.maxProbe ?? 40);
  const safe: T[] = [];
  let skippedDuneCount = 0;
  let skippedDuneKoinu = 0;
  let unknownCount = 0;
  let probed = 0;

  for (let i = 0; i < utxos.length; i += concurrency) {
    if (dogexPaused() || probed >= maxProbe) {
      for (let k = i; k < utxos.length; k++) {
        const u = utxos[k];
        if (keep.has(outpointKey(u))) {
          safe.push(u);
          continue;
        }
        unknownCount++;
        if (!failClosed) safe.push(u);
      }
      break;
    }
    const batch = utxos.slice(i, i + concurrency);
    const flags = await Promise.all(
      batch.map(async (u) => {
        const k = outpointKey(u);
        if (keep.has(k)) return 'keep' as const;
        probed += 1;
        const has = await outpointHasDogexDunes(u.tx_hash, u.tx_output_n);
        if (has === true) return 'dune' as const;
        if (has === null) return 'unknown' as const;
        return 'ok' as const;
      }),
    );
    for (let j = 0; j < batch.length; j++) {
      const flag = flags[j];
      if (flag === 'dune') {
        skippedDuneCount++;
        skippedDuneKoinu += Number(batch[j].value) || 0;
        continue;
      }
      if (flag === 'unknown') {
        unknownCount++;
        if (failClosed) continue;
      }
      safe.push(batch[j]);
    }
  }

  if (skippedDuneCount > 0 || unknownCount > 0) {
    console.info('[dojakweb:dunes] excludeDogexDuneBearingUtxos', {
      kept: safe.length,
      skippedDuneCount,
      skippedDuneKoinu,
      unknownCount,
    });
  }

  return { safe, skippedDuneCount, skippedDuneKoinu, unknownCount };
}
