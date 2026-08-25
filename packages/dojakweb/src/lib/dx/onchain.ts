/**
 * Ð𝕏 on-chain bind — compact OP_RETURN `DX` (spec/protocols/dx).
 * JSON inscription `p:"dx"` is the alternate; this is the product path.
 */
import {
  signOpReturnTransaction,
  broadcastSignedTransaction,
  txidFromRawHex,
} from '../broadcast/dogecoinTxBroadcast';
import { normalizeDxXHandle, parseTweetIdFromInput } from './protocol';

export const DX_MAGIC = 'DX';
export const DX_VERSION = 0x01;
export const DX_OP_REGISTER = 0x01;
export const DX_OP_REVOKE = 0x02;
export const DX_PROTOCOL_MARKER = 'dx' as const;

export function dxChallengeTweetText(address: string): string {
  return `Ð𝕏 linking this X account to Dogecoin\n\n${address.trim()}\n\ndogex.dog/dx`;
}

export function dxTweetIntentUrl(address: string): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(dxChallengeTweetText(address))}`;
}

function handleBytes(handle: string): Buffer {
  const canonical = normalizeDxXHandle(handle);
  const inner = canonical.slice(1).toLowerCase();
  return Buffer.from(inner, 'utf8');
}

export function encodeDxCompact(opts: {
  op: 'register' | 'revoke';
  handle: string;
  tweetId?: string;
}): Buffer {
  const name = handleBytes(opts.handle);
  if (name.length < 1 || name.length > 15) {
    throw new Error('Invalid X handle');
  }
  if (opts.op === 'register') {
    const raw = opts.tweetId?.trim() ?? '';
    const id = parseTweetIdFromInput(raw) ?? (/^[0-9]{1,20}$/.test(raw) ? raw : null);
    if (!id) throw new Error('tweet id required');
    let n: bigint;
    try {
      n = BigInt(id);
    } catch {
      throw new Error('invalid tweet id');
    }
    if (n <= 0n) throw new Error('invalid tweet id');
    const out = Buffer.alloc(5 + name.length + 8);
    out.write(DX_MAGIC, 0, 'ascii');
    out[2] = DX_VERSION;
    out[3] = DX_OP_REGISTER;
    out[4] = name.length;
    name.copy(out, 5);
    out.writeBigUInt64BE(n, 5 + name.length);
    return out;
  }
  const out = Buffer.alloc(5 + name.length);
  out.write(DX_MAGIC, 0, 'ascii');
  out[2] = DX_VERSION;
  out[3] = DX_OP_REVOKE;
  out[4] = name.length;
  name.copy(out, 5);
  return out;
}

export type PublishDxResult = {
  txid: string;
  handle: string;
  op: 'register' | 'revoke';
};

export async function publishDxOnChain(params: {
  fromAddress: string;
  privateKeyWIF: string;
  op: 'register' | 'revoke';
  handle: string;
  tweetId?: string;
  feeRate?: number;
}): Promise<PublishDxResult> {
  const handle = normalizeDxXHandle(params.handle);
  const rawPayload = encodeDxCompact({
    op: params.op,
    handle,
    tweetId: params.tweetId,
  });
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
    handle,
    op: params.op,
  };
}
