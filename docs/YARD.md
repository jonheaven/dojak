# Dojak × YARD (lab)

YARD is **not** a Dogenals / Doginal protocol. It is a separate client-validated
note system: [jonheaven/yard](https://github.com/jonheaven/yard).

Shibe-facing UI ships on **[dogecoin.dog/yard](https://dogecoin.dog/yard)**
(`dogenals/web-com`). This wallet adds the signing / UTXO-protection slice.

## vs Doginals (one paragraph)

Doginals put content on-chain (inscription id, indexer rediscovery). YARD puts
only a ~40-byte `YARD` fingerprint in OP_RETURN and keeps the note history in a
`.yard` consignment sealed to one UTXO. Spending that UTXO as plain DOGE kills
the note. Do **not** show YARD notes in Doginal collection UIs.

## Lab milestones (ship in order)

1. **Protect** — mark seal UTXOs do-not-spend in ordinary sends / max.
2. **Verify** — import `.yard`, check signatures + commitment root shape; ask
   Dogecoin (electrs / Core via command.dog) whether the seal is unspent.
3. **Tip** — build transfer: spend seal, open new seal, attach YARD OP_RETURN,
   export consignment for the receiver (needs their compressed pubkey).
4. **Burn** — spend seal with no new note (Burn a Wow vote).
5. Later: genesis / launch-buy (can stay `yard-cli` for drop #1).

## Code

- Commitment encode/decode (v1, 40 bytes): `packages/core/src/yard/`
- Spec mirror: yard repo `YARD.md` §6.1; gameplan `GAMEPLAN.md`
- Public face: `dogenals/web-com` routes `/yard`, `/yard/burn`

## Non-goals

No YARD token. No bridge. No treating dogex as source of truth for balances.
dogex may later catalog fingerprints for a wall — verification stays
consignment + chain.
