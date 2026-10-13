/**
 * Coin selection for wallet spends.
 *
 * Prefer the smallest single UTXO that covers `need(inputCount)`.
 * Combine smallest-first only when no one coin is enough.
 * Never sort largest-first: that locks a 50 DOGE coin on a fee a 1 DOGE coin can pay.
 *
 * `need(n)` is the koinu the selection must sum to after `n` inputs (reserved + added),
 * including outputs and the fee at that input count. It may grow as `n` grows.
 */

export type CoinValue = { value: number };

export type SelectSmallestSufficientOptions<T> = {
  /** Always spent. Counted in the sum and in `need`'s input count. */
  reserved?: readonly T[];
  /** Skip candidates at or below this value. Reserved coins are kept. Default 0. */
  minValue?: number;
};

function outpointKey(u: object): string | null {
  const rec = u as { txid?: unknown; tx_hash?: unknown; vout?: unknown; tx_output_n?: unknown };
  const tx = rec.txid ?? rec.tx_hash;
  const vout = rec.vout ?? rec.tx_output_n;
  if (typeof tx !== 'string' || !tx) return null;
  const n = typeof vout === 'number' ? vout : Number(vout);
  if (!Number.isFinite(n)) return null;
  return `${tx.toLowerCase()}:${n}`;
}

function sameCoin<T>(a: T, b: T): boolean {
  const ka = outpointKey(a as object);
  const kb = outpointKey(b as object);
  if (ka && kb) return ka === kb;
  return Object.is(a, b);
}

function sumValue<T extends CoinValue>(coins: readonly T[]): number {
  let total = 0;
  for (const coin of coins) {
    if (Number.isFinite(coin.value)) total += coin.value;
  }
  return total;
}

/**
 * @returns reserved coins followed by the coins added to cover `need`.
 *         May be short of `need` when the wallet cannot cover it — callers check the sum.
 */
export function selectSmallestSufficient<T extends CoinValue>(
  utxos: readonly T[],
  need: (inputCount: number) => number,
  options?: SelectSmallestSufficientOptions<T>,
): T[] {
  const minValue = options?.minValue ?? 0;
  const reserved = [...(options?.reserved ?? [])];
  const reservedSum = sumValue(reserved);

  if (reservedSum >= need(reserved.length)) return reserved;

  const candidates = utxos
    .filter((u) => Number.isFinite(u.value) && u.value > minValue && !reserved.some((r) => sameCoin(r, u)))
    .sort((a, b) => a.value - b.value);

  const one = reserved.length + 1;
  const single = candidates.find((u) => reservedSum + u.value >= need(one));
  if (single) return [...reserved, single];

  const selected = [...reserved];
  let total = reservedSum;
  for (const coin of candidates) {
    selected.push(coin);
    total += coin.value;
    if (total >= need(selected.length)) return selected;
  }
  return selected;
}
