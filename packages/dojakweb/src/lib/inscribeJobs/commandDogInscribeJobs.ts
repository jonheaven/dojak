/**
 * Server-side inscribe job API (`/v1/inscribe-jobs/*`) on command.dog/api.
 *
 * - Set `VITE_COMMAND_DOG_API_URL` (same as wallet broadcast / Ð𝕏).
 * - Set `VITE_INSCRIBE_JOBS_API_KEY` to the same value as server `INSCRIBE_JOBS_API_KEY`.
 */
import { getCommandDogApiBaseUrl } from '../../utils/api';

function inscribeJobsApiKey(): string {
  const k = import.meta.env.VITE_INSCRIBE_JOBS_API_KEY?.trim();
  return k || '';
}

export function isInscribeJobsClientConfigured(): boolean {
  return inscribeJobsApiKey().length > 0;
}

export interface InscribeJobItemInput {
  filename: string;
  content_type: string;
  content_length: number;
  content_sha256: string;
}

export interface CreateInscribeJobBody {
  display_name?: string;
  fee_rate_koinu_per_kb: number;
  marker: 'ord' | 'dog';
  /** Default `p2pkh_core` — fee quote matches server Core P2PKH broadcast. */
  inscribe_mode?: 'p2pkh_core' | 'p2sh_dojakweb';
  items: InscribeJobItemInput[];
}

export interface InscribeJobItemResponse {
  filename: string;
  content_type: string;
  content_length: number;
  content_sha256: string;
  tx_stages_estimate: number;
  fee_estimate_sats: number;
  has_content?: boolean;
  item_status?: string;
  inscription_id?: string | null;
  stage_txids?: unknown;
  item_error?: string | null;
}

export interface InscribeJobResponse {
  job_id: string;
  display_name: string;
  status: string;
  marker: string;
  fee_rate_koinu_per_kb: number;
  deposit_address: string;
  deposit_label: string;
  required_sats: number;
  received_sats: number;
  pending_sats: number;
  funding_complete: boolean;
  min_confirmations: number;
  dogecoin_uri: string;
  amount_doge: string;
  items: InscribeJobItemResponse[];
  quote_summary: Record<string, unknown>;
  last_error?: string | null;
  broadcast_log?: unknown;
  inscribe_mode?: string;
  inscribe_backend?: string;
}

function authHeaders(): HeadersInit {
  const key = inscribeJobsApiKey();
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Inscribe-Jobs-Key': key,
  };
}

async function parseJsonError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    if (j && typeof j.error === 'string' && j.error.trim()) return j.error.trim();
  } catch {
    /* ignore */
  }
  return `HTTP ${res.status}`;
}

export async function createInscribeJob(body: CreateInscribeJobBody): Promise<InscribeJobResponse> {
  if (!isInscribeJobsClientConfigured()) {
    throw new Error('VITE_INSCRIBE_JOBS_API_KEY is not set');
  }
  const base = getCommandDogApiBaseUrl().replace(/\/$/, '');
  const res = await fetch(`${base}/v1/inscribe-jobs`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await parseJsonError(res));
  }
  return (await res.json()) as InscribeJobResponse;
}

export async function getInscribeJob(jobId: string, refresh: boolean): Promise<InscribeJobResponse> {
  if (!isInscribeJobsClientConfigured()) {
    throw new Error('VITE_INSCRIBE_JOBS_API_KEY is not set');
  }
  const base = getCommandDogApiBaseUrl().replace(/\/$/, '');
  const q = refresh ? '?refresh=true' : '';
  const res = await fetch(`${base}/v1/inscribe-jobs/${encodeURIComponent(jobId.trim())}${q}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(await parseJsonError(res));
  }
  return (await res.json()) as InscribeJobResponse;
}

/** Upload raw file bytes for one job line (sort_order = 0 for first file). */
export async function uploadInscribeJobItemContent(
  jobId: string,
  sortOrder: number,
  contentBase64: string,
): Promise<{ ok: boolean; bytes: number }> {
  if (!isInscribeJobsClientConfigured()) {
    throw new Error('VITE_INSCRIBE_JOBS_API_KEY is not set');
  }
  const base = getCommandDogApiBaseUrl().replace(/\/$/, '');
  const res = await fetch(
    `${base}/v1/inscribe-jobs/${encodeURIComponent(jobId.trim())}/items/${sortOrder}/content`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ content_base64: contentBase64 }),
    },
  );
  if (!res.ok) {
    throw new Error(await parseJsonError(res));
  }
  return (await res.json()) as { ok: boolean; bytes: number };
}

/** Queue background worker (returns 202). Job must be `funded` and all items must have uploaded content. */
export async function runInscribeJob(jobId: string): Promise<{ ok: boolean; queued?: boolean; note?: string }> {
  if (!isInscribeJobsClientConfigured()) {
    throw new Error('VITE_INSCRIBE_JOBS_API_KEY is not set');
  }
  const base = getCommandDogApiBaseUrl().replace(/\/$/, '');
  const res = await fetch(`${base}/v1/inscribe-jobs/${encodeURIComponent(jobId.trim())}/run`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(await parseJsonError(res));
  }
  return (await res.json()) as { ok: boolean; queued?: boolean; note?: string };
}
