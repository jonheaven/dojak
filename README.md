# Dojak Monorepo

Dojak is a `pnpm` monorepo for a shared Dogecoin wallet stack across:

- browser extension
- mobile (Android/iOS)
- marketing website (`dojak.app`)

## Workspace layout

- `apps/extension` - Chrome extension wallet
- `apps/mobile` - Expo React Native app (Android/iOS)
- `apps/web` - Next.js App Router marketing site
- `packages/core` - shared wallet/core logic
- `packages/ui` - shared wallet UI components
- `backend` - API server

## Prerequisites

- Node.js 20+
- pnpm 10+

## Initial setup

From repo root:

```bash
pnpm install
```

## Build and run by platform

Run all commands from the repo root.

### Extension (`apps/extension`)

Reliable development/watch:

```bash
pnpm --filter @dojak/extension exec gulp watch --env=dev --browser=chrome --manifest=mv3 --channel=github
```

Production build:

```bash
pnpm --filter @dojak/extension exec gulp build --env=pro --browser=chrome --manifest=mv3 --channel=github
```

Build output:

- unpacked extension: `apps/extension/dist/chrome`
- packaged zip: `apps/extension/dist/dojak-chrome-mv3-v<version>.zip`

### Mobile (`apps/mobile`)

Expo dev server:

```bash
pnpm --filter @dojak/mobile start
```

Open Android:

```bash
pnpm --filter @dojak/mobile android
```

Open iOS (macOS required):

```bash
pnpm --filter @dojak/mobile ios
```

EAS Android build:

```bash
pnpm --filter @dojak/mobile build
```

### Web marketing site (`apps/web`)

Local dev:

```bash
pnpm --filter web dev
```

Production build:

```bash
pnpm --filter web build
```

Run production build locally:

```bash
pnpm --filter web start
```

### Backend (`backend`)

Development:

```bash
pnpm --dir backend dev
```

Build:

```bash
pnpm --dir backend build
```

Start built server:

```bash
pnpm --dir backend start
```

## Monorepo utility commands

- run all dev tasks: `pnpm dev`
- run all build tasks: `pnpm build`
- run all lint tasks: `pnpm lint`
- run all typechecks: `pnpm typecheck`

## Deploy `apps/web` to Vercel (`dojak.app`)

1. Push repo to GitHub/GitLab/Bitbucket.
2. Import project in Vercel.
3. Set **Root Directory** to `apps/web`.
4. Set **Install Command** to:
   - `pnpm install --frozen-lockfile`
5. Set **Build Command** to:
   - `pnpm --filter web build`
6. Keep **Output Directory** as `.next`.
7. Add `dojak.app` (and optional `www.dojak.app`) in Vercel domains.
8. Configure DNS records at your registrar.

`apps/web/vercel.json` is already configured for the above commands.

## Troubleshooting

### `pnpm install` issues

- Confirm Node.js and pnpm versions match prerequisites (`node -v`, `pnpm -v`).
- Delete lockfile/install artifacts and reinstall if workspace links look broken:
  - `pnpm store prune`
  - remove `node_modules`
  - run `pnpm install`

### `ELIFECYCLE` during install on Windows (`postinstall`/`prepare`)

- If `pnpm install` resolves packages but fails during lifecycle scripts, check script shell config:
  - `pnpm config get script-shell`
- If it is set to `cmd.exe`, clear it and retry:
  - `pnpm config delete script-shell`
  - open a new terminal
  - `pnpm install`
- Temporary bypass if needed:
  - `pnpm install --ignore-scripts`
  - then run required scripts manually.

### `pnpm run <script>` opens a Windows prompt and hangs

- Use direct workspace exec commands instead of script wrappers:
  - extension build: `pnpm --filter @dojak/extension exec gulp build --env=pro --browser=chrome --manifest=mv3 --channel=github`
  - extension watch: `pnpm --filter @dojak/extension exec gulp watch --env=dev --browser=chrome --manifest=mv3 --channel=github`
  - web build: `pnpm --filter web exec next build`

### Extension build succeeds but not sure what to load in Chrome

- Load unpacked extension from:
  - `apps/extension/dist/chrome`
- Open `chrome://extensions`, enable Developer mode, click **Load unpacked**.

### Expo mobile commands fail

- Ensure Android Studio (Android) and Xcode (iOS/macOS) are installed and configured.
- If Metro cache issues appear:
  - `pnpm --filter @dojak/mobile exec expo start -c`

### Web build fails on Vercel

- Verify Vercel project settings:
  - Root Directory: `apps/web`
  - Install Command: `pnpm install --frozen-lockfile`
  - Build Command: `pnpm --filter web build`
  - Output Directory: `.next`
- Confirm repo lockfile is committed and up to date.

### Backend not included in root turbo build

- `backend` is not part of `apps/*` or `packages/*` workspace globs.
- Run backend explicitly:
  - `pnpm --dir backend dev`
  - `pnpm --dir backend build`
