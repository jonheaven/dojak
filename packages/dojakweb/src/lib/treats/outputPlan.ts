import { buildOpReturnLockingScript, OP_RETURN_DATA_SOFT_CAP_BYTES } from '../tx/opReturn';
import type { DogeSdkLikeOutput } from '../tx/outputPlan';
import { TREATS_DUST_KOINU } from './constants';

/**
 * ÐogeTreats output order: vout0 OP_RETURN → vout1 paired dust (d/m/t) → change.
 * Burn omits the paired dust output.
 */
export function planTreatsOperationOutputs(params: {
  payload: Buffer;
  recipientAddress?: string;
  changeAddress: string;
  changeSats: number;
}): DogeSdkLikeOutput[] {
  const script = buildOpReturnLockingScript(params.payload, OP_RETURN_DATA_SOFT_CAP_BYTES);
  const out: DogeSdkLikeOutput[] = [{ value: 0, script: new Uint8Array(script) }];

  if (params.recipientAddress) {
    if (TREATS_DUST_KOINU < 100_000) {
      throw new Error('ÐogeTreats paired dust below relay dust floor');
    }
    out.push({ address: params.recipientAddress, value: TREATS_DUST_KOINU });
  }

  if (params.changeSats > 0) {
    out.push({ address: params.changeAddress, value: params.changeSats });
  }

  return out;
}

/** Extra vsize for paired dust output (8 + varint + ~25 byte P2PKH script). */
export const TREATS_PAIRED_DUST_OUTPUT_WEIGHT = 34;
