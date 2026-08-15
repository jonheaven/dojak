/**
 * $NOIZ / The Black Doge — flagship ÐogeTreats deploy (permanent on L1).
 * Keep in sync with dogenals/docs/plan.md and spec/protocols/treats/examples/deploy-noiz.json.
 *
 * Treasury-gated: 6.9M max, 5% premine to deployer dust, ~4y deployer-only mint window.
 * Remaining supply is minted later by treasury for disclosed buckets (doge.cam, games, Come Home).
 * Do not use the 1B trench preset for this ticker.
 */
import { buildTreatsDeployJson } from './buildJson';

export const NOIZ_FLAGSHIP = {
  tick: 'NOIZ',
  /** Canonical ÐA (deploy `block:tx`) — ticker MAY collide; this id does not. */
  assetId: '6332410:9',
  deployTxid: '8ccfa6d81f082b2f858ab382f8eead25f7578e7ee70d490b31b1a8fb13a2f48b',
  max: '6904200',
  premine: '345210',
  /** ~4 years at ~1 min/block — only deployer may mint until then. */
  deployerWindow: '2100000',
} as const;

export function isNoizTick(tick: string | undefined | null): boolean {
  return String(tick ?? '').trim().toUpperCase() === 'NOIZ';
}

/** Canonical compact deploy JSON (lowercase tick, no redundant `dec`). */
export function noizFlagshipDeployJson(): string {
  const json = buildTreatsDeployJson(NOIZ_FLAGSHIP.tick, NOIZ_FLAGSHIP.max, {
    premine: NOIZ_FLAGSHIP.premine,
    deployerWindow: NOIZ_FLAGSHIP.deployerWindow,
  });
  if (!json) throw new Error('NOIZ flagship deploy JSON failed to build');
  return json;
}
