/**
 * Ð𝕏 protocol helpers for the Dojak extension (tip + bind).
 * Chain truth: dogex GET /api/dx/{handle,address}. Product: command.dog /v1/dx/*.
 */

export const DX_PROTOCOL_MARKER = 'dx' as const;
export const DX_MAGIC = 'DX';
export const DX_VERSION = 0x01;
export const DX_OP_REGISTER = 0x01;
export const DX_PAY_NOTE_MAX_BYTES = 80;
export const DX_MIN_TIP_DOGE = 0.001;
export const HANDLE_BODY = /^[A-Za-z0-9_]{1,15}$/;

export const COMMAND_DOG_API = 'https://api.command.dog';
export const DOGEX_API = 'https://dogex.command.dog';
export const DX_EXPLORER_TX = 'https://explorer.dogenals.com/tx';
export const DX_ORIGIN = 'https://dogex.dog';

const RESERVED_X_PATHS = new Set([
  'home',
  'explore',
  'notifications',
  'messages',
  'i',
  'settings',
  'search',
  'compose',
  'login',
  'signup',
  'tos',
  'privacy',
  'hashtag',
  'jobs',
  'communities',
  'premium',
  'verified',
  'about',
  'download',
  'intent',
  'share',
  'following',
  'followers',
  'lists',
  'bookmarks',
  'grok',
  'jobs',
  'live'
]);

export function normalizeDxXHandle(input: string): string {
  const s = input.trim();
  if (!s) throw new Error('X handle is required');
  const withAt = s.startsWith('@') ? s : `@${s}`;
  if (!/^@[A-Za-z0-9_]{1,15}$/.test(withAt)) {
    throw new Error('Invalid X handle (use @username, max 15 characters)');
  }
  return withAt;
}

export function dxHandleKey(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase();
}

export function tryParsePayHandle(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  const body = t.startsWith('@') ? t.slice(1) : t;
  if (!HANDLE_BODY.test(body)) return null;
  try {
    return normalizeDxXHandle(body);
  } catch {
    return null;
  }
}

export function parseTweetIdFromInput(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  if (/^\d{1,20}$/.test(t) && t !== '0') return t;
  const status = t.match(/\/(?:status|statuses)\/(\d{1,20})(?:\?|$|\/)/);
  if (status && status[1] !== '0') return status[1];
  return null;
}

export function isReservedXPath(segment: string): boolean {
  return RESERVED_X_PATHS.has(segment.toLowerCase());
}

/** Profile handle from an x.com pathname (`/user`, `/user/status/id`, `/i/user/id`). */
export function parseXPathContext(pathname: string, href = ''): { handle: string | null; postId: string | null } {
  const path = pathname.split('?')[0];
  const status = path.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d{1,20})(?:\/|$)/);
  if (status && !isReservedXPath(status[1])) {
    return { handle: normalizeSafe(status[1]), postId: status[2] };
  }
  const fromHref = href.match(/\/([A-Za-z0-9_]{1,15})\/status\/(\d{1,20})/);
  if (fromHref && !isReservedXPath(fromHref[1])) {
    return { handle: normalizeSafe(fromHref[1]), postId: fromHref[2] };
  }
  const profile = path.match(/^\/([A-Za-z0-9_]{1,15})\/?$/);
  if (profile && !isReservedXPath(profile[1])) {
    return { handle: normalizeSafe(profile[1]), postId: null };
  }
  return { handle: null, postId: null };
}

function normalizeSafe(body: string): string | null {
  try {
    return normalizeDxXHandle(body);
  } catch {
    return null;
  }
}

export function dxChallengeTweetText(address: string): string {
  return `I'm linking my 𝕏 account to my wallet on the Dogecoin blockchain using Ð𝕏 protocol:\n\n${address.trim()}\n\ndogex.dog/dx`;
}

export function dxTweetIntentUrl(address: string): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(dxChallengeTweetText(address))}`;
}

export function formatPayDoge(n: number, digits = 8): string {
  if (!Number.isFinite(n)) return '0';
  const s = n.toFixed(digits).replace(/\.?0+$/, '');
  return s === '' ? '0' : s;
}

export function noteByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

export function dxPayOnChainMemo(note: string, postId?: string | null): string {
  const tag = postId ? `post:${postId}` : '';
  const n = note.trim();
  if (!tag) return n;
  if (!n) return tag.slice(0, DX_PAY_NOTE_MAX_BYTES);
  const combined = `${n} ${tag}`;
  return noteByteLength(combined) <= DX_PAY_NOTE_MAX_BYTES ? combined : tag;
}

export function dxPayReceiptTweetText(opts: {
  amountDoge: number;
  handle: string;
  txid: string;
  postId?: string | null;
}): string {
  const handle = opts.handle.startsWith('@') ? opts.handle : `@${opts.handle}`;
  const explorer = `${DX_EXPLORER_TX}/${opts.txid.trim()}`;
  if (opts.postId) {
    return `Paid ${handle} ${formatPayDoge(opts.amountDoge)} $DOGE on this post.\n\n${explorer}\n\nCoins left my wallet and landed in theirs. X never sees the UTXO.`;
  }
  const inner = handle.slice(1);
  return `Sent ${formatPayDoge(opts.amountDoge)} $DOGE to ${handle} via Ð𝕏\n\n${DX_ORIGIN}/pay/${inner}\n\n${opts.txid.trim()}`;
}

export function dxPayTweetIntentUrl(opts: {
  amountDoge: number;
  handle: string;
  txid: string;
  postId?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set('text', dxPayReceiptTweetText(opts));
  if (opts.postId) params.set('in_reply_to', opts.postId);
  return `https://x.com/intent/tweet?${params.toString()}`;
}

export function dxPayInviteTweetIntentUrl(handle: string, postId?: string | null): string {
  const h = handle.startsWith('@') ? handle : `@${handle}`;
  const text = postId
    ? `${h} people want to tip this post in $DOGE. Link once with Ð𝕏 — we never hold coins for an unbound handle:\n\n${DX_ORIGIN}/dx`
    : `${h} link your 𝕏 to a Dogecoin wallet with Ð𝕏 so people can send you $DOGE:\n\n${DX_ORIGIN}/dx`;
  const params = new URLSearchParams({ text });
  if (postId) params.set('in_reply_to', postId);
  return `https://x.com/intent/tweet?${params.toString()}`;
}

export function shortDxAddress(address: string, head = 6, tail = 4): string {
  const a = address.trim();
  if (a.length <= head + tail + 1) return a;
  return `${a.slice(0, head)}…${a.slice(-tail)}`;
}

export function dogecoinPayUri(
  address: string,
  opts?: { amount?: number; label?: string; message?: string }
): string {
  const params = new URLSearchParams();
  if (opts?.amount != null && Number.isFinite(opts.amount) && opts.amount >= DX_MIN_TIP_DOGE) {
    params.set('amount', formatPayDoge(opts.amount));
  }
  if (opts?.label?.trim()) params.set('label', opts.label.trim());
  if (opts?.message?.trim()) params.set('message', opts.message.trim().slice(0, DX_PAY_NOTE_MAX_BYTES));
  const q = params.toString();
  return q ? `dogecoin:${address.trim()}?${q}` : `dogecoin:${address.trim()}`;
}

function handleBytes(handle: string): Buffer {
  const canonical = normalizeDxXHandle(handle);
  const inner = canonical.slice(1).toLowerCase();
  return Buffer.from(inner, 'utf8');
}

/** Compact OP_RETURN `DX` register / revoke (spec/protocols/dx). */
export function encodeDxCompact(opts: { op: 'register' | 'revoke'; handle: string; tweetId?: string }): Buffer {
  const name = handleBytes(opts.handle);
  if (name.length < 1 || name.length > 15) {
    throw new Error('Invalid X handle');
  }
  if (opts.op === 'register') {
    const raw = opts.tweetId?.trim() ?? '';
    const id = parseTweetIdFromInput(raw) ?? (/^[0-9]{1,20}$/.test(raw) ? raw : null);
    if (!id) throw new Error('tweet id required');
    let n: bigint;
    try {
      n = BigInt(id);
    } catch {
      throw new Error('invalid tweet id');
    }
    if (n <= 0n) throw new Error('invalid tweet id');
    const out = Buffer.alloc(5 + name.length + 8);
    out.write(DX_MAGIC, 0, 'ascii');
    out[2] = DX_VERSION;
    out[3] = DX_OP_REGISTER;
    out[4] = name.length;
    name.copy(out, 5);
    out.writeBigUInt64BE(n, 5 + name.length);
    return out;
  }
  const out = Buffer.alloc(5 + name.length);
  out.write(DX_MAGIC, 0, 'ascii');
  out[2] = DX_VERSION;
  out[3] = 0x02;
  out[4] = name.length;
  name.copy(out, 5);
  return out;
}

export function isValidDogeP2pkh(address: string): boolean {
  return /^D[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address.trim());
}
