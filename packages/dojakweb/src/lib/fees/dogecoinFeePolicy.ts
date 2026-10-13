/**
 * Canonical Dogecoin fee policy for dojakweb + hosts.
 *
 * Core min relay ≈ 0.001 DOGE/kB = 100_000 koinu/kB = 100 koinu/byte.
 * Static 10× relay (1_000 koinu/byte) is only a **last-resort stale floor** —
 * it is NOT a safe broadcast rate during fee spikes.
 *
 * Every product broadcast MUST call `enforceBroadcastFeeRateKoinuPerByte` so the
 * paid rate is ≥ max(caller request, live estimatesmartfee, inclusion floor).
 * If Command.dog fee estimate is unreachable and we have no recent cache, we
 * **refuse** rather than guess low and leave txs stuck.
 *
 * Prefer Command.dog `GET /v1/chain/fee-estimate` (Core-backed, already floored).
 */

import { COMMAND_DOG_FEE_ESTIMATE_PATH, getCommandDogApiBaseUrl } from '../../utils/api';

/** Core default relay minimum ≈0.001 DOGE/kB. */
export const MIN_RELAY_KOINU_PER_KB = 100_000;
export const MIN_RELAY_KOINU_PER_BYTE = 100;

/**
 * Absolute fallback floor (10× relay) when we only have a *stale* cached estimate.
 * Never treat this alone as “will confirm” during a fee war.
 */
export const INCLUSION_FLOOR_KOINU_PER_BYTE = 1_000;
export const INCLUSION_FLOOR_KOINU_PER_KB = 1_000_000;

/** Sanity cap — high enough for fee wars; still blocks runaway fat-finger. */
export const FEE_RATE_CAP_KOINU_PER_BYTE = 500_000;
export const FEE_RATE_CAP_KOINU_PER_KB = FEE_RATE_CAP_KOINU_PER_BYTE * 1000;

/** Default target confirmation window for product txs (next few blocks). */
export const DEFAULT_PRODUCT_FEE_TARGET_BLOCKS = 2;

/** Fresh estimate cache (avoid hammering command.dog). */
const FRESH_CACHE_TTL_MS = 30_000;
/**
 * If the fee API blips, reuse the last live estimate for this long (with a bump).
 * After that we fail closed — better than broadcasting at 1000 koinu/B into a hot mempool.
 */
const STALE_CACHE_OK_MS = 15 * 60 * 1000;
/** Extra multiplier when serving a stale cached estimate. */
const STALE_CACHE_BUMP = 1.25;

export class FeeEstimateUnavailableError extends Error {
  constructor(
    message = 'Network fee estimate unavailable (command.dog). Refusing to broadcast at a guess rate that could leave your transaction stuck in the mempool. Check Core / command.dog and try again.',
  ) {
    super(message);
    this.name = 'FeeEstimateUnavailableError';
  }
}

type CachedEstimate = {
  at: number;
  blocks: number;
  koinuPerByte: number;
  live: boolean;
};

let cachedEstimate: CachedEstimate | null = null;

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
 * Throws {@link FeeEstimateUnavailableError} when unreachable with no usable cache.
 */
export async function resolveInclusionFeeRateKoinuPerKb(
  targetBlocks = DEFAULT_PRODUCT_FEE_TARGET_BLOCKS,
): Promise<number> {
  const perByte = await resolveInclusionFeeRateKoinuPerByte(targetBlocks);
  return clampKoinuPerKb(perByte * 1000);
}

export type ResolveInclusionFeeOpts = {
  /**
   * When true (default for product txs), throw if we cannot get a live or recent
   * cached estimate. Set false only for non-broadcast UI placeholders.
   */
  requireEstimate?: boolean;
};

/**
 * Live inclusion fee rate in koinu/byte from Command.dog.
 * Prefer this (or wallet preference helpers) over any static 1000 koinu/B constant.
 */
export async function resolveInclusionFeeRateKoinuPerByte(
  targetBlocks = DEFAULT_PRODUCT_FEE_TARGET_BLOCKS,
  opts: ResolveInclusionFeeOpts = {},
): Promise<number> {
  const requireEstimate = opts.requireEstimate !== false;
  const blocks = Math.max(1, Math.min(1008, Math.floor(targetBlocks)));
  const now = Date.now();
  if (
    cachedEstimate &&
    cachedEstimate.live &&
    cachedEstimate.blocks === blocks &&
    now - cachedEstimate.at < FRESH_CACHE_TTL_MS
  ) {
    return cachedEstimate.koinuPerByte;
  }

  if (typeof window === 'undefined') {
    if (requireEstimate) {
      throw new FeeEstimateUnavailableError(
        'Fee estimate requires a browser session with command.dog.',
      );
    }
    return INCLUSION_FLOOR_KOINU_PER_BYTE;
  }

  try {
    const base = getCommandDogApiBaseUrl().trim().replace(/\/$/, '');
    if (!base) {
      return useStaleOrThrow(blocks, requireEstimate, now);
    }
    const url = `${base}${COMMAND_DOG_FEE_ESTIMATE_PATH}?blocks=${encodeURIComponent(String(blocks))}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) {
      return useStaleOrThrow(blocks, requireEstimate, now);
    }
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

    if (perByte == null || perByte <= 0) {
      return useStaleOrThrow(blocks, requireEstimate, now);
    }

    // command.dog already floors + adds headroom; clamp only for sanity.
    const finalRate = clampKoinuPerByte(Math.max(perByte, INCLUSION_FLOOR_KOINU_PER_BYTE));
    cachedEstimate = { at: now, blocks, koinuPerByte: finalRate, live: true };
    return finalRate;
  } catch (e) {
    if (e instanceof FeeEstimateUnavailableError) throw e;
    return useStaleOrThrow(blocks, requireEstimate, now);
  }
}

function useStaleOrThrow(blocks: number, requireEstimate: boolean, now: number): number {
  if (
    cachedEstimate &&
    cachedEstimate.live &&
    now - cachedEstimate.at < STALE_CACHE_OK_MS
  ) {
    const bumped = clampKoinuPerByte(Math.ceil(cachedEstimate.koinuPerByte * STALE_CACHE_BUMP));
    console.warn('[dojakweb:fee] using stale fee estimate (+25% bump)', {
      ageMs: now - cachedEstimate.at,
      cached: cachedEstimate.koinuPerByte,
      bumped,
      blocks,
    });
    return bumped;
  }
  if (requireEstimate) {
    throw new FeeEstimateUnavailableError();
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
  /**
   * When false, allow static floor if estimate API is down (UI-only).
   * Product broadcast paths must leave this true (default).
   */
  requireEstimate?: boolean;
};

/**
 * **Hard rule for every product broadcast:** paid rate ≥ live network estimate.
 *
 * Static floors alone caused stuck ÐLaunch etches and inscription sends
 * (1000 koinu/B while Core wanted ~50k). Pass whatever the UI asked for; this
 * raises it when the mempool is hot. Throws if we cannot learn the network rate.
 */
export async function enforceBroadcastFeeRateKoinuPerByte(
  opts: EnforceBroadcastFeeOpts = {},
): Promise<number> {
  const network = await resolveInclusionFeeRateKoinuPerByte(
    opts.targetBlocks ?? DEFAULT_PRODUCT_FEE_TARGET_BLOCKS,
    { requireEstimate: opts.requireEstimate !== false },
  );
  const requested = opts.requestedKoinuPerByte;
  const req =
    requested != null && Number.isFinite(Number(requested)) && Number(requested) > 0
      ? clampKoinuPerByte(Number(requested))
      : 0;
  const enforced = clampKoinuPerByte(Math.max(req, network, INCLUSION_FLOOR_KOINU_PER_BYTE));
  if (typeof console !== 'undefined' && req > 0 && req < network) {
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
    requireEstimate: opts.requireEstimate,
  });
  return clampKoinuPerKb(perByte * 1000);
}

/** Clear cached estimate (tests / after fee spikes). */
export function clearFeeEstimateCache(): void {
  cachedEstimate = null;
}
