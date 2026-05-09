#!/usr/bin/env node

/**
 * Extension postinstall: run patch-package only when a patches/ directory
 * contains .patch files (monorepo root and/or this app). No-op otherwise.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const extRoot = path.resolve(__dirname, '..');
const monoRoot = path.resolve(__dirname, '..', '..', '..');

function hasPatchFiles(patchesDir) {
  try {
    if (!fs.existsSync(patchesDir) || !fs.statSync(patchesDir).isDirectory()) return false;
    return fs.readdirSync(patchesDir).some((n) => n.endsWith('.patch'));
  } catch {
    return false;
  }
}

function patchPackageEntryFor(cwd) {
  try {
    const pkgJson = require.resolve('patch-package/package.json', { paths: [cwd] });
    return path.join(path.dirname(pkgJson), 'index.js');
  } catch {
    return null;
  }
}

function applyPatches(cwd) {
  const entry = patchPackageEntryFor(cwd);
  if (!entry || !fs.existsSync(entry)) {
    console.warn('[run-patch-package-if-needed] patch-package not found; cwd=', cwd);
    return;
  }
  execSync(`"${process.execPath}" "${entry}"`, { cwd, stdio: 'inherit' });
}

const targets = [];
if (hasPatchFiles(path.join(monoRoot, 'patches'))) targets.push(monoRoot);
if (hasPatchFiles(path.join(extRoot, 'patches'))) targets.push(extRoot);

for (const cwd of targets) {
  console.log('[run-patch-package-if-needed] applying patches in', cwd);
  applyPatches(cwd);
}
