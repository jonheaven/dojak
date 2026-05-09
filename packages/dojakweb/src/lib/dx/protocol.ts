/**
 * Ð𝕏 (Ðoge𝕏ID / `p: "dx"`) — aligned with Dogenals protocols/dx/spec.md v1.0.
 * Canonical signing message: `VerifyDogenal [nonce] [doge_address]`
 */

export const DX_PROTOCOL_MARKER = 'dx' as const;
export const DX_PROTOCOL_VERSION = '1.0' as const;

export interface DxRegisterProof {
  tweet_id: string;
  signature: string;
  nonce: string;
}

export interface DxRegisterPayload {
  p: typeof DX_PROTOCOL_MARKER;
  v: typeof DX_PROTOCOL_VERSION;
  op: 'register';
  x_handle: string;
  doge_address: string;
  proof: DxRegisterProof;
  timestamp: string;
}

/** Exact challenge string wallets MUST sign (spec §6). */
export function buildDxSigningMessage(nonce: string, dogeAddress: string): string {
  const n = nonce.trim();
  const a = dogeAddress.trim();
  if (!n || !a) throw new Error('nonce and doge_address are required');
  return `VerifyDogenal ${n} ${a}`;
}

/** Normalize to @handle per dx register schema (1–15 chars after @). */
export function normalizeDxXHandle(input: string): string {
  const s = input.trim();
  if (!s) throw new Error('X handle is required');
  const withAt = s.startsWith('@') ? s : `@${s}`;
  if (!/^@[A-Za-z0-9_]{1,15}$/.test(withAt)) {
    throw new Error('Invalid X handle (use @username, max 15 characters)');
  }
  return withAt;
}

/** Accept numeric id or common X / Twitter status URLs. */
export function parseTweetIdFromInput(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^[0-9]{1,30}$/.test(t)) return t;
  const status = t.match(/\/status\/(\d{1,30})(?:\?|$|\/)/);
  if (status) return status[1];
  const web = t.match(/\/statuses\/(\d{1,30})(?:\?|$|\/)/);
  if (web) return web[1];
  return null;
}

export function buildDxRegisterPayload(params: {
  xHandle: string;
  dogeAddress: string;
  tweetId: string;
  signatureBase64: string;
  nonce: string;
  timestampIso?: string;
}): DxRegisterPayload {
  return {
    p: DX_PROTOCOL_MARKER,
    v: DX_PROTOCOL_VERSION,
    op: 'register',
    x_handle: normalizeDxXHandle(params.xHandle),
    doge_address: params.dogeAddress.trim(),
    proof: {
      tweet_id: params.tweetId.trim(),
      signature: params.signatureBase64.trim(),
      nonce: params.nonce.trim(),
    },
    timestamp: params.timestampIso ?? new Date().toISOString(),
  };
}
