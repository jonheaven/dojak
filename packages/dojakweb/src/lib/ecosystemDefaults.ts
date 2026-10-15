/**
 * Ðogenals / Dojak ecosystem factory defaults for host apps.
 *
 * Featured (defaults — user can change in Wallet → Settings):
 * - **Wallet bag (inscriptions / coins / DRC-20)**: **MyDoge** (`https://api.mydoge.com`),
 *   merged with **doggy.market** `/wallet/:addr/nfts` (via `/api/doggy`) + Spooky + InuBits.
 *   Doggy is the live Era-1 Doginals inventory when MyDoge lists empty / Spooky is down.
 * - **Ðunes / Treats / Charms / Ðalkanes**: always dogex indexer
 * - **Chain ops**: command.dog first — broadcast / Core-backed status
 * - **Explorer links**: doge.watch/tx · /address · /mempool (SPA also at /explorer)
 *
 * dogex remains selectable in Settings for hosts that prefer the studio indexer.
 */
import { ensureDefaultWalletDataProvider } from '../utils/api';
import { ensureDefaultChainExplorer } from '../utils/dogeTxExplorer';

/** Call once on host boot (idempotent migrations). */
export function ensureDojakwebEcosystemDefaults(): void {
  ensureDefaultWalletDataProvider();
  ensureDefaultChainExplorer();
  // Broadcast policy pulls doge-sdk. Load it after paint, not with the page shell.
  void import('./broadcast/dogecoinTxBroadcast').then((m) => {
    m.ensureDefaultBroadcastConfig();
  });
}
