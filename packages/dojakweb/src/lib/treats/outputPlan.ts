import { buildOpReturnLockingScript } from '../tx/opReturn';
import type { DogeSdkLikeOutput } from '../tx/outputPlan';
import { TREATS_DUST_KOINU } from './constants';

/**
 * ÐogeTreats output order: OP_RETURN then paired dust (d/m/t) then change.
 * Indexer scans every Treats OP_RETURN; wallets still put the envelope first.
 */
export function planTreatsOperationOutputs(params: {
  payload: Buffer;
  recipientAddress?: string;
  changeAddress: string;
  changeSats: number;
}): DogeSdkLikeOutput[] {
  const script = buildOpReturnLockingScript(params.payload, 81);
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

/**
 * Multi-op Treats airdrop: OP_RETURN + dust pairs in output order (spec §5.6), then
 * optional job-fee output, then change.
 */
export function planTreatsAirdropOutputs(params: {
  pairs: Array<{ payload: Buffer; recipientAddress: string }>;
  changeAddress: string;
  changeSats: number;
  jobFee?: { address: string; value: number };
}): DogeSdkLikeOutput[] {
  if (!params.pairs.length) {
    throw new Error('Treats airdrop needs at least one recipient pair');
  }
  const out: DogeSdkLikeOutput[] = [];
  for (const pair of params.pairs) {
    const script = buildOpReturnLockingScript(pair.payload, 81);
    out.push({ value: 0, script: new Uint8Array(script) });
    if (TREATS_DUST_KOINU < 100_000) {
      throw new Error('ÐogeTreats paired dust below relay dust floor');
    }
    out.push({ address: pair.recipientAddress, value: TREATS_DUST_KOINU });
  }
  if (params.jobFee && params.jobFee.value > 0) {
    out.push({ address: params.jobFee.address, value: params.jobFee.value });
  }
  if (params.changeSats > 0) {
    out.push({ address: params.changeAddress, value: params.changeSats });
  }
  return out;
}

/** Extra vsize for paired dust output (8 + varint + ~25 byte P2PKH script). */
export const TREATS_PAIRED_DUST_OUTPUT_WEIGHT = 34;
