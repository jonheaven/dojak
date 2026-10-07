/**
 * YARD consignment decode (JSON or YARDCONS binary) + open-note walk.
 */

import { decodeYardCommitment, encodeYardCommitment, YardCommitmentKind } from './commitment';
import {
  bytesToHex,
  hexToBytes,
  internalTxidToRpc,
  sha256d,
} from './hash';
import {
  commitmentLeaf,
  contractDisplay,
  decodeOperation,
  encodeOperation,
  opHash,
  opTypeName,
  resolveOutpoint,
  type YardOperation,
  type YardOutpoint,
} from './operation';

export const CONS_MAGIC = Buffer.from('YARDCONS', 'ascii');

export type YardConsignment = {
  version: number;
  ops: YardOperation[];
  /** Raw serialized L1 txs (same order as ops when 1:1). */
  txs: Buffer[];
};

export type OpenNote = {
  seal: YardOutpoint;
  sealKey: string; // rpc txid:vout
  amount: bigint;
  pubkeyHex: string;
  contractId: Buffer;
  contractLabel: string;
  tick: string;
};

type ConsignmentJson = {
  v: number;
  ops: string[];
  txs: string[];
  proofs?: unknown[];
};

function readU32LE(b: Buffer, pos: number): number {
  return b.readUInt32LE(pos);
}

export function decodeConsignmentBinary(bytes: Buffer): YardConsignment {
  if (!bytes.subarray(0, 8).equals(CONS_MAGIC)) throw new Error('magic is not YARDCONS');
  let pos = 8;
  const version = bytes[pos++];
  if (version !== 1) throw new Error(`consignment version ${version} != 1`);
  const nOps = readU32LE(bytes, pos);
  pos += 4;
  const ops: YardOperation[] = [];
  for (let i = 0; i < nOps; i++) {
    const n = readU32LE(bytes, pos);
    pos += 4;
    ops.push(decodeOperation(bytes.subarray(pos, pos + n)));
    pos += n;
  }
  const nTxs = readU32LE(bytes, pos);
  pos += 4;
  const txs: Buffer[] = [];
  for (let i = 0; i < nTxs; i++) {
    const n = readU32LE(bytes, pos);
    pos += 4;
    txs.push(Buffer.from(bytes.subarray(pos, pos + n)));
    pos += n;
  }
  // skip proofs for lab
  return { version: 1, ops, txs };
}

export function decodeConsignmentJson(bytes: Buffer | string): YardConsignment {
  const j = JSON.parse(typeof bytes === 'string' ? bytes : bytes.toString('utf8')) as ConsignmentJson;
  if (j.v !== 1) throw new Error(`json version ${j.v} != 1`);
  return {
    version: 1,
    ops: j.ops.map((h) => decodeOperation(hexToBytes(h))),
    txs: j.txs.map((h) => hexToBytes(h)),
  };
}

export function decodeConsignmentAny(bytes: Buffer | Uint8Array | string): YardConsignment {
  if (typeof bytes === 'string') {
    const t = bytes.trim();
    if (t.startsWith('{')) return decodeConsignmentJson(t);
    return decodeConsignmentAny(Buffer.from(t, 'utf8'));
  }
  const b = Buffer.from(bytes);
  if (b.subarray(0, 8).equals(CONS_MAGIC)) return decodeConsignmentBinary(b);
  return decodeConsignmentJson(b);
}

export function encodeConsignmentJson(c: YardConsignment): string {
  return JSON.stringify(
    {
      v: 1,
      ops: c.ops.map((o) => bytesToHex(encodeOperation(o))),
      txs: c.txs.map((t) => bytesToHex(t)),
      proofs: [],
    },
    null,
    2,
  );
}

function tickFromGenesis(op: YardOperation): string {
  if (op.opType !== 0x00 || !op.meta.length) return 'NOTE';
  try {
    const m = JSON.parse(op.meta.toString('utf8')) as { tick?: string };
    if (m.tick && /^[A-Z0-9]{1,8}$/.test(m.tick)) return m.tick;
  } catch {
    /* ignore */
  }
  return 'NOTE';
}

/** Pair ops with L1 txs (index-aligned) and compute open notes. */
export function openNotesFromConsignment(c: YardConsignment): OpenNote[] {
  if (c.ops.length !== c.txs.length) {
    throw new Error(`ops (${c.ops.length}) and txs (${c.txs.length}) length mismatch`);
  }
  const genesis = c.ops.find((o) => o.opType === 0x00);
  const tick = genesis ? tickFromGenesis(genesis) : 'NOTE';

  type Entry = { amount: bigint; pubkey: Buffer; contractId: Buffer };
  const map = new Map<string, Entry>();

  for (let i = 0; i < c.ops.length; i++) {
    const op = c.ops[i];
    const l1Internal = sha256d(c.txs[i]);
    for (const inp of op.inputs) {
      const key = `${internalTxidToRpc(inp.prevSeal.txid)}:${inp.prevSeal.vout}`;
      map.delete(key);
    }
    for (const o of op.outputs) {
      const resolved = resolveOutpoint(o.seal, l1Internal);
      const key = `${internalTxidToRpc(resolved.txid)}:${resolved.vout}`;
      map.set(key, {
        amount: o.amount,
        pubkey: o.pubkey,
        contractId: Buffer.from(op.contractId),
      });
    }
  }

  const notes: OpenNote[] = [];
  for (const [sealKey, e] of map) {
    const [txidRpc, voutStr] = sealKey.split(':');
    const seal: YardOutpoint = {
      txid: Buffer.from(hexToBytes(txidRpc).reverse()),
      vout: Number(voutStr),
    };
    notes.push({
      seal,
      sealKey,
      amount: e.amount,
      pubkeyHex: bytesToHex(e.pubkey),
      contractId: e.contractId,
      contractLabel: contractDisplay(e.contractId, tick),
      tick,
    });
  }
  return notes;
}

export type VerifySummary = {
  opCount: number;
  txCount: number;
  openNotes: OpenNote[];
  ops: Array<{ type: string; contract: string; hash: string }>;
  tick: string;
};

export function summarizeConsignment(c: YardConsignment): VerifySummary {
  const openNotes = openNotesFromConsignment(c);
  const genesis = c.ops.find((o) => o.opType === 0x00);
  const tick = genesis ? tickFromGenesis(genesis) : openNotes[0]?.tick ?? 'NOTE';
  return {
    opCount: c.ops.length,
    txCount: c.txs.length,
    openNotes,
    tick,
    ops: c.ops.map((o) => ({
      type: opTypeName(o.opType),
      contract: contractDisplay(o.contractId, tick),
      hash: bytesToHex(opHash(o)).slice(0, 16) + '…',
    })),
  };
}

/** Build 40-byte YARD commitment for a single signed operation. */
export function commitmentPayloadForOp(op: YardOperation): Buffer {
  const root = commitmentLeaf(op);
  return Buffer.from(
    encodeYardCommitment({
      version: 1,
      kind: YardCommitmentKind.Single,
      root,
      flags: 0,
    }),
  );
}

export function decodeCommitmentHex(hex: string) {
  return decodeYardCommitment(hexToBytes(hex));
}
