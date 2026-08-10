/**
 * Guard plain DOGE / fee coin-select against spending Ðune-bearing outpoints.
 *
 * MyDoge does not index our v2 Ðune magic. dogex `/api/dunes/outpoint/:txid/:vout`
 * is protocol truth. Ðunes park on 0.01 Ð postage and on change (pointer) — not
 * only on 0.001 Ð inscription dust — so the 0.001 sentinel alone is not enough.
 */
import { DOGEX_PUBLIC_INDEXER_URL, getIndexerApiBase } from '../utils/api';

export type DuneGuardUtxo = {
  tx_hash: string;
  tx_output_n: number;
  value: number;
};

function outpointKey(u: { tx_hash: string; tx_output_n: number }): string {
  return `${String(u.tx_hash).trim().toLowerCase()}:${u.tx_output_n}`;
}

/** true = has Ðunes, false = none, null = indexer unreachable / unknown */
export async function outpointHasDogexDunes(
  txid: string,
  vout: number,
): Promise<boolean | null> {
  const tid = String(txid).trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(tid) || !Number.isFinite(vout) || vout < 0) return null;

  const bases = [
    getIndexerApiBase().replace(/\/+$/, ''),
    DOGEX_PUBLIC_INDEXER_URL,
  ].filter((b, i, arr) => b && arr.indexOf(b) === i);

  for (const base of bases) {
    const url = `${base}/api/dunes/outpoint/${encodeURIComponent(tid)}/${vout}`;
    try {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer =
        ctrl && typeof window !== 'undefined'
          ? window.setTimeout(() => ctrl.abort(), 8_000)
          : null;
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: ctrl?.signal,
      });
      if (timer != null) window.clearTimeout(timer);
      if (res.status === 404) return false;
      if (!res.ok) continue;
      const data = (await res.json()) as { dunes?: Array<{ amount?: string }> };
      const rows = Array.isArray(data?.dunes) ? data.dunes : [];
      for (const row of rows) {
        try {
          if (BigInt(String(row?.amount ?? '0')) > 0n) return true;
        } catch {
          /* ignore bad amount */
        }
      }
      return false;
    } catch {
      /* try next base */
    }
  }
  return null;
}

/**
 * Drop UTXOs dogex reports as Ðune-bearing.
 * Keys in `keepKeys` are always retained (Ðune-send mustInclude carriers).
 * On indexer failure for a row, keep it (fail-open) so the wallet still works offline.
 */
export async function excludeDogexDuneBearingUtxos<T extends DuneGuardUtxo>(
  utxos: T[],
  opts?: { keepKeys?: Set<string>; concurrency?: number },
): Promise<{ safe: T[]; skippedDuneCount: number; unknownCount: number }> {
  if (!utxos.length) return { safe: [], skippedDuneCount: 0, unknownCount: 0 };

  const keep = opts?.keepKeys ?? new Set<string>();
  const concurrency = Math.max(1, Math.min(opts?.concurrency ?? 6, 12));
  const safe: T[] = [];
  let skippedDuneCount = 0;
  let unknownCount = 0;

  for (let i = 0; i < utxos.length; i += concurrency) {
    const batch = utxos.slice(i, i + concurrency);
    const flags = await Promise.all(
      batch.map(async (u) => {
        const k = outpointKey(u);
        if (keep.has(k)) return 'keep' as const;
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
        continue;
      }
      if (flag === 'unknown') unknownCount++;
      safe.push(batch[j]);
    }
  }

  if (skippedDuneCount > 0 || unknownCount > 0) {
    console.info('[dojakweb:dunes] excludeDogexDuneBearingUtxos', {
      kept: safe.length,
      skippedDuneCount,
      unknownCount,
    });
  }

  return { safe, skippedDuneCount, unknownCount };
}
