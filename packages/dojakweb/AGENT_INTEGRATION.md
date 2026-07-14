# Agent guide: working inside **Dojakweb** (`packages/dojakweb`, `@dojak/web`)

## Scope (read first)

- **`dojak`** (this monorepo) and **`packages/dojakweb`** (`@dojak/web`) are **proprietary** shared modules for **our** wallet and **other first-party dApps** that run on the open Dogenals standard—**private modular** reuse via workspace / `file:` links, **not** a public npm product or third-party distribution channel.
- **Everyone else (Dogenals ecosystem):** the **open** standard is **[`dogenals/spec`](https://github.com/jonheaven/dogenals/tree/main/spec)** on GitHub — locally **`../dogenals/spec`** beside `dojak/`. Public surfaces include **dogenals.com**, **dogenals.org**, **dogenals.net**. Do **not** point external builders at `packages/dojakweb` as if it were the normative source or a library to fork.

This file is for **agents and engineers already working inside the Dojak workspace** (e.g. wiring the internal demo or extending the extension/web stack).

---

## 1. Monorepo wiring (internal only)

- **Inside `dojak`:** `@dojak/web` resolves via the **pnpm workspace** (`workspace:*`).
- **Day-to-day host apps** (doge.cam beside this checkout): rebuild wallet and let the host Vite alias to `packages/dojakweb/dist/wallet.js`. **Do not publish on every WIP push.**

```bash
pnpm --filter @dojak/web run build:wallet
```

- **Production hosts** install the private GitHub Package **`@jonheaven/dojak-web`** (aliased as `@dojak/web`) when cutting a release:

```json
{
  "dependencies": {
    "@dojak/web": "npm:@jonheaven/dojak-web@^2.0.1"
  }
}
```

```bash
pnpm --filter @dojak/web run publish:github
# or tag: dojak-web-v2.0.1
```

Do **not** document a public npm install path. GitHub Packages is **restricted** to our org/user.

---

## 2. Shell providers (when touching the web module)

- **`DojakWalletProvider`** (`@dojak/web/wallet`) — **preferred for embed hosts** (drok, dogenals web-com, etc.): Dojak + MyDoge + SpookyDoge drawer without Charms/LiveActivity/DoginalDrawer stacks. **Dogecoin L1 only.**
- **`DojakwebProvider`** — full stack (legacy / inscribe-heavy apps). Use `@dojak/web` barrel only when you need Treats, Dunes, Charms, Nostr, etc.

### Embed import (host dApps)

```tsx
import { DojakWalletProvider, ConnectWalletButton, WalletDrawer, useUnifiedWallet } from '@dojak/web/wallet';
import '@dojak/web/wallet.css';
```

Build: `pnpm --filter @dojak/web run build:wallet` → `dist/wallet.js` (prebundled; host supplies React only).  
Full lib + wallet: `pnpm --filter @dojak/web run build:lib`.

---

## 3. CSS (first-party hosts only)

```text
@dojak/web/dojakweb-host.css
```

(Resolved via workspace when a first-party app depends on the package locally.)

---

## 4. Host sync, Ð𝕏 wire protocol, storage

Same technical contracts as before (`DOJAKWEB_*` keys, `dojakweb-dx-v1`, `dojakweb_wallet_*` storage)—documented in code and in the internal **dojakweb-demo** app. Keep names stable for **our** sites and builds only.

---

## 5. Verify

- `pnpm --filter @dojak/web run build:lib` from monorepo root when you change `packages/dojakweb`.
- Run **dojakweb-demo** smoke / build after cross-repo changes.
