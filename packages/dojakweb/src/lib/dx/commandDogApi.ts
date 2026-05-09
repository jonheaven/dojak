/**
 * Ðoge𝕏ID orchestration against command.dog/api (`/v1/dx/*`).
 * Set `VITE_COMMAND_DOG_API_URL` (e.g. https://api.command.dog or http://127.0.0.1:3000).
 */

import {
  defaultDxContentApiBase,
  dxBadgeInscriptionIdFromEnv,
  normalizeDxInscriptionIdForUrl,
} from './displayHtml';

function apiRoot(): string {
  const raw = import.meta.env.VITE_COMMAND_DOG_API_URL?.trim();
  if (!raw) {
    throw new Error('VITE_COMMAND_DOG_API_URL is not set');
  }
  return raw.replace(/\/+$/, '');
}

async function parseJsonOrThrow(res: Response): Promise<unknown> {
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep text */
  }
  if (!res.ok) {
    const msg =
      typeof body === 'object' && body !== null && 'error' in body
        ? String((body as { error: unknown }).error)
        : text || res.statusText;
    throw new Error(msg);
  }
  return body;
}

export type DxInitiateRequest = {
  user_address: string;
  x_handle: string;
  choice?: 'grok' | 'existing';
  style_pack?: string;
  existing_inscription_id?: string;
};

export type DxInitiateResponse = {
  ok: boolean;
  session_id: string;
  x_handle: string;
  choice: string;
  /** Server-enforced window for `dx_confirm` when using `session_id` (seconds, clamped). */
  session_ttl_secs?: number;
  /** Unix timestamp (seconds) after which `session_id` is rejected with HTTP 410. */
  expires_at_unix?: number;
  next_steps?: string[];
  note?: string;
};

export async function dxInitiate(payload: DxInitiateRequest): Promise<DxInitiateResponse> {
  const root = apiRoot();
  const res = await fetch(`${root}/v1/dx/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_address: payload.user_address,
      x_handle: payload.x_handle,
      choice: payload.choice ?? 'grok',
      style_pack: payload.style_pack,
      existing_inscription_id: payload.existing_inscription_id,
    }),
  });
  return parseJsonOrThrow(res) as Promise<DxInitiateResponse>;
}

export type DxTweetProof = {
  tweet_id: string;
  signature: string;
  nonce: string;
};

export type DxConfirmRequest = {
  session_id?: string;
  user_address: string;
  x_handle: string;
  choice: string;
  /** Must match session / prompt style (e.g. `trading_card`, `cyber`). */
  style_pack?: string;
  /**
   * When `choice` is `grok`: `true` runs Grok Imagine (+ optional X vibe). `false` uses the canonical master badge (env / server id).
   * Omit for legacy clients (server defaults to `true`).
   */
  generate_imagine_badge?: boolean;
  payment_tx: Record<string, unknown>;
  tweet_proof: DxTweetProof;
  visual_data: Record<string, unknown>;
};

/** URL or data URL from `attestation.visual_data` after a successful Grok Imagine run. */
export function dxBadgeImageUrlFromVisual(visual: unknown): string | null {
  if (!visual || typeof visual !== 'object') return null;
  const v = visual as Record<string, unknown>;
  const u = v.badge_image_url;
  if (typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:image'))) {
    return u;
  }
  return null;
}

/**
 * Image for pack / card UI: Grok URL if present, else `/content/{id}` for server `master_badge_inscription_id` or `VITE_DX_BADGE_INSCRIPTION_ID`.
 */
export function dxResolvedBadgeImageUrl(visual: unknown | null | undefined): string | null {
  if (visual) {
    const grok = dxBadgeImageUrlFromVisual(visual);
    if (grok) return grok;
  }
  let serverId: string | null = null;
  if (visual && typeof visual === 'object' && !Array.isArray(visual)) {
    const raw = (visual as Record<string, unknown>).master_badge_inscription_id;
    if (typeof raw === 'string' && raw.trim().length > 0) {
      serverId = normalizeDxInscriptionIdForUrl(raw);
    }
  }
  const id = serverId ?? dxBadgeInscriptionIdFromEnv();
  if (!id) return null;
  const base = defaultDxContentApiBase();
  return `${base}/content/${encodeURIComponent(id)}`;
}

export function dxVisualStatusMessage(visual: unknown): string | null {
  if (!visual || typeof visual !== 'object') return null;
  const v = visual as Record<string, unknown>;
  if (v.badge_art_source === 'master_default') {
    return typeof v.image_generation_error === 'string' ? v.image_generation_error : null;
  }
  if (typeof v.image_generation_error === 'string') return v.image_generation_error;
  if (typeof v.image_generation_skipped === 'string') return v.image_generation_skipped;
  return null;
}

export type DxConfirmResponse = {
  ok: boolean;
  attestation: {
    session_id?: string;
    register: Record<string, unknown>;
    attestation_hash: string;
    payment_tx: unknown;
    visual_data: unknown;
    choice: string;
    note?: string;
  };
};

export async function dxConfirm(payload: DxConfirmRequest): Promise<DxConfirmResponse> {
  const root = apiRoot();
  const res = await fetch(`${root}/v1/dx/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res) as Promise<DxConfirmResponse>;
}

export type DxPromptPreviewResponse = {
  prompt: string;
  style: string;
  x_handle: string;
};

/** Safe to call only when `VITE_COMMAND_DOG_API_URL` is configured. */
export function isCommandDogDxConfigured(): boolean {
  return Boolean(import.meta.env.VITE_COMMAND_DOG_API_URL?.trim());
}

export async function dxPromptPreview(params: {
  xHandle: string;
  style?: string;
}): Promise<DxPromptPreviewResponse> {
  const root = apiRoot();
  const handle = params.xHandle.trim().replace(/^@+/, '');
  const q = new URLSearchParams({ x_handle: handle });
  if (params.style?.trim()) q.set('style', params.style.trim());
  const res = await fetch(`${root}/v1/dx/prompt-preview?${q}`);
  return parseJsonOrThrow(res) as Promise<DxPromptPreviewResponse>;
}

export async function dxBadgeStatus(address: string): Promise<unknown> {
  const root = apiRoot();
  const res = await fetch(`${root}/v1/dx/badge/${encodeURIComponent(address.trim())}`);
  return parseJsonOrThrow(res);
}
