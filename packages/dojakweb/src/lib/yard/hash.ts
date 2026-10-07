/** SHA256d + tagged hashes matching yard-core (browser-safe). */

import * as bitcoin from 'bitcoinjs-lib';

export const TAG_OP = Buffer.from('yard/op/v1', 'utf8');
export const TAG_SIGHASH = Buffer.from('yard/sighash/v1', 'utf8');

export function sha256d(data: Buffer | Uint8Array): Buffer {
  const first = bitcoin.crypto.sha256(Buffer.from(data));
  return bitcoin.crypto.sha256(first);
}

export function taggedSha256d(tag: Buffer, msg: Buffer | Uint8Array): Buffer {
  return sha256d(Buffer.concat([tag, Buffer.from(msg)]));
}

export function bytesToHex(b: Buffer | Uint8Array): string {
  return Buffer.from(b).toString('hex');
}

export function hexToBytes(hex: string): Buffer {
  const h = hex.trim().replace(/^0x/i, '');
  if (h.length % 2 !== 0) throw new Error('hex length must be even');
  return Buffer.from(h, 'hex');
}

/** Internal txid → RPC (byte-reversed) hex. */
export function internalTxidToRpc(internal: Buffer): string {
  return Buffer.from(internal).reverse().toString('hex');
}

/** RPC txid hex → internal byte order. */
export function rpcTxidToInternal(rpcHex: string): Buffer {
  const b = hexToBytes(rpcHex);
  if (b.length !== 32) throw new Error('txid must be 32 bytes');
  return Buffer.from(b).reverse();
}
