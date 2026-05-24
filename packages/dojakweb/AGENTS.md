# @dojak/web — agent guide (wallet UI/UX)

**Read this before editing wallet UI.** Wrong build commands waste 20+ minutes; wrong `autocomplete` values trigger Chrome “Save password?” on unlock/settings.

---

## What this package is

| Item | Location |
|------|----------|
| **Library** | `@dojak/web` — embeddable Dogecoin wallet (drawer/modal, assets, settings, ÐPFP, etc.) |
| **Main UI surface** | `src/components/DojakwebWalletModal.tsx` (large; search by step/tab before adding files) |
| **Drawer shell** | `src/components/WalletDrawer.tsx` → `mode="drawer"` |
| **Flyout menus** | `src/components/wallet/WalletMenuItems.tsx` — **always use for `Menu.Items`** inside the drawer (portal + anchor; avoids clipping) |
| **Wallet secrets (not site login)** | `src/lib/wallet-secret-input.ts` — **use for every unlock/password/PIN field** |
| **i18n (en/ja)** | `src/contexts/DojakwebLocaleContext.tsx` + `src/i18n/modal-*-flat.ts` (wallet copy); hosts may have their own site JSON |
| **Lib build config** | `vite.lib.config.ts` — **no obfuscation**; `minify: false`; deps external (~1s compile) |

Hosts: **`dogenals/web-net`**, **`dogenals/web-com`** consume **`dist/`** via `file:../.vendor-dojak/packages/dojakweb`.

---

## Edit here (dojak repo), not in host `node_modules`

- Canonical source: **`packages/dojakweb/src/`** in the **`dojak`** monorepo.
- **`dogenals/node_modules/@dojak/web`** is a copy or junction — changes there are overwritten by postinstall.
- After UI changes: rebuild **`dist`** (see below) and commit **dojak**; hosts pick up via vendor link or CI clone.

---

## Fast iteration (do not run full monorepo install every time)

### From this package (`packages/dojakweb/`)

```bash
# After first-time pnpm install at dojak monorepo root:
pnpm --filter @dojak/web run build:lib
```

Typical time: **~1–5 seconds** (154 TS modules). **Not** 20 minutes.

### From `dogenals/web-net/` (host preview)

| Command | Use when |
|---------|----------|
| **`npm run dev:wallet`** | **Default for wallet UI work** — Vite bundles `@dojak/web` **from source** (`DOJAKWEB_DEV_SOURCE=1`). No `build:lib` per tweak. Restart dev if needed. |
| **`npm run dojakweb:build`** | Sync **`dist`** → `node_modules` (~1s build + copy). Use before production build or if not using `dev:wallet`. |
| **`npm run dev`** | Site dev using prebuilt **`dist`** — run `dojakweb:build` after wallet edits. |

**Avoid:** `npm install` in `web-net` unless dependencies changed — postinstall can run **`pnpm install`** on the whole dojak monorepo (~3000 packages) when `dist/` or `.dogenals-build-lib` is missing.

**First-time only** (no `dojak/node_modules`):

```bash
cd ../../..   # dojak monorepo root
pnpm install --filter @dojak/web...
pnpm --filter @dojak/web run build:lib
```

Scripts use **`--filter @dojak/web...`**, not bare **`pnpm install`** at root, unless the monorepo has never been installed.

### What is *not* slow

- **`build:lib`** does **not** obfuscate and does **not** bundle `node_modules` into the lib — see `vite.lib.config.ts` `external`.
- Slowness was almost always **full monorepo `pnpm install`**, not Vite.

---

## UI/UX conventions

### Flyout / context menus (···)

Inside the scrollable drawer, **never** use raw:

```tsx
<Menu.Items className="absolute right-0 ..." />
```

Use **`WalletMenuItems`** so Headless UI **portals** above `overflow-hidden`:

```tsx
<WalletMenuItems anchor="bottom end" className="min-w-[12rem]">
  <Menu.Item>...</Menu.Item>
</WalletMenuItems>
```

### Password fields (browser must not treat wallet as website login)

Wallet encryption secrets ≠ user account passwords.

- Use **`walletSecretInputProps('dojakweb-unlock-secret')`** (unique `name` per field) on unlock / set password / reveal.
- Use **`walletCredentialInputProps('dojakweb-rpc-pass')`** for RPC/API keys in settings; prefer `type="text"` + `[webkit-text-security:disc]` for RPC pass, not `type="password"` next to “Username”.
- Wrap unlock/password steps in **`<form autoComplete="off">`**.
- **Do not** set `autoComplete="current-password"` or `autoComplete="new-password"` on wallet fields — Chrome will prompt to save.

### i18n

- Wallet strings: **`useDojakwebI18n()`** / `t('modal....')` — add keys to **`modal-en-flat.ts`** and **`modal-ja-flat.ts`**.
- Host↔wallet locale sync: **`dojakweb-preferred-locale`** in `localStorage` (`readPreferredLocale` / `writePreferredLocale` exports).

### Styling

- Drawer uses design tokens / zinc + gold (`#D4A017`) — match existing tabs/cards.
- Prefer small, focused diffs in **`DojakwebWalletModal.tsx`**; extract to `src/components/wallet/` when a pattern repeats (e.g. `WalletMenuItems`).

---

## Verify

```bash
pnpm --filter @dojak/web run build:lib
# optional: from web-net
npm run dojakweb:build && npm run build
```

Manual: open wallet → Assets → ··· on an inscription (menu fully visible); unlock/settings (no Chrome save-password prompt).

---

## Related docs (hosts)

- **`dogenals/web-com/docs/dojakweb-implementation.md`** — install pipeline, provider, CSS
- **`dogenals/web-net/README.md`** — site + `dev:wallet` / `dojakweb:build`
