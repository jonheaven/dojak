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

## Wallet MVP status (Dogecoin)

The shared `@dojak/ui` `DojakWallet` now includes a functional MVP flow that renders in both the extension popup and the mobile app:

- **Home tab**: live balance from `WalletCoreContext`, USD estimate stub, quick send/receive shortcuts, and recent transactions.
- **Receive tab**: Dogecoin address display, large QR code, and copy action.
- **Send tab**: recipient + amount form with DOGE/USD toggle, fee preset/custom selector, preview panel, and send/confirm flow wired to core adapter methods.
- **Settings tab**: connected account display, seed phrase backup warning stub, logout, and app version.

Adapters in `apps/extension` and `apps/mobile` now provide address, transactions, validation, clipboard, and send handlers through `WalletCoreProvider` so the exact same shared wallet UI works in both surfaces.
