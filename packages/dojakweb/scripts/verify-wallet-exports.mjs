#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distWallet = path.join(pkgRoot, 'dist', 'wallet.js');

const REQUIRED = [
  'DojakWalletProvider',
  'DojakwebProvider',
  'ConnectWalletButton',
  'WalletDrawer',
  'useUnifiedWallet',
  'setWalletDataProviderConfig',
  'getIndexerApiBase',
  'requestWalletApproval',
  'openWalletDrawer',
];

if (!fs.existsSync(distWallet)) {
  console.error('[dojakweb] verify-wallet-exports: missing', distWallet);
  process.exit(1);
}

const src = fs.readFileSync(distWallet, 'utf8');
const missing = REQUIRED.filter((name) => !src.includes(name));
if (missing.length > 0) {
  console.error('[dojakweb] verify-wallet-exports: wallet.js missing symbols:', missing.join(', '));
  process.exit(1);
}

console.log('[dojakweb] verify-wallet-exports OK (' + REQUIRED.length + ' symbols)');
