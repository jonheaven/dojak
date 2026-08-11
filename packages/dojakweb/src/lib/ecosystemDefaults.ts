/**
 * Ðogenals / Dojak ecosystem factory defaults for host apps.
 *
 * Featured (defaults — user can change in Wallet → Settings):
 * - **Bag**: MyDoge — DOGE balance, UTXOs, tx history, **era-1 Doginals / DRC-20**
 *   (dogex is not scanning classic Doginals; doggy.market is used for per-id metadata/preview)
 * - **Ðunes / Treats / Charms / Ðalkanes**: always dogex indexer (not gated by Wallet Data)
 * - **Chain ops**: command.dog first — broadcast / Core-backed status
 * - **Explorer links**: explorer.dogenals.com (Ðexplorer)
 *
 * Direction: migrate remaining reads to dogex when era-1 is indexed; until then Wallet Data = MyDoge for Doginals.
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
