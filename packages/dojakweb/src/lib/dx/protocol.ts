/**
 * Ð𝕏 (Ðoge𝕏ID / `p: "dx"`) — Dogenals protocols/dx.
 *
 * Signing:
 * - **v2 (preferred):** `DX-REGISTER:<@handle>:<address>:<nonce>` (spec §7)
 * - **v1 (legacy):** `VerifyDogenal <nonce> <address>` (current dojak/command.dog)
 *
 * New clients SHOULD sign v2. Indexers and verifiers SHOULD accept both until v1 is retired.
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

/**
 * Spec-canonical registration challenge (includes handle).
 * Prefer this for new verifications.
 */
export function buildDxSigningMessageV2(
  xHandle: string,
  dogeAddress: string,
  nonce: string,
): string {
  const h = normalizeDxXHandle(xHandle).toLowerCase();
  const a = dogeAddress.trim();
  const n = nonce.trim();
  if (!a || !n) throw new Error('nonce and doge_address are required');
  return `DX-REGISTER:${h}:${a}:${n}`;
}

/**
 * Legacy challenge (deployed dojak / command.dog).
 * @deprecated Prefer {@link buildDxSigningMessageV2}
 */
export function buildDxSigningMessageLegacy(nonce: string, dogeAddress: string): string {
  const n = nonce.trim();
  const a = dogeAddress.trim();
  if (!n || !a) throw new Error('nonce and doge_address are required');
  return `VerifyDogenal ${n} ${a}`;
}

/**
 * Default client message: v2 when handle is known, else legacy.
 * Existing call sites that only pass nonce+address keep legacy behavior.
 */
export function buildDxSigningMessage(
  nonce: string,
  dogeAddress: string,
  xHandle?: string,
): string {
  if (xHandle?.trim()) {
    return buildDxSigningMessageV2(xHandle, dogeAddress, nonce);
  }
  return buildDxSigningMessageLegacy(nonce, dogeAddress);
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

export interface DxRevokePayload {
  p: typeof DX_PROTOCOL_MARKER;
  v: typeof DX_PROTOCOL_VERSION;
  op: 'revoke';
  x_handle: string;
  doge_address: string;
  previous_inscription_id: string;
  sig: string;
  timestamp: string;
}

/** Spec §7.2 — sign this to revoke an active registration. */
export function buildDxRevokeSigningMessage(
  xHandle: string,
  dogeAddress: string,
  previousInscriptionId: string,
): string {
  const h = normalizeDxXHandle(xHandle).toLowerCase();
  const a = dogeAddress.trim();
  const prev = previousInscriptionId.trim().toLowerCase();
  if (!a || !prev.includes('i')) {
    throw new Error('address and previous inscription id are required');
  }
  return `DX-REVOKE:${h}:${a}:${prev}`;
}

export function buildDxRevokePayload(params: {
  xHandle: string;
  dogeAddress: string;
  previousInscriptionId: string;
  signatureBase64: string;
  timestampIso?: string;
}): DxRevokePayload {
  return {
    p: DX_PROTOCOL_MARKER,
    v: DX_PROTOCOL_VERSION,
    op: 'revoke',
    x_handle: normalizeDxXHandle(params.xHandle),
    doge_address: params.dogeAddress.trim(),
    previous_inscription_id: params.previousInscriptionId.trim().toLowerCase(),
    sig: params.signatureBase64.trim(),
    timestamp: params.timestampIso ?? new Date().toISOString(),
  };
}
