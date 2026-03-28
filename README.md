# Dojak Monorepo

Dojak is organized as a `pnpm` monorepo for code sharing between browser extension, mobile apps, and the new dojak.app marketing website.

## Workspace layout

- `apps/extension` — Chrome extension app.
- `apps/mobile` — Expo React Native app for iOS/Android.
- `apps/web` — Next.js 15 App Router marketing site for `dojak.app`.
- `packages/core` — shared wallet/core logic (Dogecoin keyring, services, storage, types/utils).
- `packages/ui` — shared 402px mobile-first UI rendered by both extension and mobile.

## Commands

From repo root:

- `pnpm install`
- `pnpm --filter extension dev` (or `pnpm --filter @dojak/extension build` for Chrome build artifacts)
- `pnpm --filter mobile start` (Expo Go / dev client)
- `pnpm --filter mobile eas:build:android` (Google Play / EAS Android build)
- `pnpm --filter web dev` (run the Next.js marketing website locally)
- `pnpm --filter web build` (production build for dojak.app)

## Deploy `apps/web` to Vercel (dojak.app)

1. Push this monorepo to your Git provider (GitHub/GitLab/Bitbucket).
2. In Vercel, import the repo and set **Root Directory** to `apps/web`.
3. Build command: `pnpm build` (Vercel auto-detects Next.js).
4. Output directory: `.next` (default for Next.js).
5. Add production domain `dojak.app` and (optional) `www.dojak.app`.
6. Configure DNS records at your domain registrar per Vercel domain setup instructions.

## Design constraints

- Shared UI uses a 402px mobile-first container (`max-w-[402px] mx-auto`).
- Extension popup uses fixed width, scrollable body, and `max-height: 600px`.
- Safe-area insets are handled on native with `SafeAreaProvider` and on web via CSS `env(safe-area-inset-*)`.
