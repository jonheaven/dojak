# Dojak Monorepo

Dojak is now organized as a `pnpm` monorepo for maximum code sharing between browser extension and upcoming mobile apps.

## Workspace layout

- `apps/extension` — Chrome extension app (existing Dojak extension codebase relocated).
- `apps/mobile` — Expo React Native app scaffold for iOS/Android.
- `packages/core` — shared wallet/core logic (background, storage, keyring, Dogecoin logic, shared types/utils).
- `packages/ui` — shared UI/components/screens used by extension and mobile.

## Commands

From repo root:

- `pnpm install`
- `pnpm dev` (runs workspace dev tasks through Turbo)
- `pnpm --filter @dojak/extension dev` (extension watch/build flow)
- `pnpm --filter @dojak/mobile dev` (Expo dev server)

## Design constraints

- UI is standardized around a 402px mobile-first container.
- Extension popup uses fixed width and scrollable max-height.
- Safe-area insets are supported for iOS notch/dynamic island.
