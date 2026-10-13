import { describe, expect, it } from 'vitest';
import { fixCoinSelectP2PKHFee } from '../fixCoinSelectP2PKHFee';
import { selectP2PKHPaymentInputs } from './selectP2PKHPaymentInputs';
import { selectSmallestSufficient } from './selectSmallestSufficient';

const KOINU = 100_000_000;

function coin(valueDoge: number, n: number) {
  return { txid: `aa${n.toString(16).padStart(62, '0')}`, vout: 0, value: Math.round(valueDoge * KOINU) };
}

describe('selectSmallestSufficient', () => {
  it('uses the smallest coin that covers a tiny fee and leaves the large ones', () => {
    const utxos = [coin(50.52792196, 1), coin(49.14733442, 2), coin(15.85884804, 3), coin(0.02, 4)];
    const selected = selectSmallestSufficient(utxos, () => Math.round(0.0067 * KOINU));
    expect(selected).toHaveLength(1);
    expect(selected[0]!.value).toBe(coin(0.02, 4).value);
  });

  it('does not take the three largest when one coin covers the target', () => {
    const utxos = [coin(50, 1), coin(49, 2), coin(15, 3)];
    const selected = selectSmallestSufficient(utxos, () => Math.round(1.1 * KOINU));
    expect(selected.map((u) => u.value)).toEqual([coin(15, 3).value]);
  });

  it('combines smallest-first only when no single coin is enough', () => {
    const utxos = [coin(0.2, 1), coin(0.2, 2), coin(0.25, 3)];
    const selected = selectSmallestSufficient(utxos, () => Math.round(0.35 * KOINU));
    expect(selected.map((u) => u.value)).toEqual([coin(0.2, 1).value, coin(0.2, 2).value]);
  });

  it('keeps a required input and does not spend it twice', () => {
    const seal = coin(0.01, 9);
    const utxos = [seal, coin(2, 1), coin(30, 2)];
    const selected = selectSmallestSufficient(
      utxos,
      (n) => seal.value + Math.round(0.5 * KOINU) + n * 50_000,
      { reserved: [seal] },
    );
    expect(selected[0]).toEqual(seal);
    expect(selected).toHaveLength(2);
    expect(selected[1]!.value).toBe(coin(2, 1).value);
  });
});

describe('selectP2PKHPaymentInputs', () => {
  it('pays 1 DOGE from the 15 DOGE coin, not the 50', () => {
    const utxos = [coin(50.53, 1), coin(49.15, 2), coin(15.86, 3)];
    const selected = selectP2PKHPaymentInputs(utxos, KOINU, 50_000);
    expect(selected).toHaveLength(1);
    expect(selected[0]!.value).toBe(coin(15.86, 3).value);
  });

  it('uses a small coin that covers the fee even when change will be absorbed', () => {
    const utxos = [coin(0.02, 1), coin(50, 2)];
    const selected = selectP2PKHPaymentInputs(utxos, 1_000_000, 1_000);
    expect(selected).toHaveLength(1);
    expect(selected[0]!.value).toBe(coin(0.02, 1).value);
  });
});

describe('fixCoinSelectP2PKHFee soft dust', () => {
  it('absorbs change under 0.01 DOGE instead of emitting a soft-dust output', () => {
    const input = coin(0.02, 1);
    const fixed = fixCoinSelectP2PKHFee({
      changeAddress: 'DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L',
      feeRateKoinuPerByte: 1_000,
      inputs: [input],
      payments: [{ address: 'DFundTargetAddressxxxxxxxxxxxxxxxxx', value: 1_000_000 }],
    });
    expect(fixed.change).toBe(0);
    expect(fixed.outputs).toHaveLength(1);
    expect(fixed.fee).toBe(input.value - 1_000_000);
  });
});
