import { getIndexerApiBase } from '../../utils/api';

export type TreatsPowChallengeResponse = {
  powRequired?: boolean;
  challengeId?: string;
  preimage?: string;
  difficulty?: number;
  tick?: string;
  amt?: string;
  expiresAtUnix?: number;
  algorithm?: string;
  hashInput?: string;
  note?: string;
};

export type TreatsPowConfig = {
  enabled: boolean;
  ticks: Record<string, number>;
  challengeTtlSecs: number;
  algorithm: string;
};

export async function fetchTreatsPowConfig(baseUrl?: string): Promise<TreatsPowConfig | null> {
  const base = (baseUrl ?? getIndexerApiBase()).replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/api/treats/pow/config`);
    if (!res.ok) return null;
    return (await res.json()) as TreatsPowConfig;
  } catch {
    return null;
  }
}

export async function fetchTreatsPowChallenge(
  tick: string,
  amt: string,
  address: string,
  baseUrl?: string,
): Promise<TreatsPowChallengeResponse> {
  const base = (baseUrl ?? getIndexerApiBase()).replace(/\/+$/, '');
  const params = new URLSearchParams({
    tick: tick.trim().toLowerCase(),
    amt: amt.trim(),
    address: address.trim(),
  });
  const res = await fetch(`${base}/api/treats/pow/challenge?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof (err as { error?: string }).error === 'string'
        ? (err as { error: string }).error
        : `PoW challenge failed (${res.status})`,
    );
  }
  return (await res.json()) as TreatsPowChallengeResponse;
}

export function tickRequiresPow(
  tick: string,
  config: TreatsPowConfig | null | undefined,
): number | null {
  if (!config?.enabled) return null;
  const d = config.ticks[tick.trim().toLowerCase()];
  return typeof d === 'number' && d > 0 ? d : null;
}
