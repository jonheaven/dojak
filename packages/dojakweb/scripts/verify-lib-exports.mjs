#!/usr/bin/env node
/**
 * Fail `build:lib` when Rolldown omits named exports that `src/index.ts` re-exports.
 * Catches stale or broken dist before dogenals postinstall copies it into apps.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distIndex = path.join(pkgRoot, 'dist', 'index.js');

/** Critical surface for dogenals.com / web-net — extend when apps import new symbols. */
const REQUIRED_EXPORTS = [
  'DojakwebProvider',
  'ConnectWalletButton',
  'WalletDrawer',
  'DojakwebWalletModal',
  'useUnifiedWallet',
  'setWalletDataProviderConfig',
  'requestWalletApproval',
  'openWalletDrawer',
  'isWalletApprovalCancelled',
  'WalletApprovalCancelledError',
  'normalizeDxXHandle',
  'isInscribeJobsClientConfigured',
  'createInscribeJob',
  'uploadInscribeJobItemContent',
  'runInscribeJob',
  'getInscribeJob',
  'AlkanesToolsPanel',
  'buildDummyUtxoPSDT',
  'DUMMY_UTXO_VALUE',
  'getAddressUtxos',
  'selectUtxos',
  'broadcastTx',
  'coerceSignedPsdtToRawTxHex',
  'preparePsdtForMyDogeSign',
  'journalDlockerTx',
  'gatedMydogeGetJson',
  'invalidateMydogeUtxoCaches',
  'filterPaymentSpendableUtxos',
  'MydogeHttpError',
  'DogeTxLink',
  'dogeTxExplorerUrl',
  'DN05_DOMAIN',
  'DN05_MARKER',
  'publishDn05OnChain',
];

if (!fs.existsSync(distIndex)) {
  console.error('[dojakweb] verify-lib-exports: missing', distIndex);
  process.exit(1);
}

const src = fs.readFileSync(distIndex, 'utf8');
const exportMatch = src.match(/export\s*\{([^}]+)\}\s*;/);
if (!exportMatch) {
  console.error('[dojakweb] verify-lib-exports: no export { … } block in dist/index.js');
  process.exit(1);
}

const exported = new Set(
  exportMatch[1]
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
);

const missing = REQUIRED_EXPORTS.filter((name) => !exported.has(name));
if (missing.length > 0) {
  console.error('[dojakweb] verify-lib-exports: build:lib is missing named exports:', missing.join(', '));
  process.exit(1);
}

console.log('[dojakweb] verify-lib-exports OK (' + REQUIRED_EXPORTS.length + ' symbols)');
