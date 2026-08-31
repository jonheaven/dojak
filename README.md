# Dojak Wallet

**MIT-licensed** Dogecoin wallet: browser extension, mobile (Expo), shared crypto core, and **`@dojak/web`** (embeddable React wallet). Marketing site: [dojak.app](https://dojak.app).

**Source:** [github.com/jonheaven/dojak](https://github.com/jonheaven/dojak)

Dojak implements the **[Dogenals](https://github.com/jonheaven/dogenals)** protocol specs (`spec/` — locally `../dogenals/spec`). The spec is the rulebook; this repo is a reference wallet. Indexing stays in [dogex](https://github.com/jonheaven/dogex). Broadcast is [command.dog](https://github.com/jonheaven/command.dog) → Dogecoin Core.

Brand name and logo remain reserved (see [LICENSE](LICENSE)). Code is MIT.

## Spec coverage

See **[docs/SPEC.md](docs/SPEC.md)** for the protocol matrix (Ðunes, Treats, ÐMP, Ðocial, Ðignal, ÐLotto, Ð𝕏, DNS, …). Encoders live in `@dojak/core` (`src/modules/dogenals/`) and are re-exported from `@dojak/web`.

## Architecture

| Layer | Role |
| --- | --- |
| **Apps** | Extension, mobile, marketing site (`dojak.app`) |
| **Packages** | `@dojak/core`, `@dojak/web`, `@dojak/ui`, `@dojak/biometrics` |
| **Backend** | Optional API (`backend/`), outside the default Turbo graph |

Workspace packages stay `"private": true` so they are not published to npmjs by accident. Consume via this Git repo / pnpm workspace. Optional GitHub Package: `@jonheaven/dojak-web`.

## Workspace layout

- `apps/extension` — Chrome extension wallet
- `apps/mobile` — Expo React Native (Android/iOS)
- `apps/web` — Next.js marketing site (`dojak.app`)
- `packages/core` — shared wallet / Dogenals encoders (`@dojak/core`)
- `packages/ui` — shared wallet UI (`@dojak/ui`)
- `packages/biometrics` — biometric unlock (`@dojak/biometrics`)
- `packages/dojakweb` — **`@dojak/web`** embeddable browser wallet
- `backend` — API server (not in default `turbo` workspaces)

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

On **x.com** / **twitter.com** the extension injects a Dogecoin tip button on posts and a Ð𝕏 chip on profiles. Clicks open the popped-out wallet: pay a linked handle (dogex `/api/dx` + command.dog `/v1/dx/resolve`) or bind your profile fully in-extension (tweet proof via `/v1/dx/verify-tweet`, compact DX OP_RETURN, broadcast `POST /v1/tx/broadcast`).

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

### `@dojak/web` library

```bash
pnpm --filter @dojak/web run build:lib
```

Host apps import `DojakWalletProvider` from `@dojak/web/wallet`. Spec encoders (`encodeDsocialEngageLike`, `encodeDignalSignal`, `buildDmpListEnvelope`, …) are on both `@dojak/web` and `@dojak/web/wallet`.

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

1. Push repo to GitHub.
2. Import project in Vercel.
3. Set **Root Directory** to `apps/web`.
4. Set **Install Command** to `pnpm install --frozen-lockfile`.
5. Set **Build Command** to `pnpm --filter web build`.
6. Keep **Output Directory** as `.next`.
7. Add `dojak.app` (and optional `www.dojak.app`) in Vercel domains.

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

## License

[MIT](LICENSE) — brand name and logo reserved.
