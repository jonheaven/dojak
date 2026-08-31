# Dojakweb (`@dojak/web`)

Embeddable React wallet for Dogecoin / Dogenals. Open source (MIT) in the **[dojak](https://github.com/jonheaven/dojak)** monorepo.

Normative protocols: **[dogenals/spec](https://github.com/jonheaven/dogenals/tree/main/spec)**. This package encodes, signs, and displays; it is not an indexer.

Workspace `"private": true` blocks accidental npmjs publishes. Use the Git repo, pnpm workspace, or GitHub Package `@jonheaven/dojak-web`.

```tsx
import { DojakWalletProvider, ConnectWalletButton, encodeDsocialEngageLike } from '@dojak/web/wallet';
import '@dojak/web/wallet.css';
```

Spec matrix: [docs/SPEC.md](../../docs/SPEC.md).

## Development

From monorepo root:

```bash
pnpm --filter @dojak/web run build:lib
```

Internal host for UI iteration: sibling **dojakweb-demo** (optional).
