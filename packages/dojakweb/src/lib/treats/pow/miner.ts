export type MineProgress = {
  attempts: number;
  elapsedMs: number;
  hashesPerSec: number;
};

export type MineOptions = {
  preimage: string;
  difficulty: number;
  signal?: AbortSignal;
  onProgress?: (p: MineProgress) => void;
  yieldEvery?: number;
};

function hexPrefix(difficulty: number): string {
  return '0'.repeat(Math.max(1, Math.min(7, difficulty)));
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hashcash-style: SHA-256(preimage + ':' + nonce) hex must start with `difficulty` zero chars.
 */
export async function mineTreatsPow(options: MineOptions): Promise<string> {
  const { preimage, difficulty, signal, onProgress } = options;
  const yieldEvery = options.yieldEvery ?? 4000;
  const prefix = hexPrefix(difficulty);
  const started = performance.now();
  let attempts = 0;

  for (let nonce = 0; nonce < Number.MAX_SAFE_INTEGER; nonce += 1) {
    if (signal?.aborted) {
      throw new Error('Mining cancelled');
    }
    const hex = await sha256Hex(`${preimage}:${nonce}`);
    attempts += 1;
    if (hex.startsWith(prefix)) {
      return String(nonce);
    }
    if (attempts % yieldEvery === 0) {
      const elapsedMs = performance.now() - started;
      onProgress?.({
        attempts,
        elapsedMs,
        hashesPerSec: elapsedMs > 0 ? Math.round((attempts / elapsedMs) * 1000) : 0,
      });
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  throw new Error('Mining exhausted safe nonce range');
}

export function estimatePowSeconds(difficulty: number, hashesPerSec = 120_000): number {
  const expectedHashes = Math.pow(16, difficulty);
  return Math.max(5, Math.round(expectedHashes / Math.max(1000, hashesPerSec)));
}
