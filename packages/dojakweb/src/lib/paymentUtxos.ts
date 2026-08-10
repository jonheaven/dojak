/**
 * Spendable UTXOs for plain DOGE payments (send / tips / fees).
 * Wallet data provider (MyDoge by default) + dogex Ðune guard + local mempool overlay.
 */
import {
  fetchSpendableUtxosConservativeForAddress,
  filterPaymentSpendableUtxos,
} from './broadcast/dogecoinTxBroadcast';
import {
  mergePaymentUtxos,
  type PaymentUtxo,
} from './mempoolSpendOverlay';
import { getAddressUtxos } from './doginal-psdt';

export type { PaymentUtxo };

/**
 * Best-effort payment UTXO set for Local Browser Wallet sends.
 * Prefer wallet data provider; fall back to RPC/provider list via getAddressUtxos; always apply overlay.
 */
export async function getPaymentUtxosForSend(address: string): Promise<PaymentUtxo[]> {
  let indexed: PaymentUtxo[] = [];

  try {
    const conservative = await fetchSpendableUtxosConservativeForAddress(address);
    const { safe } = await filterPaymentSpendableUtxos(address, conservative);
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
      const { safe } = await filterPaymentSpendableUtxos(
        address,
        fallback.map((u) => ({
          tx_hash: u.txid,
          tx_output_n: u.vout,
          value: u.value,
        })),
      );
      indexed = safe.map((u) => ({
        txid: u.tx_hash,
        vout: u.tx_output_n,
        value: u.value,
      }));
    } catch {
      indexed = [];
    }
  }

  return mergePaymentUtxos(address, indexed);
}
