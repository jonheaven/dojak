# Dojak Monorepo

Dojak is organized as a `pnpm` monorepo for code sharing between browser extension and mobile apps.

## Workspace layout

- `apps/extension` — Chrome extension app.
- `apps/mobile` — Expo React Native app for iOS/Android.
- `packages/core` — shared wallet/core logic (Dogecoin keyring, services, storage, types/utils).
- `packages/ui` — shared 402px mobile-first UI rendered by both extension and mobile.

## Commands

From repo root:

- `pnpm install`
- `pnpm --filter extension dev` (or `pnpm --filter @dojak/extension build` for Chrome build artifacts)
- `pnpm --filter mobile start` (Expo Go / dev client)
- `pnpm --filter mobile eas:build:android` (Google Play / EAS Android build)

## Design constraints

- Shared UI uses a 402px mobile-first container (`max-w-[402px] mx-auto`).
- Extension popup uses fixed width, scrollable body, and `max-height: 600px`.
- Safe-area insets are handled on native with `SafeAreaProvider` and on web via CSS `env(safe-area-inset-*)`.
