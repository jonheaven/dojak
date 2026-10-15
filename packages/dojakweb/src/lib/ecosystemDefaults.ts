/**
 * Ðogenals / Dojak ecosystem factory defaults for host apps.
 *
 * Featured (defaults — user can change in Wallet → Settings):
 * - **Wallet bag (inscriptions / coins / DRC-20)**: **MyDoge** (`https://api.mydoge.com`),
 *   merged with **Spooky** (`api.spookydoge.xyz`) + InuBits — Spooky fills OG doginals /
 *   text while dogex is not genesis→tip
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
