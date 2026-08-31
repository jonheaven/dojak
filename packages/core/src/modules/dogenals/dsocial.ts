/**
 * Ðocial wire — dogenals/spec/protocols/dsocial/spec.md v1.1
 *
 * Canonical signal is 30 bytes. Tip amount is NEVER in OP_RETURN.
 */

import { bytesToHex, hexToBytes, sha256Hash16, utf8Bytes, writeUint32LE } from './hash16';

export const DSOCIAL_MARKER = 'Ð:SOC';
export const DSOCIAL_VERSION = 0x01;
export const DSOCIAL_CONTENT_VERSION = '1.1';
export const DSOCIAL_SIGNAL_BYTES = 30;
export const DSOCIAL_MAGIC = utf8Bytes(DSOCIAL_MARKER);

export const DSOCIAL_KIND = {
  post: 0x01,
  engage: 0x02,
  follow: 0x03,
  unfollow: 0x04,
  reply: 0x05,
  quote: 0x06,
  repost: 0x07,
} as const;

export type DsocialKind = keyof typeof DSOCIAL_KIND;

export const DSOCIAL_REACTION = {
  none: 0x00,
  like: 0x01,
  heart: 0x02,
  fire: 0x03,
  laugh: 0x04,
  doge: 0x05,
  checkin: 0x10,
  milestone: 0x20,
} as const;

export type DsocialReaction = keyof typeof DSOCIAL_REACTION;

export const DSOCIAL_FLAG = {
  sound: 1 << 0,
  contentExpected: 1 << 1,
  whisper: 1 << 3,
  marketplace: 1 << 4,
  media: 1 << 5,
} as const;

export type EncodeDsocialSignalOpts = {
  kind: DsocialKind | number;
  flags?: number;
  reaction?: DsocialReaction | number;
  /** Inscription id `{64hex}i{n}` lowercase, or followee address. Hashed to 16 bytes. */
  targetId?: string;
  /** Raw 16-byte hash (or 32-char hex) when the caller already has target_hash16. */
  targetHash16?: Uint8Array | string;
  nonce?: number;
};

function kindByte(kind: DsocialKind | number): number {
  return typeof kind === 'number' ? kind : DSOCIAL_KIND[kind];
}

function reactionByte(reaction: DsocialReaction | number | undefined): number {
  if (reaction === undefined) return 0;
  return typeof reaction === 'number' ? reaction : DSOCIAL_REACTION[reaction];
}

function resolveHash16(opts: EncodeDsocialSignalOpts): Uint8Array {
  if (opts.targetHash16 !== undefined) {
    if (typeof opts.targetHash16 === 'string') return hexToBytes(opts.targetHash16);
    if (opts.targetHash16.length !== 16) throw new Error('Ðocial target_hash16 must be 16 bytes');
    return opts.targetHash16;
  }
  if (!opts.targetId) throw new Error('Ðocial signal needs targetId or targetHash16');
  return sha256Hash16(opts.targetId);
}

/** Spec §4.1 binary signal. */
export function encodeDsocialSignal(opts: EncodeDsocialSignalOpts): Uint8Array {
  const kind = kindByte(opts.kind);
  const flags = (opts.flags ?? 0) & 0xff;
  const reaction = reactionByte(opts.reaction);
  if (kind === DSOCIAL_KIND.engage && reaction === 0) {
    throw new Error('Ðocial engage MUST set a non-zero reaction');
  }
  const out = new Uint8Array(DSOCIAL_SIGNAL_BYTES);
  out.set(DSOCIAL_MAGIC, 0);
  out[6] = DSOCIAL_VERSION;
  out[7] = kind;
  out[8] = flags;
  out[9] = reaction;
  out.set(resolveHash16(opts), 10);
  writeUint32LE(out, 26, opts.nonce ?? 1);
  return out;
}

export function encodeDsocialSignalHex(opts: EncodeDsocialSignalOpts): string {
  return bytesToHex(encodeDsocialSignal(opts));
}

/** Default Like: sound flag + like reaction. Tip is a separate DOGE output. */
export function encodeDsocialEngageLike(targetInscriptionId: string, nonce = 1): Uint8Array {
  return encodeDsocialSignal({
    kind: 'engage',
    flags: DSOCIAL_FLAG.sound,
    reaction: 'like',
    targetId: targetInscriptionId.trim().toLowerCase(),
    nonce,
  });
}

export function encodeDsocialFollow(followeeAddress: string, nonce = 1, unfollow = false): Uint8Array {
  return encodeDsocialSignal({
    kind: unfollow ? 'unfollow' : 'follow',
    flags: 0,
    reaction: 'none',
    targetId: followeeAddress.trim(),
    nonce,
  });
}

/** Spec §4.6 short text (demos only). */
export function encodeDsocialShortText(kind: string, payload: string): Uint8Array {
  return utf8Bytes(`${DSOCIAL_MARKER}:${kind}:${payload}`);
}

export type BuildDsocialPostOpts = {
  content: string;
  payTo: string;
  parent?: string;
  quote?: string;
  repostOf?: string;
  tags?: string[];
  mediaInscriptionId?: string;
  mediaMime?: string;
};

/** Spec §5 content inscription JSON. */
export function buildDsocialPostJson(opts: BuildDsocialPostOpts): string {
  const op = opts.parent ? 'reply' : opts.quote ? 'quote' : opts.repostOf ? 'repost' : 'post';
  const body: Record<string, unknown> = {
    p: DSOCIAL_MARKER,
    v: DSOCIAL_CONTENT_VERSION,
    op,
    chain: 'dogecoin',
    content: opts.content.slice(0, 4000),
    pay_to: opts.payTo,
  };
  if (opts.parent) body.parent = opts.parent;
  if (opts.quote) body.quote = opts.quote;
  if (opts.repostOf) body.repost_of = opts.repostOf;
  if (opts.mediaInscriptionId) {
    body.media = [{ inscription_id: opts.mediaInscriptionId, mime: opts.mediaMime || 'application/octet-stream' }];
  }
  if (opts.tags?.length) body.tags = opts.tags.slice(0, 16);
  return JSON.stringify(body);
}

export function parseDsocialSignal(bytes: Uint8Array): {
  magic: string;
  version: number;
  kind: number;
  flags: number;
  reaction: number;
  targetHash16Hex: string;
  nonce: number;
} | null {
  if (bytes.length !== DSOCIAL_SIGNAL_BYTES) return null;
  if (bytesToHex(bytes.slice(0, 6)) !== bytesToHex(DSOCIAL_MAGIC)) return null;
  return {
    magic: DSOCIAL_MARKER,
    version: bytes[6],
    kind: bytes[7],
    flags: bytes[8],
    reaction: bytes[9],
    targetHash16Hex: bytesToHex(bytes.slice(10, 26)),
    nonce: bytes[26] | (bytes[27] << 8) | (bytes[28] << 16) | (bytes[29] << 24),
  };
}
