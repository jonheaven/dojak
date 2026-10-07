/**
 * YARD operation encode/decode/sign — subset needed for tip/burn + consignment parse.
 * Spec: jonheaven/yard YARD.md
 */

import * as secp from '@noble/secp256k1';
import {
  TAG_OP,
  TAG_SIGHASH,
  bytesToHex,
  hexToBytes,
  internalTxidToRpc,
  sha256d,
  taggedSha256d,
} from './hash';

export const OpType = {
  Genesis: 0x00,
  Transfer: 0x01,
  Burn: 0x02,
  LaunchBuy: 0x03,
  LaunchSell: 0x04,
} as const;

export type OpTypeValue = (typeof OpType)[keyof typeof OpType];

export type YardOutpoint = { txid: Buffer; vout: number };

export type OpInput = {
  prevOpHash: Buffer;
  prevSeal: YardOutpoint;
  amount: bigint;
};

export type OpOutput = {
  seal: YardOutpoint;
  amount: bigint;
  pubkey: Buffer; // 33
};

export type YardOperation = {
  opVersion: number;
  contractId: Buffer; // 32
  opType: OpTypeValue;
  inputs: OpInput[];
  outputs: OpOutput[];
  meta: Buffer;
  sigs: Buffer[]; // 64 each
};

const HALF_N = Buffer.from(
  '7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0',
  'hex',
);

function writeOutpoint(buf: Buffer[], o: YardOutpoint) {
  buf.push(o.txid);
  const v = Buffer.alloc(4);
  v.writeUInt32LE(o.vout >>> 0, 0);
  buf.push(v);
}

function readOutpoint(b: Buffer, pos: number): { o: YardOutpoint; pos: number } {
  const txid = Buffer.from(b.subarray(pos, pos + 32));
  pos += 32;
  const vout = b.readUInt32LE(pos);
  pos += 4;
  return { o: { txid, vout }, pos };
}

export function thisTxOutpoint(vout: number): YardOutpoint {
  return { txid: Buffer.alloc(32), vout };
}

export function isThisTx(o: YardOutpoint): boolean {
  return o.txid.equals(Buffer.alloc(32));
}

export function resolveOutpoint(o: YardOutpoint, committingInternalTxid: Buffer): YardOutpoint {
  if (isThisTx(o)) return { txid: Buffer.from(committingInternalTxid), vout: o.vout };
  return { txid: Buffer.from(o.txid), vout: o.vout };
}

export function outpointKeyRpc(o: YardOutpoint): string {
  return `${internalTxidToRpc(o.txid)}:${o.vout}`;
}

function encodeInner(op: YardOperation, sighash: boolean): Buffer {
  const parts: Buffer[] = [];
  parts.push(Buffer.from([op.opVersion]));
  parts.push(op.contractId);
  parts.push(Buffer.from([op.opType]));
  const inCount = Buffer.alloc(2);
  inCount.writeUInt16LE(op.inputs.length, 0);
  parts.push(inCount);
  for (const i of op.inputs) {
    parts.push(i.prevOpHash);
    writeOutpoint(parts, i.prevSeal);
    const a = Buffer.alloc(16);
    let x = i.amount;
    for (let k = 0; k < 16; k++) {
      a[k] = Number(x & 0xffn);
      x >>= 8n;
    }
    parts.push(a);
  }
  const outCount = Buffer.alloc(2);
  outCount.writeUInt16LE(op.outputs.length, 0);
  parts.push(outCount);
  for (const o of op.outputs) {
    writeOutpoint(parts, o.seal);
    const a = Buffer.alloc(16);
    let x = o.amount;
    for (let k = 0; k < 16; k++) {
      a[k] = Number(x & 0xffn);
      x >>= 8n;
    }
    parts.push(a);
    if (o.pubkey.length !== 33) throw new Error('pubkey must be 33 bytes');
    parts.push(o.pubkey);
  }
  const metaLen = Buffer.alloc(2);
  metaLen.writeUInt16LE(op.meta.length, 0);
  parts.push(metaLen);
  parts.push(op.meta);
  parts.push(Buffer.from([op.sigs.length]));
  for (const sig of op.sigs) {
    parts.push(sighash ? Buffer.alloc(64) : sig);
  }
  return Buffer.concat(parts);
}

export function encodeOperation(op: YardOperation): Buffer {
  return encodeInner(op, false);
}

export function decodeOperation(bytes: Buffer | Uint8Array): YardOperation {
  const b = Buffer.from(bytes);
  let pos = 0;
  const opVersion = b[pos++];
  if (opVersion !== 1) throw new Error(`op_version ${opVersion} != 1`);
  const contractId = Buffer.from(b.subarray(pos, pos + 32));
  pos += 32;
  const opType = b[pos++] as OpTypeValue;
  const inputCount = b.readUInt16LE(pos);
  pos += 2;
  const inputs: OpInput[] = [];
  for (let i = 0; i < inputCount; i++) {
    const prevOpHash = Buffer.from(b.subarray(pos, pos + 32));
    pos += 32;
    const r = readOutpoint(b, pos);
    pos = r.pos;
    let amount = 0n;
    for (let k = 0; k < 16; k++) amount |= BigInt(b[pos + k]) << BigInt(8 * k);
    pos += 16;
    inputs.push({ prevOpHash, prevSeal: r.o, amount });
  }
  const outputCount = b.readUInt16LE(pos);
  pos += 2;
  const outputs: OpOutput[] = [];
  for (let i = 0; i < outputCount; i++) {
    const r = readOutpoint(b, pos);
    pos = r.pos;
    let amount = 0n;
    for (let k = 0; k < 16; k++) amount |= BigInt(b[pos + k]) << BigInt(8 * k);
    pos += 16;
    const pubkey = Buffer.from(b.subarray(pos, pos + 33));
    pos += 33;
    if (pubkey[0] !== 0x02 && pubkey[0] !== 0x03) throw new Error('pubkey is not compressed');
    outputs.push({ seal: r.o, amount, pubkey });
  }
  const metaLen = b.readUInt16LE(pos);
  pos += 2;
  if (metaLen > 512) throw new Error('meta_len exceeds 512');
  const meta = Buffer.from(b.subarray(pos, pos + metaLen));
  pos += metaLen;
  const sigCount = b[pos++];
  const sigs: Buffer[] = [];
  for (let i = 0; i < sigCount; i++) {
    sigs.push(Buffer.from(b.subarray(pos, pos + 64)));
    pos += 64;
  }
  if (pos !== b.length) throw new Error(`trailing ${b.length - pos} bytes`);
  return { opVersion, contractId, opType, inputs, outputs, meta, sigs };
}

export function opHash(op: YardOperation): Buffer {
  return sha256d(encodeOperation(op));
}

export function commitmentLeaf(op: YardOperation): Buffer {
  return taggedSha256d(TAG_OP, encodeOperation(op));
}

export function sighash(op: YardOperation): Buffer {
  return taggedSha256d(TAG_SIGHASH, encodeInner(op, true));
}

function isLowS(sig: Buffer): boolean {
  return sig.subarray(32).compare(HALF_N) <= 0;
}

export async function signOperation(
  op: YardOperation,
  index: number,
  secretKey32: Uint8Array,
): Promise<YardOperation> {
  if (index >= op.sigs.length) throw new Error('sig index out of range');
  const h = sighash(op);
  // @noble/secp256k1 v3: prehash must be false — we already hashed
  const compact = await secp.signAsync(h, secretKey32, { prehash: false, lowS: true });
  const sig = Buffer.from(compact);
  if (sig.length !== 64) throw new Error('expected compact 64-byte sig');
  if (!isLowS(sig)) throw new Error('high-S signature');
  const sigs = op.sigs.map((s, i) => (i === index ? sig : Buffer.from(s)));
  return { ...op, sigs };
}

export function compressedPubkeyFromSecret(secretKey32: Uint8Array): Buffer {
  return Buffer.from(secp.getPublicKey(secretKey32, true));
}

export function contractDisplay(contractId: Buffer, tick: string): string {
  return `${tick}-${bytesToHex(contractId.subarray(0, 4))}`;
}

export function opTypeName(t: OpTypeValue): string {
  switch (t) {
    case OpType.Genesis:
      return 'genesis';
    case OpType.Transfer:
      return 'transfer';
    case OpType.Burn:
      return 'burn';
    case OpType.LaunchBuy:
      return 'launch_buy';
    case OpType.LaunchSell:
      return 'launch_sell';
    default:
      return `0x${t.toString(16)}`;
  }
}

export function parsePubkeyHex(hex: string): Buffer {
  const b = hexToBytes(hex);
  if (b.length !== 33 || (b[0] !== 0x02 && b[0] !== 0x03)) {
    throw new Error('receiver pubkey must be 33-byte compressed hex');
  }
  return b;
}
