import { sha256 } from '@noble/hashes/sha2';

export function utf8Bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const h = hex.trim().toLowerCase().replace(/^0x/, '');
  if (h.length % 2 !== 0 || !/^[0-9a-f]*$/.test(h)) {
    throw new Error('invalid hex');
  }
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function writeUint32LE(out: Uint8Array, offset: number, value: number): void {
  const n = value >>> 0;
  out[offset] = n & 0xff;
  out[offset + 1] = (n >>> 8) & 0xff;
  out[offset + 2] = (n >>> 16) & 0xff;
  out[offset + 3] = (n >>> 24) & 0xff;
}

/** First 16 bytes of SHA-256(utf8). Spec `target_hash16` / `recipient_hash16`. */
export function sha256Hash16(input: string | Uint8Array): Uint8Array {
  const bytes = typeof input === 'string' ? utf8Bytes(input) : input;
  return sha256(bytes).slice(0, 16);
}
