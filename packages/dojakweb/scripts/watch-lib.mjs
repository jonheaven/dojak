#!/usr/bin/env node
/**
 * Watch @dojak/web dist for live hosts (dogenals launch stack).
 * Hosts import dist — never compile dojak src inside Vite.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cwd = path.resolve(here, '..');

function watch(config) {
  const child = spawn(
    'npx',
    ['vite', 'build', '--watch', '--config', config],
    { cwd, stdio: 'inherit', shell: true, env: process.env },
  );
  child.on('exit', (code) => {
    if (code) process.exit(code);
  });
}

console.log('[dojakweb] watch:lib — dist/index.js + dist/wallet.js');
watch('vite.lib.config.ts');
watch('vite.wallet.config.ts');
