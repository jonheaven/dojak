/**
 * Spendable vs locked DOGE breakdown for dashboard / send UX.
 * Total (indexer) often includes inscription carriers + coins still settling;
 * spendable is what plain DOGE sends may actually pick.
 */
import {
  fetchSpendableUtxosConservativeForAddress,
  filterPaymentSpendableUtxos,
} from './broadcast/dogecoinTxBroadcast';
import { getLocalHoldStats, mergePaymentUtxos } from './mempoolSpendOverlay';
import { INSCRIPTION_LIKELY_UTXO_KOINU, loadLockedUtxos } from './utxo-tools';

export type SpendableBalanceBreakdown = {
  spendableKoinu: number;
  spendableDoge: number;
  spendableCount: number;
  /** Coins still listed by indexers but held by local broadcast overlay. */
  localHoldKoinu: number;
  localHoldCount: number;
  localHoldDoge: number;
  /** Exact 0.001 Ð outputs (typical inscription carriers). */
  dustCarrierKoinu: number;
  dustCarrierCount: number;
  dustCarrierDoge: number;
  /** Manually / auto-locked outpoints. */
  lockedKoinu: number;
  lockedCount: number;
  lockedDoge: number;
  /** Indexer wallet total (passed in) minus spendable — residual unavailable. */
  unavailableDoge: number;
};

function toDoge(koinu: number): number {
  return Math.round(koinu) / 1e8;
}

/**
 * Best-effort breakdown. Prefer MyDoge-grade lists; never blocks the UI on failure.
 */
export async function getSpendableBalanceBreakdown(
  address: string,
  walletTotalDoge: number,
): Promise<SpendableBalanceBreakdown> {
  let spendableKoinu = 0;
  let spendableCount = 0;
  let dustCarrierKoinu = 0;
  let dustCarrierCount = 0;
  let lockedKoinu = 0;
  let lockedCount = 0;
  let localHoldKoinu = 0;
  let localHoldCount = 0;

  try {
    const conservative = await fetchSpendableUtxosConservativeForAddress(address);
    const asPayment = conservative.map((u) => ({
      txid: u.tx_hash,
      vout: u.tx_output_n,
      value: u.value,
    }));
    const holds = getLocalHoldStats(address, asPayment);
    localHoldKoinu = holds.heldKoinu;
    localHoldCount = holds.heldCount;

    const locked = loadLockedUtxos(address);
    for (const u of conservative) {
      const key = `${u.tx_hash.toLowerCase()}:${u.tx_output_n}`;
      if (u.value === INSCRIPTION_LIKELY_UTXO_KOINU) {
        dustCarrierKoinu += u.value;
        dustCarrierCount += 1;
      }
      if (locked.has(key)) {
        lockedKoinu += u.value;
        lockedCount += 1;
      }
    }

    const { safe } = await filterPaymentSpendableUtxos(address, conservative);
    const spendable = mergePaymentUtxos(
      address,
      safe.map((u) => ({
        txid: u.tx_hash,
        vout: u.tx_output_n,
        value: u.value,
      })),
    );
    spendableKoinu = spendable.reduce((s, u) => s + u.value, 0);
    spendableCount = spendable.length;
  } catch {
    /* leave zeros — UI still shows wallet total */
  }

  const spendableDoge = toDoge(spendableKoinu);
  const unavailableDoge = Math.max(0, Math.round((walletTotalDoge - spendableDoge) * 1e8) / 1e8);

  return {
    spendableKoinu,
    spendableDoge,
    spendableCount,
    localHoldKoinu,
    localHoldCount,
    localHoldDoge: toDoge(localHoldKoinu),
    dustCarrierKoinu,
    dustCarrierCount,
    dustCarrierDoge: toDoge(dustCarrierKoinu),
    lockedKoinu,
    lockedCount,
    lockedDoge: toDoge(lockedKoinu),
    unavailableDoge,
  };
}
