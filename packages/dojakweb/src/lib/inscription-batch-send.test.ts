import { describe, expect, it } from 'vitest';
import {
  batchTransferFeeShib,
  planBatchInscriptionTransfer,
  selectFeeCoinsForInscriptionBatch,
} from './inscription-batch-send';

function outpoint(n: number): string {
  return `${n.toString(16).padStart(64, 'a')}:0`;
}

/** Same assignment dogex uses in OutputValues::find_output. */
function findOutput(values: number[], offset: number): { index: number; within: number } | null {
  let rest = offset;
  for (let i = 0; i < values.length; i++) {
    const value = values[i]!;
    if (rest < value) return { index: i, within: rest };
    rest -= value;
  }
  return null;
}

describe('planBatchInscriptionTransfer', () => {
  it('keeps each name on its own output when values match input order', () => {
    const plan = planBatchInscriptionTransfer([
      { outpoint: outpoint(1), value: 100_000, offset: 0, label: 'a.doge' },
      { outpoint: outpoint(2), value: 100_000, offset: 0, label: 'b.doge' },
      { outpoint: outpoint(3), value: 250_000, offset: 0, label: 'c.doge' },
    ]);
    expect(plan.coins.map((c) => c.value)).toEqual([100_000, 100_000, 250_000]);
    const outputs = plan.coins.map((c) => c.value);
    outputs.forEach((value, index) => {
      const hit = findOutput(outputs, plan.coins.slice(0, index).reduce((s, c) => s + c.value, 0));
      expect(hit).toEqual({ index, within: 0 });
      expect(hit && outputs[hit.index]).toBe(value);
    });
  });

  it('keeps a non-zero offset on the same output instead of the next name', () => {
    const plan = planBatchInscriptionTransfer([
      { outpoint: outpoint(1), value: 100_000, offset: 80_000, label: 'late.doge' },
      { outpoint: outpoint(2), value: 100_000, offset: 0, label: 'next.doge' },
    ]);
    const outputs = plan.coins.map((c) => c.value);
    expect(findOutput(outputs, 80_000)).toEqual({ index: 0, within: 80_000 });
    expect(findOutput(outputs, 100_000)).toEqual({ index: 1, within: 0 });
  });

  it('moves two names that already share a coin together, once', () => {
    const shared = outpoint(9);
    const plan = planBatchInscriptionTransfer([
      { outpoint: shared, value: 200_000, offset: 0, label: 'one.doge' },
      { outpoint: shared, value: 200_000, offset: 50_000, label: 'two.doge' },
    ]);
    expect(plan.coins).toHaveLength(1);
    expect(plan.coins[0]!.labels).toEqual(['one.doge', 'two.doge']);
    const outputs = [200_000];
    expect(findOutput(outputs, 50_000)).toEqual({ index: 0, within: 50_000 });
  });

  it('refuses an offset past the end of the coin', () => {
    expect(() =>
      planBatchInscriptionTransfer([{ outpoint: outpoint(1), value: 100_000, offset: 100_000 }]),
    ).toThrow(/outside its coin/);
  });

  it('refuses more coins than one standard transaction should carry', () => {
    const legs = Array.from({ length: 101 }, (_, i) => ({
      outpoint: `${(i + 1).toString(16).padStart(64, 'b')}:1`,
      value: 100_000,
    }));
    expect(() => planBatchInscriptionTransfer(legs)).toThrow(/100/);
  });
});

describe('selectFeeCoinsForInscriptionBatch', () => {
  it('pays the fee from a plain coin and ignores postage-sized coins', () => {
    const plain = { txid: 'c'.repeat(64), vout: 1, value: 5_000_000 };
    const postage = { txid: 'd'.repeat(64), vout: 0, value: 100_000 };
    const selected = selectFeeCoinsForInscriptionBatch([postage, plain], 12, 1_000);
    expect(selected).toEqual([plain]);
    expect(batchTransferFeeShib(12, 1, 1_000)).toBeLessThan(plain.value);
  });

  it('includes the soft-dust surcharge when inscription outputs are under 0.01 Ð', () => {
    const small = { txid: 'e'.repeat(64), vout: 0, value: 2_000_000 };
    const large = { txid: 'f'.repeat(64), vout: 0, value: 50_000_000 };
    // 20 names × 0.01 Ð soft-dust = 0.2 Ð, which the 0.02 Ð coin cannot cover.
    const selected = selectFeeCoinsForInscriptionBatch([small, large], 20, 1_000, 20 * 1_000_000);
    expect(selected).toEqual([large]);
  });
});
