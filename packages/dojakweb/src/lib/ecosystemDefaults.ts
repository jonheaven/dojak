/**
 * Ðogenals / Dojak ecosystem factory defaults for host apps.
 *
 * Featured (defaults — user can change in Wallet → Settings):
 * - **Bag**: MyDoge — balance, UTXOs, tx history (`walletDataProvider: mydoge`)
 * - **Chain ops**: command.dog first — broadcast / Core-backed status
 * - **Explorer links**: explorer.dogenals.com (Ðexplorer)
 *
 * Open: dogex, BlockCypher, Blockchair, SoChain, local RPC, etc. remain selectable.
 */
import { ensureDefaultWalletDataProvider } from '../utils/api';
import { ensureDefaultChainExplorer } from '../utils/dogeTxExplorer';
import { ensureDefaultBroadcastConfig } from './broadcast/dogecoinTxBroadcast';

/** Call once on host boot (idempotent migrations). */
export function ensureDojakwebEcosystemDefaults(): void {
  ensureDefaultWalletDataProvider();
  ensureDefaultChainExplorer();
  ensureDefaultBroadcastConfig();
}
