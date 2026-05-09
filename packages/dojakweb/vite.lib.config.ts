import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Rolldown on Windows nests output under dist/src/; Linux emits dist/index.js + dist/lib/...
 * package.json expects the flat layout. After build, lift dist/src/* → dist/ when needed and
 * fix relative imports to dist/_virtual and dist/node_modules (one fewer ../).
 */
function flattenDistSrcPlugin(): Plugin {
  return {
    name: 'dojakweb-flatten-dist-src',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const nestedRoot = path.join(distDir, 'src');
      const nestedIndex = path.join(nestedRoot, 'index.js');
      if (!fs.existsSync(nestedIndex)) return;

      const entries = fs.readdirSync(nestedRoot, { withFileTypes: true });
      for (const e of entries) {
        const from = path.join(nestedRoot, e.name);
        const to = path.join(distDir, e.name);
        if (fs.existsSync(to)) {
          throw new Error(
            `[dojakweb] flatten-dist-src: cannot move ${from} → ${to} (destination exists)`
          );
        }
        fs.renameSync(from, to);
      }
      fs.rmSync(nestedRoot, { recursive: true });

      const shortenDistRootRelativeImports = (source: string) =>
        source.replace(
          /(["'])((?:\.\.\/)+)((?:_virtual\/|node_modules\/)[^"']+)\1/g,
          (full, quote: string, dots: string, rest: string) => {
            const n = (dots.match(/\.\.\//g) || []).length;
            if (n <= 1) return full;
            return `${quote}${'../'.repeat(n - 1)}${rest}${quote}`;
          }
        );

      const listJsFiles = (dir: string): string[] => {
        const out: string[] = [];
        if (!fs.existsSync(dir)) return out;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          if (e.name === 'node_modules' || e.name === '_virtual') continue;
          const p = path.join(dir, e.name);
          if (e.isDirectory()) out.push(...listJsFiles(p));
          else if (e.name.endsWith('.js')) out.push(p);
        }
        return out;
      };

      for (const file of listJsFiles(distDir)) {
        const before = fs.readFileSync(file, 'utf8');
        const after = shortenDistRootRelativeImports(before);
        if (after !== before) fs.writeFileSync(file, after, 'utf8');
      }

      console.log('[dojakweb] flattened dist/src → dist/ for package exports.');
    },
  };
}

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const externalPackages = [
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.peerDependencies ?? {}),
];

const isExternal = (id: string) => {
  return externalPackages.some((pkg) => id === pkg || id.startsWith(`${pkg}/`));
};

export default defineConfig({
  plugins: [react(), flattenDistSrcPlugin()],
  build: {
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Dojakweb',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: isExternal,
      treeshake: {
        moduleSideEffects: false,
      },
      output: {
        preserveModules: true,
        preserveModulesRoot: resolve(__dirname, 'src'),
        entryFileNames: '[name].js',
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/lib/**', 'src/contexts/**', 'src/providers/**'],
    },
  },
});
