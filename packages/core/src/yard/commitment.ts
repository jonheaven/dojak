/**
 * YARD v1 OP_RETURN commitment (40 bytes).
 * Spec: https://github.com/jonheaven/yard — YARD.md §6.1
 * Not a Doginal / Dogenals encoder.
 */

export const YARD_MAGIC = Buffer.from('YARD', 'ascii');
export const YARD_COMMITMENT_LEN = 40;
export const YARD_VERSION = 0x01;

export const YardCommitmentKind = {
  Single: 0x01,
  Merkle: 0x02,
} as const;

export type YardCommitment = {
  version: number;
  kind: number;
  root: Buffer; // 32 bytes
  flags: number;
};

export function encodeYardCommitment(c: YardCommitment): Buffer {
  if (c.root.length !== 32) throw new Error('YARD root must be 32 bytes');
  if (c.version !== YARD_VERSION) throw new Error('only YARD commitment v1');
  if (c.kind !== YardCommitmentKind.Single && c.kind !== YardCommitmentKind.Merkle) {
    throw new Error('unknown YARD commitment kind');
  }
  if ((c.flags & ~0x01) !== 0) throw new Error('unknown YARD commitment flags');
  const p = Buffer.alloc(YARD_COMMITMENT_LEN);
  YARD_MAGIC.copy(p, 0);
  p[4] = YARD_VERSION;
  p[5] = c.kind;
  c.root.copy(p, 6);
  p[38] = c.flags;
  p[39] = 0x00;
  return p;
}

export function decodeYardCommitment(payload: Buffer): YardCommitment {
  if (payload.length !== YARD_COMMITMENT_LEN) {
    throw new Error(`YARD commitment is ${payload.length} bytes, want ${YARD_COMMITMENT_LEN}`);
  }
  if (!payload.subarray(0, 4).equals(YARD_MAGIC)) {
    throw new Error('commitment magic is not YARD');
  }
  if (payload[4] !== YARD_VERSION) {
    throw new Error(`commitment version ${payload[4]} != 1`);
  }
  const kind = payload[5];
  if (kind !== YardCommitmentKind.Single && kind !== YardCommitmentKind.Merkle) {
    throw new Error(`unknown commitment kind 0x${kind.toString(16)}`);
  }
  const flags = payload[38];
  if ((flags & ~0x01) !== 0) {
    throw new Error(`unknown commitment flags 0x${flags.toString(16)}`);
  }
  if (payload[39] !== 0x00) throw new Error('reserved commitment byte is not 0');
  return {
    version: 1,
    kind,
    root: Buffer.from(payload.subarray(6, 38)),
    flags,
  };
}

export function isYardCommitmentPayload(payload: Buffer): boolean {
  try {
    decodeYardCommitment(payload);
    return true;
  } catch {
    return false;
  }
}
