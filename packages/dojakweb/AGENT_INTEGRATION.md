# Agent guide: working inside **Dojakweb** (`packages/dojakweb`, `@dojak/web`)

## Scope (read first)

- **`dojak`** is the open-source Dogecoin / Dogenals wallet monorepo ([github.com/jonheaven/dojak](https://github.com/jonheaven/dojak)).
- **Normative protocols** live in **[`dogenals/spec`](https://github.com/jonheaven/dogenals/tree/main/spec)** — locally **`../dogenals/spec`**. Put wire encoders in **`@dojak/core`** (`src/modules/dogenals/`), not a one-off in a host app.
- Matrix: **`dojak/docs/SPEC.md`**.

This file is for engineers wiring hosts (dogenals.com, dogecoin.games, …) or extending the extension/web stack.

---

## 1. Monorepo wiring

- **Inside `dojak`:** `@dojak/web` resolves via the **pnpm workspace** (`workspace:*`).
- **Day-to-day host apps:** rebuild wallet and let the host Vite alias to `packages/dojakweb/dist/wallet.js`.

```bash
pnpm --filter @dojak/web run build:wallet
```

- **Published embed (optional):** GitHub Package **`@jonheaven/dojak-web`**:

```json
{
  "dependencies": {
    "@dojak/web": "npm:@jonheaven/dojak-web@^2.0.1"
  }
}
```

```bash
pnpm --filter @dojak/web run publish:github
```

Or clone the public GitHub repo and `file:` / submodule.

---

## 2. Shell providers

- **`DojakWalletProvider`** (`@dojak/web/wallet`) — **preferred for embed hosts**: Dojak + MyDoge + SpookyDoge drawer. **Dogecoin L1 only.** Also exports spec encoders (Ðocial, Ðignal, ÐMP, Ð:WOW).
- **`DojakwebProvider`** — full stack (Treats, Dunes, Charms, Nostr, …).

### Embed import (host dApps)

```tsx
import { DojakWalletProvider, ConnectWalletButton, useUnifiedWallet } from '@dojak/web/wallet';
import '@dojak/web/wallet.css';
```

Build: `pnpm --filter @dojak/web run build:wallet` → `dist/wallet.js` (prebundled; host supplies React only).  
Full lib + wallet: `pnpm --filter @dojak/web run build:lib`.

---

## 3. CSS

```text
@dojak/web/dojakweb-host.css
```

---

## 4. Host sync, Ð𝕏, storage

Contracts (`DOJAKWEB_*` keys, `dojakweb-dx-v1`, `dojakweb_wallet_*` storage) stay stable for hosts.

---

## 5. Verify

- `pnpm --filter @dojak/web run build:lib` from monorepo root when you change `packages/dojakweb`.
- After protocol encoder changes, run `@dojak/core` tests that cover `dsocial.test.ts` vectors.
