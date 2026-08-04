/**
 * Easy Ð𝕏 inscribe — extension wallets fund a command.dog inscribe job;
 * operator backend commits/reveals the dx JSON (same family as Easy Like / Easy bet).
 */
import {
  createInscribeJob,
  getInscribeJob,
  isInscribeJobsClientConfigured,
  runInscribeJob,
  uploadInscribeJobItemContent,
  type InscribeJobResponse,
} from '../inscribeJobs/commandDogInscribeJobs';

async function sha256Hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function toBase64Utf8(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

export type EasyDxInscribeProgress = {
  job: InscribeJobResponse;
  phase: 'created' | 'awaiting_deposit' | 'running' | 'complete' | 'failed';
  message: string;
};

/**
 * Create + upload a single JSON inscription job for Ð𝕏 register/revoke.
 * Caller sends DOGE to `job.deposit_address`, then poll/run until complete.
 */
export async function createEasyDxInscribeJob(opts: {
  jsonBody: string;
  feeRate?: number;
  displayName?: string;
}): Promise<InscribeJobResponse> {
  if (!isInscribeJobsClientConfigured()) {
    throw new Error(
      'Easy Ð𝕏 inscribe needs VITE_INSCRIBE_JOBS_API_KEY + VITE_COMMAND_DOG_API_URL (same as inscribe jobs). Or unlock Local Browser Wallet to inscribe client-side.',
    );
  }
  const json = opts.jsonBody;
  const contentHash = await sha256Hex(json);
  const bytes = new TextEncoder().encode(json).length;
  const job = await createInscribeJob({
    display_name: opts.displayName ?? 'Ðoge𝕏ID register',
    fee_rate_koinu_per_kb: opts.feeRate ?? 100_000,
    marker: 'dog',
    items: [
      {
        filename: 'dx-register.json',
        content_type: 'application/json',
        content_length: bytes,
        content_sha256: contentHash,
      },
    ],
  });
  await uploadInscribeJobItemContent(job.job_id, 0, toBase64Utf8(json));
  return getInscribeJob(job.job_id, true);
}

/** Poll until complete/failed (or timeout). Triggers run when funded. */
export async function pollEasyDxInscribeJob(
  jobId: string,
  opts?: {
    maxAttempts?: number;
    intervalMs?: number;
    onUpdate?: (job: InscribeJobResponse) => void;
  },
): Promise<InscribeJobResponse> {
  const max = opts?.maxAttempts ?? 60;
  const interval = opts?.intervalMs ?? 4000;
  let last: InscribeJobResponse | null = null;
  for (let i = 0; i < max; i++) {
    last = await getInscribeJob(jobId, true);
    opts?.onUpdate?.(last);
    if (last.status === 'complete' || last.status === 'failed') {
      return last;
    }
    if (last.funding_complete) {
      try {
        await runInscribeJob(jobId);
      } catch {
        /* worker may already be running */
      }
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  if (!last) throw new Error('Easy Ð𝕏 poll failed');
  return last;
}

export { isInscribeJobsClientConfigured as isEasyDxInscribeConfigured };
