# Dojakweb (`@dojak/web`)

**Proprietary — first-party modular use only.** Browser-facing wallet UI, providers, and Dogenals-related web flows shared across **our** proprietary dApps (extension, web, demos, and other internal hosts), all speaking the **open** Dogenals standard on-chain. Lives as a **private** workspace package in the **`dojak`** monorepo (`"private": true`); **not** on the public npm registry and **not** for external teams to depend on.

**Public standard:** clone **[dogenals](https://github.com/jonheaven/dogenals)** and work from **`spec/`** (sibling path **`../dogenals/spec`** next to `dojak/` under `dogeco`). Sites **dogenals.com** / **dogenals.org** / **dogenals.net** explain and teach that corpus—**not** this package.

Third-party wallets and apps should implement the **open spec** and their **own** code—not redistribute Dojakweb.

## Development

From monorepo root:

```bash
pnpm --filter @dojak/web run build:lib
```

Internal integration testing uses **[dojakweb-demo](https://github.com/jonheaven/dojakweb-demo)** (sibling clone beside this repo).
