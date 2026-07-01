import { defineConfig } from 'vite';
import { resolve } from 'path';

/** Compiled @dojak/core/wallet-web for npm consumers (no raw .ts). */
export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/wallet-web/seedDerivation.ts'),
      formats: ['es'],
      fileName: 'wallet-web',
    },
    rollupOptions: {
      external: ['@scure/bip32', '@scure/bip39', 'viem', 'viem/accounts'],
    },
  },
});
