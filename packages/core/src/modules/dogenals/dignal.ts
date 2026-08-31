/**
 * Ðignal wire — dogenals/spec/protocols/dignal/spec.md v1.0
 *
 * Magic is UTF-8 `Ð:DIG` (6 bytes). Do not use the old Era-2 `Ð:W` namespace.
 */

import { bytesToHex, hexToBytes, sha256Hash16, utf8Bytes, writeUint32LE } from './hash16';

export const DIGNAL_MARKER = 'Ð:DIG';
export const DIGNAL_VERSION = 0x01;
export const DIGNAL_CONTENT_VERSION = '1.0';
export const DIGNAL_SIGNAL_BYTES = 50;
export const DIGNAL_MAGIC = utf8Bytes(DIGNAL_MARKER);

export const DIGNAL_KIND = {
  message: 0x01,
  receipt: 0x02,
  'key-announcement': 0x03,
  'room-create': 0x04,
  'room-message': 0x05,
  'whisper-post': 0x06,
} as const;

export type DignalKind = keyof typeof DIGNAL_KIND;

export const DIGNAL_FLAG = {
  sound: 1 << 0,
  contentExpected: 1 << 1,
  replyRequested: 1 << 2,
  marketplace: 1 << 3,
  layered: 1 << 4,
  room: 1 << 5,
  gated: 1 << 6,
} as const;

export type EncodeDignalSignalOpts = {
  kind: DignalKind | number;
  flags?: number;
  recipientId?: string;
  recipientHash16?: Uint8Array | string;
  contentId?: string;
  contentHash16?: Uint8Array | string;
  expiryDelta?: number;
  nonce?: number;
};

function kindByte(kind: DignalKind | number): number {
  return typeof kind === 'number' ? kind : DIGNAL_KIND[kind];
}

function resolveHash16(label: string, id?: string, hash?: Uint8Array | string): Uint8Array {
  if (hash !== undefined) {
    if (typeof hash === 'string') return hexToBytes(hash);
    if (hash.length !== 16) throw new Error(`Ðignal ${label} must be 16 bytes`);
    return hash;
  }
  if (!id) return new Uint8Array(16);
  return sha256Hash16(id);
}

/** Spec §4.1 binary signal (50 bytes). */
export function encodeDignalSignal(opts: EncodeDignalSignalOpts): Uint8Array {
  const out = new Uint8Array(DIGNAL_SIGNAL_BYTES);
  out.set(DIGNAL_MAGIC, 0);
  out[6] = DIGNAL_VERSION;
  out[7] = kindByte(opts.kind);
  out[8] = (opts.flags ?? 0) & 0xff;
  out[9] = 0x00;
  out.set(resolveHash16('recipient_hash16', opts.recipientId, opts.recipientHash16), 10);
  out.set(resolveHash16('content_hash16', opts.contentId, opts.contentHash16), 26);
  writeUint32LE(out, 42, opts.expiryDelta ?? 0);
  writeUint32LE(out, 46, opts.nonce ?? 1);
  return out;
}

export function encodeDignalSignalHex(opts: EncodeDignalSignalOpts): string {
  return bytesToHex(encodeDignalSignal(opts));
}

/** Spec §4.2 short text. Private bodies MUST already be encrypted. */
export function encodeDignalShortText(kind: string, payload: string): Uint8Array {
  return utf8Bytes(`${DIGNAL_MARKER}:${kind}:${payload}`);
}

export type BuildDignalMessageOpts = {
  op?: string;
  cipher?: string;
  kem?: string;
  recipients: Array<Record<string, unknown>>;
  nonce: string;
  aad?: string;
  ciphertext: string;
  contentHash: string;
};

/** Spec §5 encrypted inscription JSON. Ciphertext MUST already be encrypted. */
export function buildDignalMessageJson(opts: BuildDignalMessageOpts): string {
  if (!opts.recipients.length) throw new Error('Ðignal message needs at least one recipient envelope');
  return JSON.stringify({
    p: DIGNAL_MARKER,
    v: DIGNAL_CONTENT_VERSION,
    op: opts.op ?? 'message',
    chain: 'dogecoin',
    cipher: opts.cipher ?? 'xchacha20poly1305',
    kem: opts.kem ?? 'secp256k1-ecdh-hkdf-sha256',
    recipients: opts.recipients,
    nonce: opts.nonce,
    aad: opts.aad,
    ciphertext: opts.ciphertext,
    content_hash: opts.contentHash,
  });
}
