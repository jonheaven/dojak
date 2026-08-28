/**
 * Canonical Dogecoin fee policy for dojakweb + hosts.
 *
 * Core min relay ≈ 0.001 DOGE/kB = 100_000 koinu/kB = 100 koinu/byte.
 * Static 10× relay (1_000 koinu/byte) is only a **fallback** when Core estimate
 * is unreachable — it is NOT a safe broadcast rate during fee spikes.
 *
 * Every product broadcast MUST call `enforceBroadcastFeeRateKoinuPerByte` so the
 * paid rate is ≥ max(caller request, live estimatesmartfee, inclusion floor).
 *
 * Prefer Command.dog `GET /v1/chain/fee-estimate` (Core-backed, already floored).
 */

import { COMMAND_DOG_FEE_ESTIMATE_PATH, getCommandDogApiBaseUrl } from '../../utils/api';

/** Core default relay minimum ≈0.001 DOGE/kB. */
export const MIN_RELAY_KOINU_PER_KB = 100_000;
export const MIN_RELAY_KOINU_PER_BYTE = 100;

/**
 * Absolute fallback floor (10× relay) when the fee API is down.
 * Never treat this alone as “will confirm” — always prefer live estimate.
 */
export const INCLUSION_FLOOR_KOINU_PER_BYTE = 1_000;
export const INCLUSION_FLOOR_KOINU_PER_KB = 1_000_000;

/** Sanity cap — high enough for fee wars; still blocks runaway fat-finger. */
export const FEE_RATE_CAP_KOINU_PER_BYTE = 500_000;
export const FEE_RATE_CAP_KOINU_PER_KB = FEE_RATE_CAP_KOINU_PER_BYTE * 1000;

/** Default target confirmation window for product txs (next few blocks). */
export const DEFAULT_PRODUCT_FEE_TARGET_BLOCKS = 2;

let cachedEstimate: { at: number; blocks: number; koinuPerByte: number } | null = null;
const CACHE_TTL_MS = 30_000;

export function clampKoinuPerKb(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return INCLUSION_FLOOR_KOINU_PER_KB;
  return Math.min(
    FEE_RATE_CAP_KOINU_PER_KB,
    Math.max(INCLUSION_FLOOR_KOINU_PER_KB, Math.floor(rate)),
  );
}

export function clampKoinuPerByte(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return INCLUSION_FLOOR_KOINU_PER_BYTE;
  return Math.min(
    FEE_RATE_CAP_KOINU_PER_BYTE,
    Math.max(INCLUSION_FLOOR_KOINU_PER_BYTE, Math.floor(rate)),
  );
}

export function koinuPerKbToPerByte(koinuPerKb: number): number {
  return clampKoinuPerByte(Math.ceil(koinuPerKb / 1000));
}

/**
 * Live inclusion fee rate in koinu/kB from Command.dog (floored).
 * Falls back to static inclusion floor only if the API is unreachable.
 */
export async function resolveInclusionFeeRateKoinuPerKb(
  targetBlocks = DEFAULT_PRODUCT_FEE_TARGET_BLOCKS,
): Promise<number> {
  const perByte = await resolveInclusionFeeRateKoinuPerByte(targetBlocks);
  return clampKoinuPerKb(perByte * 1000);
}

export async function resolveInclusionFeeRateKoinuPerByte(
  targetBlocks = DEFAULT_PRODUCT_FEE_TARGET_BLOCKS,
): Promise<number> {
  const blocks = Math.max(1, Math.min(1008, Math.floor(targetBlocks)));
  const now = Date.now();
  if (
    cachedEstimate &&
    cachedEstimate.blocks === blocks &&
    now - cachedEstimate.at < CACHE_TTL_MS
  ) {
    return cachedEstimate.koinuPerByte;
  }

  if (typeof window === 'undefined') {
    return INCLUSION_FLOOR_KOINU_PER_BYTE;
  }

  try {
    const base = getCommandDogApiBaseUrl().trim().replace(/\/$/, '');
    if (!base) return INCLUSION_FLOOR_KOINU_PER_BYTE;
    const url = `${base}${COMMAND_DOG_FEE_ESTIMATE_PATH}?blocks=${encodeURIComponent(String(blocks))}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) return INCLUSION_FLOOR_KOINU_PER_BYTE;
    const data = (await res.json()) as {
      koinuPerKb?: unknown;
      koinuPerByte?: unknown;
    };

    let perByte: number | null = null;
    const rawByte = data.koinuPerByte;
    if (typeof rawByte === 'number' && Number.isFinite(rawByte) && rawByte > 0) {
      perByte = Math.floor(rawByte);
    } else if (typeof rawByte === 'string' && Number.parseFloat(rawByte) > 0) {
      perByte = Math.floor(Number.parseFloat(rawByte));
    } else {
      const rawKb = data.koinuPerKb;
      const kb =
        typeof rawKb === 'number' && Number.isFinite(rawKb) && rawKb > 0
          ? Math.floor(rawKb)
          : typeof rawKb === 'string' && Number.parseFloat(rawKb) > 0
            ? Math.floor(Number.parseFloat(rawKb))
            : null;
      if (kb != null) perByte = Math.ceil(kb / 1000);
    }

    if (perByte == null || perByte <= 0) return INCLUSION_FLOOR_KOINU_PER_BYTE;

    // command.dog already floors + adds headroom; clamp only for sanity.
    const finalRate = clampKoinuPerByte(Math.max(perByte, INCLUSION_FLOOR_KOINU_PER_BYTE));
    cachedEstimate = { at: now, blocks, koinuPerByte: finalRate };
    return finalRate;
  } catch {
    /* floor */
  }
  return INCLUSION_FLOOR_KOINU_PER_BYTE;
}

export type EnforceBroadcastFeeOpts = {
  /** Caller-requested rate (koinu/byte). Underpays are raised; overpays kept (within cap). */
  requestedKoinuPerByte?: number | null;
  /** Confirmation target for estimatesmartfee (default: 2). */
  targetBlocks?: number;
  /** Log tag for debugging. */
  context?: string;
};

/**
 * **Hard rule for every product broadcast:** paid rate ≥ live network estimate.
 *
 * Static floors alone caused stuck ÐLaunch etches (1000 koinu/B while Core wanted ~50k).
 * Pass whatever the UI asked for; this raises it when the mempool is hot.
 */
export async function enforceBroadcastFeeRateKoinuPerByte(
  opts: EnforceBroadcastFeeOpts = {},
): Promise<number> {
  const network = await resolveInclusionFeeRateKoinuPerByte(
    opts.targetBlocks ?? DEFAULT_PRODUCT_FEE_TARGET_BLOCKS,
  );
  const requested = opts.requestedKoinuPerByte;
  const req =
    requested != null && Number.isFinite(Number(requested)) && Number(requested) > 0
      ? clampKoinuPerByte(Number(requested))
      : 0;
  const enforced = clampKoinuPerByte(Math.max(req, network, INCLUSION_FLOOR_KOINU_PER_BYTE));
  if (typeof console !== 'undefined' && (req > 0 && req < network)) {
    console.warn(
      `[dojakweb:fee] raised underpaying fee rate${opts.context ? ` (${opts.context})` : ''}`,
      { requested: req, network, enforced },
    );
  }
  return enforced;
}

export async function enforceBroadcastFeeRateKoinuPerKb(
  opts: EnforceBroadcastFeeOpts & { requestedKoinuPerKb?: number | null } = {},
): Promise<number> {
  const requestedByte =
    opts.requestedKoinuPerByte ??
    (opts.requestedKoinuPerKb != null && Number(opts.requestedKoinuPerKb) > 0
      ? Math.ceil(Number(opts.requestedKoinuPerKb) / 1000)
      : null);
  const perByte = await enforceBroadcastFeeRateKoinuPerByte({
    requestedKoinuPerByte: requestedByte,
    targetBlocks: opts.targetBlocks,
    context: opts.context,
  });
  return clampKoinuPerKb(perByte * 1000);
}

/** Clear cached estimate (tests / after fee spikes). */
export function clearFeeEstimateCache(): void {
  cachedEstimate = null;
}
