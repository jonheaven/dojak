# Dojak Monorepo

Dojak is organized as a `pnpm` monorepo for code sharing between browser extension, mobile apps, and the `dojak.app` marketing website.

## Workspace layout

- `apps/extension` — Chrome extension app.
- `apps/mobile` — Expo React Native app for Android/iOS.
- `apps/web` — Next.js 15+ App Router marketing site for `dojak.app`.
- `packages/core` — shared wallet/core logic (Dogecoin keyring, services, storage, types/utils).
- `packages/ui` — shared 402 px mobile-first UI rendered by both extension and mobile.

## Commands

From repo root:

- `pnpm install`
- `pnpm --filter extension dev`
- `pnpm --filter mobile start`
- `pnpm --filter web dev`
- `pnpm --filter web build`
- `pnpm --filter web start`

## Deploy `apps/web` to Vercel (`dojak.app`)

1. Push the monorepo to GitHub/GitLab/Bitbucket.
2. Import the repo in Vercel.
3. Set **Root Directory** to `apps/web`.
4. Use **Install Command**: `pnpm install --frozen-lockfile`.
5. Use **Build Command**: `pnpm --filter web build`.
6. Keep **Output Directory** as `.next` (default Next.js output).
7. Add production domain `dojak.app` (and optional `www.dojak.app`) in Vercel project domains.
8. Configure DNS records with your registrar using Vercel’s provided records.

## Product baseline

- Shared wallet UI is designed around a 402 px mobile-first viewport.
- Marketing site mirrors this message: one consistent Dojak experience across extension + Android + iOS.
- Wallet MVP includes Home / Receive / Send / Settings with self-custodial DOGE flow.
