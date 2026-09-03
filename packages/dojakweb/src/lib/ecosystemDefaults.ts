/**
 * Ðogenals / Dojak ecosystem factory defaults for host apps.
 *
 * Featured (defaults — user can change in Wallet → Settings):
 * - **Inscriptions / DRC-20**: **dogex** (`https://dogex.command.dog`, MyDoge-shaped `/inscriptions/:addr`)
 * - **DOGE UTXOs / coin select**: MyDoge public `/utxos` until electrs is at tip
 * - **Ðunes / Treats / Charms / Ðalkanes**: always dogex indexer
 * - **Chain ops**: command.dog first — broadcast / Core-backed status
 * - **Explorer links**: doge.watch/explorer
 *
 * MyDoge drops Doginals/DRC-20 display+send on 2026-09-17 (Maestro API dies 09-18).
 * Dojak + dogex are the public path. Collection-owned markets are not the index.
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
