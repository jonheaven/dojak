/**
 * Prebuilt wallet embed — bundles doge-sdk, crypto, adapters; host supplies React only.
 */
import path from 'path';
import { defineConfig, esmExternalRequirePlugin, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function useSyncExternalStoreEsmShimPlugin(): Plugin {
  const withSelectorShim = path.resolve(__dirname, './src/shims/use-sync-external-store-with-selector-shim.ts');
  const baseShim = path.resolve(__dirname, './src/shims/use-sync-external-store-shim.ts');

  return {
    name: 'use-sync-external-store-esm-shim',
    enforce: 'pre',
    resolveId(id) {
      if (id.includes('use-sync-external-store') && id.includes('with-selector')) return withSelectorShim;
      if (id.startsWith('use-sync-external-store/shim')) return baseShim;
    },
  };
}

const reactExternals = new Set([
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
]);

export default defineConfig({
  plugins: [
    useSyncExternalStoreEsmShimPlugin(),
    esmExternalRequirePlugin({ external: [...reactExternals] }),
    react(),
  ],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      {
        find: '@dojak/core/wallet-web',
        replacement: path.resolve(__dirname, '../core/src/wallet-web/seedDerivation.ts'),
      },
      {
        find: '@dojak/biometrics',
        replacement: path.resolve(__dirname, '../biometrics/src/index.ts'),
      },
      { find: 'buffer', replacement: 'buffer' },
    ],
  },
  define: {
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  build: {
    emptyOutDir: false,
    outDir: 'dist',
    sourcemap: true,
    minify: true,
    // Bundle the Shiba paw PNG into wallet.js so hosts need no public/paw.png.
    assetsInlineLimit: 600_000,
    lib: {
      entry: path.resolve(__dirname, 'src/entries/wallet.ts'),
      name: 'DojakWallet',
      formats: ['es'],
      fileName: () => 'wallet.js',
    },
    rollupOptions: {
      external: (id) => reactExternals.has(id),
      output: {
        codeSplitting: false,
        inlineDynamicImports: true,
      },
    },
  },
});
