/**
 * ÐN05 — NIP-05 names on Dogecoin.
 * Spec: dogenals/spec/protocols/dn05/spec.md
 *
 * Compact OP_RETURN: ASCII `N05` ‖ ver=0x01 ‖ op ‖ namelen ‖ name ‖ [32-byte pubkey]
 */

import {
  signOpReturnTransaction,
  broadcastSignedTransaction,
  txidFromRawHex,
} from './broadcast/dogecoinTxBroadcast';

export const DN05_MAGIC = 'N05';
export const DN05_VERSION = 0x01;
export const DN05_OP_SET = 0x01;
export const DN05_OP_CLEAR = 0x02;
export const DN05_DOMAIN = 'dogenals.com';
export const DN05_MARKER = 'Ð:N05';

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

export function normalizeDn05Name(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (s === '_') return s;
  if (!s || s.length > 30) return null;
  if (!/^[a-z0-9][a-z0-9._-]{0,29}$/.test(s)) return null;
  return s;
}

function hexToBytes(hex: string): Uint8Array | null {
  const s = hex.trim().toLowerCase().replace(/^0x/, '');
  if (s.length !== 64 || !/^[0-9a-f]+$/.test(s)) return null;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function bech32Polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((b >> i) & 1) chk ^= GEN[i]!;
    }
  }
  return chk;
}

function bech32HrpExpand(hrp: string): number[] {
  const ret: number[] = [];
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) >> 5);
  ret.push(0);
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) & 31);
  return ret;
}

function convertBits(data: number[], from: number, to: number, pad: boolean): number[] | null {
  let acc = 0;
  let bits = 0;
  const maxv = (1 << to) - 1;
  const out: number[] = [];
  for (const value of data) {
    if (value < 0 || value >> from) return null;
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      out.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits) out.push((acc << (to - bits)) & maxv);
  } else if (bits >= from || ((acc << (to - bits)) & maxv)) {
    return null;
  }
  return out;
}

/** Decode `npub1…` or 64-char hex to 32-byte x-only pubkey. */
export function parseNostrPubkey(raw: string): Uint8Array | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^[0-9a-fA-F]{64}$/.test(s)) return hexToBytes(s);
  const lower = s.toLowerCase();
  if (!lower.startsWith('npub1')) return null;
  const pos = lower.lastIndexOf('1');
  if (pos < 1) return null;
  const hrp = lower.slice(0, pos);
  if (hrp !== 'npub') return null;
  const dataPart = lower.slice(pos + 1);
  const values: number[] = [];
  for (const c of dataPart) {
    const i = BECH32_CHARSET.indexOf(c);
    if (i < 0) return null;
    values.push(i);
  }
  if (values.length < 6) return null;
  if (bech32Polymod([...bech32HrpExpand(hrp), ...values]) !== 1) return null;
  const bytes = convertBits(values.slice(0, -6), 5, 8, false);
  if (!bytes || bytes.length !== 32) return null;
  return Uint8Array.from(bytes);
}

export function encodeNpub(pubkey: Uint8Array): string {
  if (pubkey.length !== 32) throw new Error('pubkey must be 32 bytes');
  const data = convertBits(Array.from(pubkey), 8, 5, true);
  if (!data) throw new Error('bech32 convert failed');
  const hrp = 'npub';
  const values = [...data];
  const checksumValues = [...bech32HrpExpand(hrp), ...values, 0, 0, 0, 0, 0, 0];
  const polymod = bech32Polymod(checksumValues) ^ 1;
  for (let i = 0; i < 6; i++) values.push((polymod >> (5 * (5 - i))) & 31);
  return `${hrp}1${values.map((v) => BECH32_CHARSET[v]).join('')}`;
}

export function dn05Identifier(name: string): string {
  return `${name}@${DN05_DOMAIN}`;
}

export function encodeDn05Compact(opts: {
  op: 'set' | 'clear';
  name: string;
  pubkey?: Uint8Array;
}): Buffer {
  const name = normalizeDn05Name(opts.name);
  if (!name) throw new Error('Invalid ÐN05 name (1–30 chars: a-z 0-9 . _ -)');
  const nameBytes = Buffer.from(name, 'utf8');
  if (opts.op === 'set') {
    const pk = opts.pubkey;
    if (!pk || pk.length !== 32) throw new Error('set requires a 32-byte Nostr pubkey');
    const out = Buffer.alloc(6 + nameBytes.length + 32);
    out.write(DN05_MAGIC, 0, 'ascii');
    out[3] = DN05_VERSION;
    out[4] = DN05_OP_SET;
    out[5] = nameBytes.length;
    nameBytes.copy(out, 6);
    Buffer.from(pk).copy(out, 6 + nameBytes.length);
    if (out.length > 80) throw new Error('ÐN05 payload exceeds 80-byte OP_RETURN limit');
    return out;
  }
  const out = Buffer.alloc(6 + nameBytes.length);
  out.write(DN05_MAGIC, 0, 'ascii');
  out[3] = DN05_VERSION;
  out[4] = DN05_OP_CLEAR;
  out[5] = nameBytes.length;
  nameBytes.copy(out, 6);
  return out;
}

export type PublishDn05Result = {
  txid: string;
  name: string;
  identifier: string;
  op: 'set' | 'clear';
};

export async function publishDn05OnChain(params: {
  fromAddress: string;
  privateKeyWIF: string;
  op: 'set' | 'clear';
  name: string;
  /** 64-hex or npub1… — required for set */
  pubkey?: string;
  feeRate?: number;
}): Promise<PublishDn05Result> {
  const name = normalizeDn05Name(params.name);
  if (!name) throw new Error('Invalid ÐN05 name');
  let pubkey: Uint8Array | undefined;
  if (params.op === 'set') {
    pubkey = parseNostrPubkey(params.pubkey ?? '');
    if (!pubkey) throw new Error('Enter a 64-hex pubkey or npub1…');
  }
  const rawPayload = encodeDn05Compact({ op: params.op, name, pubkey });
  const { rawHex } = await signOpReturnTransaction({
    message: '',
    rawPayload,
    fromAddress: params.fromAddress,
    privateKeyWIF: params.privateKeyWIF,
    feeRate: params.feeRate,
  });
  const broadcastId = await broadcastSignedTransaction(rawHex);
  return {
    txid: broadcastId || txidFromRawHex(rawHex),
    name,
    identifier: dn05Identifier(name),
    op: params.op,
  };
}

export function pubkeyHexFromInput(raw: string): string | null {
  const pk = parseNostrPubkey(raw);
  return pk ? bytesToHex(pk) : null;
}
