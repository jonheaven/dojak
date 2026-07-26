/**
 * Spendable UTXOs for plain DOGE payments (send / tips / fees).
 * Multi-indexer intersection + local mempool overlay to avoid stale spends.
 */
import {
  fetchSpendableUtxosConservativeForAddress,
  filterSafeSpendableUtxos,
} from './broadcast/dogecoinTxBroadcast';
import {
  mergePaymentUtxos,
  type PaymentUtxo,
} from './mempoolSpendOverlay';
import { getAddressUtxos } from './doginal-psdt';

export type { PaymentUtxo };

/**
 * Best-effort payment UTXO set for Local Browser Wallet sends.
 * Prefer multi-indexer consensus; fall back to RPC/Blockchair list; always apply overlay.
 */
export async function getPaymentUtxosForSend(address: string): Promise<PaymentUtxo[]> {
  let indexed: PaymentUtxo[] = [];

  try {
    const conservative = await fetchSpendableUtxosConservativeForAddress(address);
    const { safe } = filterSafeSpendableUtxos(address, conservative);
    indexed = safe.map((u) => ({
      txid: u.tx_hash,
      vout: u.tx_output_n,
      value: u.value,
    }));
  } catch {
    indexed = [];
  }

  if (indexed.length === 0) {
    try {
      const fallback = await getAddressUtxos(address);
      indexed = fallback.map((u) => ({
        txid: u.txid,
        vout: u.vout,
        value: u.value,
        scriptPubKey: u.scriptPubKey,
      }));
    } catch {
      indexed = [];
    }
  }

  return mergePaymentUtxos(address, indexed);
}
