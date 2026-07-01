/** Ping dogex `GET /api/indexer/federation` for settings health UI. */
export type DogexIndexerHealth = {
  ok: boolean;
  healthy?: boolean;
  tipHeight?: number;
  fingerprintPreview?: string;
  latencyMs?: number;
  error?: string;
};

export async function fetchDogexIndexerHealth(baseUrl: string): Promise<DogexIndexerHealth> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (!base) {
    return { ok: false, error: 'Indexer URL is empty' };
  }
  const url = `${base}/api/indexer/federation`;
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: typeof AbortSignal !== 'undefined' ? AbortSignal.timeout(10_000) : undefined,
    });
    const latencyMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
    if (!res.ok) {
      return { ok: false, latencyMs, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as {
      healthy?: boolean;
      federation?: { tip_height?: number; fingerprint?: string };
    };
    const fp = data.federation?.fingerprint;
    return {
      ok: true,
      healthy: data.healthy === true,
      tipHeight: data.federation?.tip_height,
      fingerprintPreview: typeof fp === 'string' ? fp.slice(0, 12) : undefined,
      latencyMs,
    };
  } catch (e) {
    const latencyMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
    return {
      ok: false,
      latencyMs,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
