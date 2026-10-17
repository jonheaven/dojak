/**
 * Canonical OP_RETURN locking-script construction for Dogecoin txs.
 * Use this for Dogetag text, Dogenals Era-2 namespace lines, or arbitrary indexable payloads.
 *
 * Not used by P2SH file-inscription chains (those carry data in scriptSig / carrier outputs).
 */

/** Dojakweb default for short on-chain text (DogeTag:tx / OP_RETURN). */
export const DOGETAG_MESSAGE_MAX_BYTES = 80;

/**
 * Typical relay policy: one push after OP_RETURN; Dogecoin Core often aligns with ~80 byte data for standardness.
 * Payloads larger than this may still propagate but are not guaranteed — callers may pass a higher cap explicitly.
 */
export const OP_RETURN_DATA_SOFT_CAP_BYTES = 80;

/** Bitcoin-family max script element size (consensus). */
export const MAX_SCRIPT_ELEMENT_BYTES = 520;

/**
 * Encode `data` as `OP_RETURN` + single push (standard pattern for one blob of metadata).
 * @throws if payload is empty or exceeds `maxPayloadBytes`
 */
export function buildOpReturnLockingScript(data: Buffer, maxPayloadBytes = MAX_SCRIPT_ELEMENT_BYTES): Buffer {
  if (!data.length) throw new Error('OP_RETURN payload cannot be empty');
  if (data.length > maxPayloadBytes) {
    throw new Error(`OP_RETURN payload too large: ${data.length} bytes (max ${maxPayloadBytes})`);
  }
  const parts: number[] = [0x6a]; // OP_RETURN
  if (data.length <= 75) {
    parts.push(data.length);
  } else if (data.length <= 255) {
    parts.push(0x4c, data.length); // OP_PUSHDATA1
  } else if (data.length <= 65535) {
    parts.push(0x4d);
    parts.push(data.length & 0xff, (data.length >> 8) & 0xff); // OP_PUSHDATA2 LE
  } else {
    parts.push(0x4e);
    parts.push(
      data.length & 0xff,
      (data.length >> 8) & 0xff,
      (data.length >> 16) & 0xff,
      (data.length >> 24) & 0xff,
    );
  }
  return Buffer.concat([Buffer.from(parts), data]);
}

/** UTF-8 bytes for a DogeTag:tx line; enforces {@link DOGETAG_MESSAGE_MAX_BYTES}. */
export function utf8PayloadForDogetagMessage(text: string): Buffer {
  const msg = Buffer.from(text, 'utf8');
  if (!msg.length) throw new Error('Message cannot be empty');
  if (msg.length > DOGETAG_MESSAGE_MAX_BYTES) {
    throw new Error(`Message too long: ${msg.length} bytes (max ${DOGETAG_MESSAGE_MAX_BYTES} for standard Dogetag OP_RETURN)`);
  }
  return msg;
}

/** Locking script for a validated short UTF-8 Dogetag message. */
export function buildDogetagOpReturnScript(messageUtf8: string): Buffer {
  return buildOpReturnLockingScript(utf8PayloadForDogetagMessage(messageUtf8), DOGETAG_MESSAGE_MAX_BYTES);
}

/**
 * Rough tx size contribution for one or more OP_RETURN outputs (8-byte value + varint + script each).
 * Used for fee estimation alongside input/change estimates.
 */
export function estimateOpReturnOutputsTxWeight(payloads: Buffer[]): number {
  let w = 0;
  for (const p of payloads) {
    const script = buildOpReturnLockingScript(p);
    const varint = script.length < 0xfd ? 1 : script.length <= 0xffff ? 3 : 5;
    w += 8 + varint + script.length;
  }
  return w;
}

/**
 * Take the nulldata byte-fee out of change. Matches a value-0 OP_RETURN that
 * coin-select did not size. Drops change when the leftover would be soft dust.
 */
export function applyNulldataFeeToChange<T extends { address: string; value: number }>(args: {
  outputs: T[];
  fee: number;
  change: number;
  changeAddress: string;
  extraFee: number;
  softDustKoinu: number;
}): { outputs: T[]; fee: number; change: number } {
  if (args.extraFee <= 0) {
    return { outputs: args.outputs, fee: args.fee, change: args.change };
  }
  const changeOut = args.change > 0 ? args.outputs[args.outputs.length - 1] : null;
  if (
    changeOut &&
    changeOut.address === args.changeAddress &&
    changeOut.value - args.extraFee >= args.softDustKoinu
  ) {
    const newChange = changeOut.value - args.extraFee;
    return {
      outputs: [...args.outputs.slice(0, -1), { ...changeOut, value: newChange }],
      fee: args.fee + args.extraFee,
      change: newChange,
    };
  }
  if (changeOut && changeOut.address === args.changeAddress) {
    return {
      outputs: args.outputs.slice(0, -1),
      fee: args.fee + changeOut.value,
      change: 0,
    };
  }
  throw new Error('Insufficient funds for amount plus network fee (OP_RETURN)');
}
