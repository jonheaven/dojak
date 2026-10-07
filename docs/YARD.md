# Dojak × YARD (lab)

YARD is **not** a Dogenals / Doginal protocol. It is a separate client-validated
note system: [jonheaven/yard](https://github.com/jonheaven/yard).

Shibe-facing UI ships on **[dogecoin.dog/yard](https://dogecoin.dog/yard)**
(`dogenals/web-com`). This wallet owns the signing / UTXO-protection slice.

## vs Doginals

Doginals put content on-chain. YARD puts only a ~40-byte `YARD` fingerprint in
OP_RETURN and keeps history in a `.yard` consignment sealed to one UTXO.
Spending that UTXO as plain DOGE kills the note. Do **not** show YARD notes in
Doginal collection UIs.

## Lab status

| Step | Status | Code |
| --- | --- | --- |
| Protect seal UTXOs | **done** | `lib/yard/seals.ts` → `lockUtxo` |
| Verify `.yard` | **done** | `decodeConsignmentAny` + `summarizeConsignment` |
| Tip (transfer) | **done** (full-note) | `signAndBroadcastYardTip` |
| Burn | **done** (full-note) | `signAndBroadcastYardBurn` |
| UI panel | **done** | `YardLabPanel` → dogecoin.dog `/yard`, `/yard/burn` |
| Partial tip/burn | later | — |
| Genesis / launch-buy | CLI for drop #1 | `yard-cli` |

## Usage

```ts
import { YardLabPanel, decodeConsignmentAny, protectOpenNotes } from '@dojak/web';
```

Connect the **local browser wallet**, import a consignment from `yard-cli`,
**Protect seals**, then **Tip** (needs receiver compressed pubkey hex) or **Burn**.

## Non-goals

No YARD token. No bridge. dogex is never the source of truth for note balances.
