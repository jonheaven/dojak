/**
 * doge-sdk `coinSelectP2PKH` (≤0.5.0-beta.5) mis-assigns change:
 * it subtracts only the *marginal* cost of a change output
 * (`feeRate * (scriptLen + 8)` ≈ 33_000 koinu at 1000 koinu/byte) instead of the
 * full tx fee. Reported `fee` is correct; on-chain burn equals that marginal cost
 * (~0.00033 Ð), which is far below Core min relay (~0.001 Ð/kB) so txs stall.
 *
 * Recompute change from inputs − payments − size×rate after coin select.
 */
import { getStandardP2PKHTxSize } from 'doge-sdk';

const DUST_KOINU = 100_000; // 0.001 DOGE — Core-aligned dust

export type P2PKHPaymentOutput = { address: string; value: number };

export type P2PKHUtxo = { txid: string; vout: number; value: number };

export type CorrectedP2PKHSelection<T extends P2PKHUtxo = P2PKHUtxo> = {
  inputs: T[];
  outputs: P2PKHPaymentOutput[];
  fee: number;
  change: number;
};

export function fixCoinSelectP2PKHFee<T extends P2PKHUtxo>(params: {
  changeAddress: string;
  feeRateKoinuPerByte: number;
  inputs: T[];
  /** Payment outputs only (no change). */
  payments: P2PKHPaymentOutput[];
}): CorrectedP2PKHSelection<T> {
  const feeRate = Math.max(1, Math.floor(params.feeRateKoinuPerByte));
  const inputs = params.inputs;
  const payments = params.payments.map((o) => ({
    address: o.address,
    value: Math.floor(o.value),
  }));
  const inputSum = inputs.reduce((s, u) => s + u.value, 0);
  const paySum = payments.reduce((s, o) => s + o.value, 0);
  if (inputSum < paySum) {
    throw new Error('Insufficient funds');
  }

  const nIn = inputs.length;
  const nPay = payments.length;

  // Prefer a change output when leftover clears dust after paying a sized fee.
  let fee = getStandardP2PKHTxSize(nIn, nPay + 1, 0) * feeRate;
  let change = inputSum - paySum - fee;

  if (change >= DUST_KOINU) {
    change = Math.floor(change);
    // Keep fee as the exact residual so input − output always matches.
    fee = inputSum - paySum - change;
    return {
      inputs,
      outputs: [...payments, { address: params.changeAddress, value: change }],
      fee,
      change,
    };
  }

  // No change: fee absorbs remainder (may slightly exceed size×rate).
  fee = getStandardP2PKHTxSize(nIn, nPay, 0) * feeRate;
  if (inputSum < paySum + fee) {
    throw new Error('Insufficient funds for amount plus network fee');
  }
  fee = inputSum - paySum;
  return { inputs, outputs: payments, fee, change: 0 };
}
