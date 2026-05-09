/**
 * dogepsdt URI codec
 *
 * URI format:  dogepsdt:1:zlib:b64url:<payload>
 *   version    = 1
 *   compression= zlib  (pako deflate, default level)
 *   encoding   = b64url (standard base64url, no padding)
 *   payload    = base64url( pako.deflate( rawPsdtBytes ) )
 *
 * Compared to embedding the raw PSDT base64 in a URL hash, this format:
 *  - Reduces payload size by ~30 % (zlib compression)
 *  - Is self-contained — no server lookup required
 *  - Is scannable as a URI QR (lower version / density)
 *  - Is unambiguous — starts with "dogepsdt:" not "https://"
 */

import * as pako from 'pako';

// ── Constants ─────────────────────────────────────────────────────────────────

const SCHEME  = 'dogepsdt';
const VERSION = '1';
const COMP    = 'zlib';
const ENC     = 'b64url';

// ── Base64url helpers (no padding) ────────────────────────────────────────────

function toBase64Url(bytes: Uint8Array): string {
  const bin = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
  return btoa(bin)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(str.length + (4 - (str.length % 4)) % 4, '=');
  const bin = atob(padded);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

// ── Encoding ──────────────────────────────────────────────────────────────────

/**
 * Encode raw PSDT bytes into a dogepsdt URI.
 */
export function encodePsdtBytesToDogePsdtUri(psdtBytes: Buffer | Uint8Array): string {
  const compressed = pako.deflate(psdtBytes instanceof Buffer ? psdtBytes : new Uint8Array(psdtBytes));
  const payload    = toBase64Url(compressed);
  return `${SCHEME}:${VERSION}:${COMP}:${ENC}:${payload}`;
}

/**
 * Encode a base64 PSDT string into a dogepsdt URI.
 */
export function encodeBase64PsdtToDogePsdtUri(psdtBase64: string): string {
  const bin   = atob(psdtBase64);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return encodePsdtBytesToDogePsdtUri(bytes);
}

// ── Decoding ──────────────────────────────────────────────────────────────────

/**
 * Decode a dogepsdt URI into raw PSDT bytes.
 * Throws if the URI is malformed, the version/codec is unsupported,
 * or the compressed payload is corrupted.
 */
export function decodeDogePsdtUriToBytes(uri: string): Uint8Array {
  const parts = uri.split(':');
  // Minimum: dogepsdt:1:zlib:b64url:<payload>  → 5 parts
  if (parts.length < 5 || parts[0] !== SCHEME) {
    throw new Error(`Not a dogepsdt URI: "${uri.slice(0, 40)}…"`);
  }

  const version  = parts[1];
  const comp     = parts[2];
  const enc      = parts[3];
  const payload  = parts.slice(4).join(':');

  if (version !== VERSION) {
    throw new Error(`Unsupported dogepsdt version: ${version}`);
  }
  if (comp !== COMP) {
    throw new Error(`Unsupported compression: ${comp} (expected "${COMP}")`);
  }
  if (enc !== ENC) {
    throw new Error(`Unsupported encoding: ${enc} (expected "${ENC}")`);
  }
  if (!payload) {
    throw new Error('dogepsdt URI has empty payload.');
  }

  let compressed: Uint8Array;
  try {
    compressed = fromBase64Url(payload);
  } catch {
    throw new Error('dogepsdt payload is not valid base64url.');
  }

  try {
    return pako.inflate(compressed);
  } catch {
    throw new Error('dogepsdt payload decompression failed — data may be corrupted.');
  }
}

/**
 * Decode a dogepsdt URI into a standard base64-encoded PSDT string.
 */
export function decodeDogePsdtUriToBase64(uri: string): string {
  const bytes = decodeDogePsdtUriToBytes(uri);
  const bin   = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
  return btoa(bin);
}

// ── Guard ─────────────────────────────────────────────────────────────────────

/**
 * Returns true if the string looks like a dogepsdt URI (fast prefix check,
 * does not validate or decompress the payload).
 */
export function isDogePsdtUri(value: string): boolean {
  return value.startsWith(`${SCHEME}:`);
}
