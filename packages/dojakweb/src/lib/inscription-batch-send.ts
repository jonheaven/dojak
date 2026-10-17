/**
 * One transaction, many inscriptions, one recipient.
 *
 * Bitcoin Ordinals (`ord` wallet batch send) and dogex use the same rule:
 * coins flow in input order into outputs in order. An inscription at offset
 * `o` inside an input lands on whichever output receives that koinu.
 * dogex `OutputValues::find_output` is that rule (koinu, not bitcoin sats).
 *
 * Safe shape — the one Unisat / ord use, and the one dogex will index:
 *   inputs:  each inscription coin, then plain fee coins
 *   outputs: one output per inscription coin, same value, same recipient, then change
 * Equal value keeps every koinu of that coin (whatever offset the name sits on)
 * on its own output. Stacking every name into one output would glue them onto
 * a single coin the friend would have to split before sending one name onward.
 *
 * A new inscription's `pointer` only applies when the envelope is created.
 * A transfer does not re-inscribe. Dogecoin spends the reveal's P2PKH coin;
 * it does not need a taproot script path.
 */
import { selectSmallestSufficient } from './fees/selectSmallestSufficient';

/** Plain coins at or below postage are left alone — they are often the names themselves. */
const POSTAGE_KOINU = 100_000;

/** One input per coin. Stays far under Dogecoin's standard tx size. */
export const MAX_BATCH_INSCRIPTION_COINS = 100;

export type BatchInscriptionLeg = {
  /** txid:vout */
  outpoint: string;
  value: number;
  /** Koinu offset inside the coin. Any offset in range stays put when the output value matches. */
  offset?: number;
  label?: string;
};

export type BatchInscriptionCoin = {
  outpoint: string;
  value: number;
  labels: string[];
};

export type BatchInscriptionPlan = {
  coins: BatchInscriptionCoin[];
};

export function parseOutpoint(outpoint: string): { txid: string; vout: number } {
  const [txidRaw, voutRaw] = outpoint.split(':');
  const txid = (txidRaw || '').trim().toLowerCase();
  const vout = Number(voutRaw);
  if (!/^[0-9a-f]{64}$/.test(txid) || !Number.isInteger(vout) || vout < 0) {
    throw new Error('An inscription is missing a spendable coin (txid:vout).');
  }
  return { txid, vout };
}

/**
 * Group legs that share a coin, preserve first-seen order, and prove each
 * inscription stays on the matching recipient output — not on change or fee.
 */
export function planBatchInscriptionTransfer(legs: BatchInscriptionLeg[]): BatchInscriptionPlan {
  if (legs.length === 0) throw new Error('Pick at least one inscription.');

  const coins: BatchInscriptionCoin[] = [];
  const byOut = new Map<string, BatchInscriptionCoin>();

  for (const leg of legs) {
    const { txid, vout } = parseOutpoint(leg.outpoint);
    const outpoint = `${txid}:${vout}`;
    if (!Number.isInteger(leg.value) || leg.value <= 0) {
      throw new Error('An inscription coin has no DOGE value to carry it.');
    }
    const offset = leg.offset ?? 0;
    if (!Number.isInteger(offset) || offset < 0 || offset >= leg.value) {
      throw new Error('An inscription sits outside its coin. Refusing to build a send that would drop it.');
    }
    let coin = byOut.get(outpoint);
    if (!coin) {
      coin = { outpoint, value: leg.value, labels: [] };
      byOut.set(outpoint, coin);
      coins.push(coin);
    } else if (coin.value !== leg.value) {
      throw new Error('The same coin was seen with two different values.');
    }
    const label = (leg.label || '').trim();
    if (label && !coin.labels.includes(label)) coin.labels.push(label);
  }

  if (coins.length > MAX_BATCH_INSCRIPTION_COINS) {
    throw new Error(
      `One transaction can carry ${MAX_BATCH_INSCRIPTION_COINS} inscription coins. Send the rest in a second transaction.`,
    );
  }

  // Absolute koinu ranges. Fee inputs are appended later and must start at this total,
  // so their coins only fill change — never an inscription output.
  const ranges: Array<[number, number]> = [];
  let cursor = 0;
  for (const coin of coins) {
    ranges.push([cursor, cursor + coin.value]);
    cursor += coin.value;
  }

  let base = 0;
  for (let i = 0; i < coins.length; i++) {
    const coin = coins[i]!;
    const start = ranges[i]![0];
    const end = ranges[i]![1];
    if (base !== start || end - start !== coin.value) {
      throw new Error('Inscription outputs drifted out of input order.');
    }
    // Every koinu of this input, including every inscription offset, maps here.
    if (base < start || base + coin.value > end) {
      throw new Error('This batch would slide an inscription onto another output.');
    }
    base += coin.value;
  }

  return { coins };
}

/** P2PKH size estimate plus one byte of signature slack per input. Change is the extra 34. */
export function batchTransferFeeShib(
  inscriptionCoins: number,
  feeInputs: number,
  feeRateKoinuPerByte: number,
): number {
  const vins = inscriptionCoins + feeInputs;
  const bytes = 10 + vins * 148 + inscriptionCoins * 34 + 34 + vins;
  return Math.ceil(bytes * feeRateKoinuPerByte);
}

export function selectFeeCoinsForInscriptionBatch<T extends { txid: string; vout: number; value: number }>(
  utxos: readonly T[],
  inscriptionCoins: number,
  feeRateKoinuPerByte: number,
  /** Dogecoin soft-dust: +0.01 Ð for every inscription output under 0.01 Ð. */
  extraFeeKoinu = 0,
): T[] {
  if (inscriptionCoins < 1) throw new Error('Pick at least one inscription.');
  const extra = Number.isFinite(extraFeeKoinu) && extraFeeKoinu > 0 ? Math.ceil(extraFeeKoinu) : 0;
  const candidates = utxos.filter((u) => u.value > POSTAGE_KOINU);
  if (candidates.length === 0) {
    throw new Error(
      'No plain DOGE coin is free to pay the miner. The coins that hold the names stay with the names.',
    );
  }
  const selected = selectSmallestSufficient(candidates, (n) =>
    batchTransferFeeShib(inscriptionCoins, Math.max(1, n), feeRateKoinuPerByte) + extra,
  );
  const total = selected.reduce((sum, u) => sum + u.value, 0);
  const need =
    batchTransferFeeShib(inscriptionCoins, Math.max(selected.length, 1), feeRateKoinuPerByte) + extra;
  if (selected.length > 0 && total >= need) return selected;
  const have = (total / 1e8).toFixed(4);
  const required = (need / 1e8).toFixed(4);
  throw new Error(`Not enough plain DOGE for the miner fee. Have ${have} Ð, need about ${required} Ð.`);
}
