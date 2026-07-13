/**
 * Library bundle for npm / `file:../dojakweb` consumers (e.g. dogex.store on Vercel).
 * App demo build uses vite.config.ts → demo-dist/
 */
import path from 'path';
import { defineConfig, esmExternalRequirePlugin, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import dts from 'vite-plugin-dts';

/**
 * Redirect CJS-only use-sync-external-store shims to our ESM equivalents.
 * Rolldown cannot handle their `require('react')` inside factory functions — they
 * ship CJS-only with no ESM exports, and the require is not a static top-level
 * call that esmExternalRequirePlugin can hoist.
 */
function useSyncExternalStoreEsmShimPlugin(): Plugin {
  const withSelectorShim = path.resolve(__dirname, './src/shims/use-sync-external-store-with-selector-shim.ts');
  const baseShim = path.resolve(__dirname, './src/shims/use-sync-external-store-shim.ts');

  return {
    name: 'use-sync-external-store-esm-shim',
    enforce: 'pre',
    resolveId(id) {
      // Covers: with-selector, shim/with-selector, with-selector.js, shim/with-selector.js
      if (id.includes('use-sync-external-store') && id.includes('with-selector')) return withSelectorShim;
      // Covers: shim, shim/index, shim.js, shim/index.js (but not with-selector)
      if (id.startsWith('use-sync-external-store/shim')) return baseShim;
    },
  };
}

export default defineConfig({
  plugins: [
    useSyncExternalStoreEsmShimPlugin(),
    // Vite 8 / Rolldown: convert preserved require() of externals to ESM imports.
    esmExternalRequirePlugin({
      external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    }),
    react(),
    tailwindcss(),
    dts({
      insertTypesEntry: true,
      // Avoid @microsoft/api-extractor rollup on CI: Linux + filtered pnpm installs can leave
      // incomplete graphs that make `getResolvedModule("./types/wallet")` fail during rollup.
      // Emit declaration files next to chunks; package "types" still points at dist/index.d.ts.
      rollupTypes: false,
      tsconfigPath: './tsconfig.json',
    }),
  ],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
  define: {
    global: 'globalThis',
    process: {
      env: {},
    },
  },
  build: {
    emptyOutDir: true,
    outDir: 'dist',
    sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'Dojakweb',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: (id) =>
        id === 'react' ||
        id === 'react-dom' ||
        id === 'react/jsx-runtime' ||
        id === 'react/jsx-dev-runtime' ||
        id === '@dojak/core' ||
        id.startsWith('@dojak/core/'),
    },
  },
});
