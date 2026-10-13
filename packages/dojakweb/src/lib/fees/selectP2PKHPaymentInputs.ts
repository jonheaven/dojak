/**
 * Plain P2PKH payment coin select.
 * Smallest coin that covers amount + size×rate. Change under 0.01 DOGE is
 * absorbed later by `fixCoinSelectP2PKHFee` — we do not step up to a larger
 * coin just to manufacture a change output.
 */
import { getStandardP2PKHTxSize } from 'doge-sdk';
import { selectSmallestSufficient, type CoinValue } from './selectSmallestSufficient';

export function selectP2PKHPaymentInputs<T extends CoinValue>(
  utxos: readonly T[],
  paymentsKoinu: number,
  feeRateKoinuPerByte: number,
  /** Payment outputs, not counting change. */
  paymentOutputCount = 1,
): T[] {
  const rate = Math.max(1, Math.floor(feeRateKoinuPerByte));
  const pay = Math.floor(paymentsKoinu);
  const outputs = Math.max(1, paymentOutputCount);
  return selectSmallestSufficient(utxos, (n) => {
    const inputs = Math.max(1, n);
    const fee = getStandardP2PKHTxSize(inputs, outputs, 0) * rate;
    return pay + fee;
  });
}
