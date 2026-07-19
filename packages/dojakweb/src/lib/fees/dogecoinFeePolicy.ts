/**
 * Canonical Dogecoin fee policy for dojakweb + hosts.
 *
 * Core min relay ≈ 0.001 DOGE/kB = 100_000 koinu/kB = 100 koinu/byte.
 * Product txs MUST use ≥ 10× relay (1_000 koinu/byte / 1_000_000 koinu/kB) so
 * inscriptions confirm under load and are not dropped from the mempool.
 *
 * Prefer Command.dog `GET /v1/chain/fee-estimate` (already floors inclusion).
 */

import { COMMAND_DOG_FEE_ESTIMATE_PATH, getCommandDogApiBaseUrl } from '../../utils/api';

/** Core default relay minimum ≈0.001 DOGE/kB. */
export const MIN_RELAY_KOINU_PER_KB = 100_000;
export const MIN_RELAY_KOINU_PER_BYTE = 100;

/** Practical inclusion floor (10× relay). */
export const INCLUSION_FLOOR_KOINU_PER_BYTE = 1_000;
export const INCLUSION_FLOOR_KOINU_PER_KB = 1_000_000;

export const FEE_RATE_CAP_KOINU_PER_BYTE = 50_000;
export const FEE_RATE_CAP_KOINU_PER_KB = 50_000 * 1000;

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
 * Inclusion fee rate in koinu/kB from Command.dog (floored). Falls back to inclusion floor.
 */
export async function resolveInclusionFeeRateKoinuPerKb(targetBlocks = 6): Promise<number> {
  if (typeof window === 'undefined') return INCLUSION_FLOOR_KOINU_PER_KB;
  try {
    const base = getCommandDogApiBaseUrl().trim().replace(/\/$/, '');
    if (!base) return INCLUSION_FLOOR_KOINU_PER_KB;
    const url = `${base}${COMMAND_DOG_FEE_ESTIMATE_PATH}?blocks=${encodeURIComponent(String(targetBlocks))}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) return INCLUSION_FLOOR_KOINU_PER_KB;
    const data = (await res.json()) as { koinuPerKb?: unknown; koinuPerByte?: unknown };
    const raw = data.koinuPerKb;
    const k =
      typeof raw === 'number' && Number.isFinite(raw) && raw > 0
        ? Math.floor(raw)
        : typeof raw === 'string' && Number.isFinite(Number.parseFloat(raw)) && Number.parseFloat(raw) > 0
          ? Math.floor(Number.parseFloat(raw))
          : null;
    if (k != null) return clampKoinuPerKb(k);
    const perByte = data.koinuPerByte;
    if (typeof perByte === 'number' && Number.isFinite(perByte) && perByte > 0) {
      return clampKoinuPerKb(Math.floor(perByte) * 1000);
    }
  } catch {
    /* floor */
  }
  return INCLUSION_FLOOR_KOINU_PER_KB;
}

export async function resolveInclusionFeeRateKoinuPerByte(targetBlocks = 6): Promise<number> {
  const perKb = await resolveInclusionFeeRateKoinuPerKb(targetBlocks);
  return koinuPerKbToPerByte(perKb);
}
