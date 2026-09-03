# Ðclaims wallet integration (dojakweb)

## Helpers

```ts
import {
  createDclaimDeploy,
  createDclaim,
  buildDeployPayload,
  buildClaimPayload,
  quoteDclaimMint,
  protocolFeeAmount,
} from '@dojak/web/lib/dclaims'; // or relative path in monorepo
```

| Helper | Role |
|--------|------|
| `createDclaimDeploy` | Inscribe deploy with parent tag + `metaprotocol: dclaims` |
| `createDclaim` | Inscribe claim + optional same-tx fee outputs |
| `quoteDclaimMint` | Compute creator + protocol fee totals |

## Envelope requirements

dogex indexes parents from **tag 3** (36-byte inscription id). When `parents` or `metaprotocol` is set, `signInscriptionTxs` builds a tagged envelope:

- tag 1 — content type (`application/json`)
- tag 3 — parent canvas id bytes
- tag 7 — `dclaims`
- empty push — body separator
- body — JSON payload

## Fees on claim

Pass fee info into `createDclaim` so the **reveal** tx pays:

1. `creator_address` ≥ `mint_price` (from deploy)
2. protocol operator ≥ `protocol_fee` (from `GET /api/dclaims/config` + deploy bps)

Uses existing `extraRevealPayments` path (same as ÐLaunch buys).

## Host apps (dogenals.com)

1. `/dclaims/deploy` lists wallet inscriptions via Dojakweb `walletDataApi` (fallback dogex `/api/doginals/address/:addr/inscriptions`).
2. User picks parent → visual grid preview → **Sign & broadcast** (`createDclaimDeploy` + command.dog → Core) when local browser wallet is unlocked.
3. Extension / no WIF → `POST command.dog /v1/dclaims/prepare` for payload + fee plan.
4. `/dclaims/:parent` map loads parent image + `/api/dclaims/parent/:id/claims`. Flagship: `/pwn-the-doge`.
5. Selection → `createDclaim` / `signInscriptionTxs` + same-tx fee outputs + broadcast.

**Broadcast:** dogenals `broadcastRawTx` prefers dogex `/api/tx/broadcast`, falls back to command.dog `/v1/tx/broadcast`.

## Spec

- [dclaims.md](https://github.com/jonheaven/dogenals/blob/main/spec/dclaims.md)
- dogex: `docs/dclaims-integration.md`
