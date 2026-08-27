/**
 * Ð𝕏 pay-by-handle helpers (product, not a new protocol op).
 * Resolve `@handle` via dogex `/api/dx/handle`, then send plain DOGE.
 */
import { normalizeDxXHandle } from './protocol';

const HANDLE_BODY = /^[A-Za-z0-9_]{1,15}$/;

/** True when the field is an X-handle attempt (`@…`), not a Dogecoin address. */
export function looksLikeDxHandleInput(raw: string): boolean {
  const t = raw.trim();
  return t.startsWith('@');
}

/**
 * Canonical `@handle` if the input is a well-formed X handle (with or without `@`).
 * Returns null when it is empty, an address, or invalid.
 */
export function parseDxHandleInput(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith('D') && t.length >= 25) return null;
  const body = t.startsWith('@') ? t.slice(1) : t;
  if (!HANDLE_BODY.test(body)) return null;
  try {
    return normalizeDxXHandle(body);
  } catch {
    return null;
  }
}

export function dxHandlePathSegment(handle: string): string {
  return handle.trim().replace(/^@/, '').toLowerCase();
}

export function formatDxPayAmount(doge: number): string {
  if (!Number.isFinite(doge)) return '0';
  const s = doge.toFixed(8).replace(/\.?0+$/, '');
  return s === '' ? '0' : s;
}

export function dxPayReceiptTweetText(opts: {
  amountDoge: number;
  handle: string;
  txid: string;
  origin?: string;
}): string {
  const handle = opts.handle.startsWith('@') ? opts.handle : `@${opts.handle}`;
  const origin = (opts.origin || 'https://dogex.dog').replace(/\/+$/, '');
  const path = `${origin}/pay/${dxHandlePathSegment(handle)}`;
  const amt = formatDxPayAmount(opts.amountDoge);
  return `Sent ${amt} $DOGE to ${handle} via Ð𝕏\n\n${path}\n\n${opts.txid.trim()}`;
}

export function dxPayTweetIntentUrl(opts: {
  amountDoge: number;
  handle: string;
  txid: string;
  origin?: string;
}): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(dxPayReceiptTweetText(opts))}`;
}

export function dxPayInviteTweetText(handle: string, origin?: string): string {
  const h = handle.startsWith('@') ? handle : `@${handle}`;
  const originClean = (origin || 'https://dogex.dog').replace(/\/+$/, '');
  return `${h} link your 𝕏 to a Dogecoin wallet with Ð𝕏 so people can send you $DOGE:\n\n${originClean}/dx`;
}

export function dxPayInviteTweetIntentUrl(handle: string, origin?: string): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(dxPayInviteTweetText(handle, origin))}`;
}
