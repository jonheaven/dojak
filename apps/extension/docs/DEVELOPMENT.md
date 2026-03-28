# Development Handbook

This project is a forked browser-extension wallet tailored for Dogecoin Doginals. Use this guide as a quick reference for bootstrapping a development environment, validating Dogecoin-specific behavior, and scanning for cruft that can be safely removed.

## Environment setup

- **Node/npm:** Use the active LTS version of Node. The toolchain relies on npm scripts; yarn is available via the lockfile but npm is the default.
- **Install dependencies:** `npm ci` installs the exact versions locked in `package-lock.json`. The repo uses `patch-package`, so post-install patching happens automatically.
- **Editor setup:** Enable TypeScript, ESLint, and Prettier integration in your editor for on-save feedback. The `src/` directory is the lint/format scope.

## Day-to-day workflow

1. **Fast rebuilds:** `npm run dev` starts webpack in watch mode for the Chrome MV3 target.
2. **Production bundles:** `npm run build:chrome` (or other browser-specific build scripts) emits artifacts under `dist/` via `gulp`.
3. **Lint/format:** `npm run lint` applies ESLint fixes and prettifies supported sources.
4. **Load locally:** Follow `npm run load:extension` for a quick reminder on loading unpacked builds in Chrome.

## Dogecoin parameters: sanity checks

Dogecoin network constants live in `src/shared/lib/dogecoin-network.ts`. When reviewing upstream changes or bumping dependencies, validate that:

- `dogecoinMainnet` and `dogecoinTestnet` prefixes match Dogecoin Core (message prefix, HRP, BIP32 versions, P2PKH/P2SH prefixes, and WIF).
- `getDogecoinHDPath` returns the BIP44 path with coin type `3`.
- The accompanying test `src/shared/lib/dogecoin-network.test.ts` still derives a mainnet P2PKH address starting with `D` from the pinned WIF.

Run targeted tests when altering crypto plumbing:

```bash
npm test -- src/shared/lib/dogecoin-network.test.ts
```

## Hunting unused or stale code

The codebase is feature-rich, so measuring unused surface area helps keep bundle size down. Two opt-in analyzers are available:

- **Dependencies:** `npm run analyze:deps` (via `depcheck`) reports packages that appear unused or missing. Review findings manually; dynamic imports and build-only usage can show as false positives.
- **Exports:** `npm run analyze:exports` (via `ts-prune`) lists TypeScript exports that are not imported anywhere. Cross-check UI routes and background scripts before removing flagged symbols.

These commands do not mutate sources; they only emit JSON/text reports to guide clean-up discussions.

## Testing checklist before release

- Lint + format (`npm run lint`).
- Dogecoin network regression test (`npm test -- src/shared/lib/dogecoin-network.test.ts`).
- Browser-specific build for the target store (e.g., `npm run build:chrome`).
- Manual smoke test: account creation/import, Doginals send/receive, Dunes/DRC-20 flows, hardware-wallet paths.

Keeping this checklist current makes the repository easier to onboard and audit.
