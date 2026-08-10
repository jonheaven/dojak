/**
 * Dogecoin Core dust + fee policy (mainnet defaults, 1.14.x).
 *
 * @see https://github.com/dogecoin/dogecoin/blob/master/doc/fee-recommendation.md
 *
 * - Hard dust: outputs < 0.001 Ð are non-standard (rejected).
 * - Soft dust: outputs < 0.01 Ð require +0.01 Ð added to the tx fee each,
 *   or peers/miners treat the tx as underpaid (stuck unconfirmed forever).
 *
 * Inscription carriers intentionally use hard-dust (0.001 Ð). Those txs MUST
 * pay the soft-dust fee add-on. Plain payments (tips, Ðune postage, social likes)
 * should use ≥ soft dust so the add-on is unnecessary.
 */

/** 0.001 DOGE — hard dust / Doginals carrier sentinel. */
export const HARD_DUST_KOINU = 100_000;

/** 0.01 DOGE — soft dust / recommended discard threshold. */
export const SOFT_DUST_KOINU = 1_000_000;

/** Alias: canonical Doginals inscription output value. */
export const INSCRIPTION_CARRIER_KOINU = HARD_DUST_KOINU;

/**
 * Minimum for plain payment outputs (tips, Ðune postage, social tips, vault dust).
 * Prefer this over HARD_DUST so txs relay and mine without soft-dust fee gymnastics.
 */
export const MIN_PLAIN_PAYMENT_KOINU = SOFT_DUST_KOINU;

/** Recommended inclusion fee rate (koinu / kB) — matches miner defaults. */
export const INCLUSION_FEE_KOINU_PER_KB = 1_000_000;

/** Core default min relay (koinu / kB). */
export const MIN_RELAY_KOINU_PER_KB = 100_000;

/**
 * Extra fee (koinu) required for soft-dust outputs.
 * OP_RETURN (value 0) and outputs ≥ soft dust do not add a penalty.
 */
export function softDustFeePenaltyKoinu(outputValuesKoinu: Iterable<number>): number {
  let extra = 0;
  for (const v of outputValuesKoinu) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (n < SOFT_DUST_KOINU) extra += SOFT_DUST_KOINU;
  }
  return extra;
}

/** True when a positive output is soft-dust (needs fee penalty or bump). */
export function isSoftDustOutputKoinu(valueKoinu: number): boolean {
  return Number.isFinite(valueKoinu) && valueKoinu > 0 && valueKoinu < SOFT_DUST_KOINU;
}

/**
 * Size-based fee + soft-dust penalties.
 * `feeRateKoinuPerKb` is DOGE Core style (koinu per 1000 vB).
 */
export function mineableFeeKoinu(params: {
  vsize: number;
  feeRateKoinuPerKb?: number;
  outputValuesKoinu: Iterable<number>;
  minFeeFloorKoinu?: number;
}): number {
  const rate = params.feeRateKoinuPerKb ?? INCLUSION_FEE_KOINU_PER_KB;
  const floor = params.minFeeFloorKoinu ?? HARD_DUST_KOINU;
  const vsize = Math.max(0, Math.floor(params.vsize));
  const base = Math.max(floor, Math.ceil((vsize * rate) / 1000));
  return base + softDustFeePenaltyKoinu(params.outputValuesKoinu);
}

/**
 * Change under soft dust is uneconomic — absorb into fee (wallet discard threshold).
 * Returns 0 when change should be omitted.
 */
export function discardSoftDustChangeKoinu(changeKoinu: number): number {
  if (!Number.isFinite(changeKoinu) || changeKoinu <= 0) return 0;
  if (changeKoinu < SOFT_DUST_KOINU) return 0;
  return Math.floor(changeKoinu);
}

/** Reject plain payments that would create soft-dust outs (prefer bumping amount). */
export function assertPlainPaymentKoinu(label: string, valueKoinu: number): void {
  if (!Number.isFinite(valueKoinu) || valueKoinu < MIN_PLAIN_PAYMENT_KOINU) {
    throw new Error(
      `${label} must be at least ${MIN_PLAIN_PAYMENT_KOINU} koinu (0.01 DOGE). ` +
        `Smaller outputs are Dogecoin soft-dust and will not relay/mine unless the fee ` +
        `also includes +0.01 Ð per such output.`,
    );
  }
}

/** Reject outputs below hard dust (invalid / non-standard). */
export function assertHardDustKoinu(label: string, valueKoinu: number): void {
  if (!Number.isFinite(valueKoinu) || (valueKoinu > 0 && valueKoinu < HARD_DUST_KOINU)) {
    throw new Error(
      `${label} below hard dust (${HARD_DUST_KOINU} koinu / 0.001 DOGE) — output would be non-standard.`,
    );
  }
}

/**
 * Human-readable reason a fee is insufficient for the given outs.
 * Returns null when OK.
 */
export function explainUnderpaidSoftDust(params: {
  paidFeeKoinu: number;
  vsize: number;
  feeRateKoinuPerKb?: number;
  outputValuesKoinu: Iterable<number>;
}): string | null {
  const need = mineableFeeKoinu({
    vsize: params.vsize,
    feeRateKoinuPerKb: params.feeRateKoinuPerKb,
    outputValuesKoinu: params.outputValuesKoinu,
  });
  if (params.paidFeeKoinu >= need) return null;
  const soft = softDustFeePenaltyKoinu(params.outputValuesKoinu);
  return (
    `Fee ${params.paidFeeKoinu} koinu < required ${need} koinu ` +
    `(size + soft-dust penalty ${soft} koinu). ` +
    `Dogecoin soft dust is 0.01 Ð — underpaying leaves the tx stuck unconfirmed.`
  );
}
