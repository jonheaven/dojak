/**
 * Shared Dojakweb network-fee preference (Normal / Fast / Priority / Custom).
 *
 * Canonical unit: **koinu/byte** (same as dogecoin.games casino bets).
 * Ðune / Core-style builders that use koinu/kB should multiply by 1000.
 *
 * Preset multipliers apply on top of the **live** Command.dog fee estimate.
 * Static 1000 koinu/B is only a floor when the estimate API is down — it is
 * never treated as a safe “Normal” broadcast rate during fee spikes.
 */
import {
  FEE_RATE_CAP_KOINU_PER_BYTE,
  INCLUSION_FLOOR_KOINU_PER_BYTE,
  INCLUSION_FLOOR_KOINU_PER_KB,
  enforceBroadcastFeeRateKoinuPerByte,
  resolveInclusionFeeRateKoinuPerByte,
} from './dogecoinFeePolicy';

export type DojakwebTxFeePreset = 'normal' | 'fast' | 'priority' | 'custom';

export type DojakwebTxFeePreference = {
  preset: DojakwebTxFeePreset;
  customRateKoinuPerByte?: number;
};

export const DOJAKWEB_TX_FEE_PREF_KEY = 'dojakweb:txFeePreference:v1';
/** Legacy dogecoin.games key — migrated on first read. */
const LEGACY_GAMES_FEE_PREF_KEY = 'dogecoin-games-casino-fee-pref-v1';
export const DOJAKWEB_TX_FEE_PREF_EVENT = 'dojakweb:txFeePreference:changed';

/** Multipliers vs live inclusion estimate (blocks=2). */
export const DOJAKWEB_FEE_PRESET_MULT: Record<Exclude<DojakwebTxFeePreset, 'custom'>, number> = {
  normal: 1,
  fast: 1.5,
  priority: 2.5,
};

/** @deprecated Static labels only — use resolveDojakwebFeeRateKoinuPerByte for real rates. */
export const DOJAKWEB_FEE_PRESET_RATES: Record<Exclude<DojakwebTxFeePreset, 'custom'>, number> = {
  normal: INCLUSION_FLOOR_KOINU_PER_BYTE,
  fast: 2_000,
  priority: 5_000,
};

export const DOJAKWEB_FEE_MIN_KOINU_PER_BYTE = INCLUSION_FLOOR_KOINU_PER_BYTE;
export const DOJAKWEB_FEE_MAX_KOINU_PER_BYTE = FEE_RATE_CAP_KOINU_PER_BYTE;

export function clampDojakwebFeeRateKoinuPerByte(rate: number): number {
  if (!Number.isFinite(rate)) return DOJAKWEB_FEE_MIN_KOINU_PER_BYTE;
  return Math.round(
    Math.min(DOJAKWEB_FEE_MAX_KOINU_PER_BYTE, Math.max(DOJAKWEB_FEE_MIN_KOINU_PER_BYTE, rate)),
  );
}

export function koinuPerByteToKoinuPerKb(rateKoinuPerByte: number): number {
  return clampDojakwebFeeRateKoinuPerByte(rateKoinuPerByte) * 1000;
}

function normalizePref(raw: Partial<DojakwebTxFeePreference> | null | undefined): DojakwebTxFeePreference {
  const preset: DojakwebTxFeePreset =
    raw?.preset === 'fast' ||
    raw?.preset === 'priority' ||
    raw?.preset === 'custom' ||
    raw?.preset === 'normal'
      ? raw.preset
      : 'normal';
  return {
    preset,
    customRateKoinuPerByte:
      raw?.customRateKoinuPerByte != null
        ? clampDojakwebFeeRateKoinuPerByte(Number(raw.customRateKoinuPerByte))
        : undefined,
  };
}

export function readDojakwebTxFeePreference(): DojakwebTxFeePreference {
  if (typeof window === 'undefined') return { preset: 'normal' };
  try {
    const raw = window.localStorage.getItem(DOJAKWEB_TX_FEE_PREF_KEY);
    if (raw) return normalizePref(JSON.parse(raw) as Partial<DojakwebTxFeePreference>);

    const legacy = window.localStorage.getItem(LEGACY_GAMES_FEE_PREF_KEY);
    if (legacy) {
      const migrated = normalizePref(JSON.parse(legacy) as Partial<DojakwebTxFeePreference>);
      writeDojakwebTxFeePreference(migrated);
      return migrated;
    }
  } catch {
    /* ignore */
  }
  return { preset: 'normal' };
}

export function writeDojakwebTxFeePreference(pref: DojakwebTxFeePreference): void {
  if (typeof window === 'undefined') return;
  const next: DojakwebTxFeePreference = {
    preset: pref.preset,
    customRateKoinuPerByte:
      pref.preset === 'custom'
        ? clampDojakwebFeeRateKoinuPerByte(
            pref.customRateKoinuPerByte ?? DOJAKWEB_FEE_PRESET_RATES.fast,
          )
        : undefined,
  };
  window.localStorage.setItem(DOJAKWEB_TX_FEE_PREF_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(DOJAKWEB_TX_FEE_PREF_EVENT, { detail: next }));
}

/**
 * Sync snapshot for UI before the live estimate returns.
 * Prefer `resolveDojakwebFeeRateKoinuPerByte` before signing/broadcasting.
 */
export function dojakwebFeeRateKoinuPerByteFromPreference(
  pref = readDojakwebTxFeePreference(),
): number {
  if (pref.preset === 'custom') {
    return clampDojakwebFeeRateKoinuPerByte(
      pref.customRateKoinuPerByte ?? DOJAKWEB_FEE_PRESET_RATES.fast,
    );
  }
  return DOJAKWEB_FEE_PRESET_RATES[pref.preset];
}

/** Live rate: max(preference, network estimate). Always call before broadcast. */
export async function resolveDojakwebFeeRateKoinuPerByte(
  pref = readDojakwebTxFeePreference(),
): Promise<number> {
  if (pref.preset === 'custom') {
    return enforceBroadcastFeeRateKoinuPerByte({
      requestedKoinuPerByte: pref.customRateKoinuPerByte,
      context: 'txFeePreference.custom',
    });
  }
  const network = await resolveInclusionFeeRateKoinuPerByte(2);
  const mult = DOJAKWEB_FEE_PRESET_MULT[pref.preset];
  return clampDojakwebFeeRateKoinuPerByte(Math.ceil(network * mult));
}

export function dojakwebFeeRateKoinuPerKbFromPreference(
  pref = readDojakwebTxFeePreference(),
): number {
  return koinuPerByteToKoinuPerKb(dojakwebFeeRateKoinuPerByteFromPreference(pref));
}

export async function resolveDojakwebFeeRateKoinuPerKb(
  pref = readDojakwebTxFeePreference(),
): Promise<number> {
  return koinuPerByteToKoinuPerKb(await resolveDojakwebFeeRateKoinuPerByte(pref));
}

export function formatDojakwebFeeRate(rateKoinuPerByte: number): string {
  const dogePerKb = (clampDojakwebFeeRateKoinuPerByte(rateKoinuPerByte) * 1000) / 100_000_000;
  return `${dogePerKb.toFixed(dogePerKb >= 0.1 ? 2 : 3)} Ð/kB`;
}

export function estimateP2pkhFeeDoge(params: {
  inputs?: number;
  outputs?: number;
  opReturnScriptLen?: number;
  rateKoinuPerByte: number;
}): number {
  const inputs = Math.max(1, Math.round(params.inputs ?? 1));
  const outputs = Math.max(1, Math.round(params.outputs ?? 2));
  const opReturnScriptLen = Math.max(0, Math.round(params.opReturnScriptLen ?? 0));
  const opReturnVbytes =
    opReturnScriptLen > 0 ? 8 + (opReturnScriptLen < 0xfd ? 1 : 3) + opReturnScriptLen : 0;
  const vbytes = 10 + inputs * 148 + outputs * 34 + opReturnVbytes;
  const feeKoinu = Math.max(
    100_000,
    Math.ceil(vbytes * clampDojakwebFeeRateKoinuPerByte(params.rateKoinuPerByte)),
  );
  return Math.round((feeKoinu / 100_000_000) * 1e8) / 1e8;
}

export { INCLUSION_FLOOR_KOINU_PER_KB, INCLUSION_FLOOR_KOINU_PER_BYTE };
