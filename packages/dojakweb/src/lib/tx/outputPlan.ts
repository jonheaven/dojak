/**
 * Composable output planning for P2PKH-style txs (doge-sdk `createP2PKHTransaction` shape).
 * Lets any flow attach zero or more OP_RETURN blobs alongside payments, tips, and change.
 */

import { buildOpReturnLockingScript, MAX_SCRIPT_ELEMENT_BYTES } from './opReturn';
import type { DogetagTip } from './types';
import {
  assertPlainPaymentKoinu,
  discardSoftDustChangeKoinu,
} from '../dogecoin/softDust';

/** One payment or metadata output in doge-sdk terms. */
export type DogeSdkLikeOutput = {
  value: number;
  script?: Uint8Array;
  address?: string;
};

function assertDustAddress(name: string, address: string | undefined, value: number): void {
  // Tips / plain payments: require soft-dust-safe amounts so OP_RETURN txs mine.
  if (value > 0 && address) {
    assertPlainPaymentKoinu(name, value);
  }
}

export interface PlanPaymentOutputsParams {
  /** Optional tip (≥ dust). */
  tip?: DogetagTip;
  /** Change back to sender; omit or 0 to skip. */
  changeAddress: string;
  changeSats: number;
  /** Extra OP_RETURN payloads (e.g. Dogenals Era-2 + custom), in desired output order. */
  opReturnPayloads?: Buffer[];
  /** Max bytes per OP_RETURN push (default script-element max). */
  maxOpReturnPayloadBytes?: number;
}

/**
 * Build ordered outputs: each `opReturnPayloads` entry → optional tip → optional change.
 * OP_RETURN outputs always use value 0.
 */
export function planPaymentOutputsWithOptionalOpReturns(params: PlanPaymentOutputsParams): DogeSdkLikeOutput[] {
  const {
    tip,
    changeAddress,
    changeSats,
    opReturnPayloads = [],
    maxOpReturnPayloadBytes = MAX_SCRIPT_ELEMENT_BYTES,
  } = params;

  const out: DogeSdkLikeOutput[] = [];

  for (const data of opReturnPayloads) {
    const script = buildOpReturnLockingScript(data, maxOpReturnPayloadBytes);
    out.push({ value: 0, script: new Uint8Array(script) });
  }

  const tipSats = tip?.satoshis ?? 0;
  if (tip && tipSats > 0) {
    assertDustAddress('Tip', tip.address, tipSats);
    out.push({ address: tip.address, value: tipSats });
  }

  if (changeSats > 0) {
    const change = discardSoftDustChangeKoinu(changeSats);
    if (change > 0) {
      out.push({ address: changeAddress, value: change });
    }
  }

  return out;
}
