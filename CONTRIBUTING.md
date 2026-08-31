# Contributing to Dojak

Dojak is the open-source Dogecoin / Dogenals wallet. Protocol rules live in **[dogenals/spec](https://github.com/jonheaven/dogenals/tree/main/spec)** — this repo implements them.

## Before you change a protocol

1. Read the relevant `spec.md` (MUST/SHOULD/MAY).
2. Put wire encoders in `packages/core/src/modules/dogenals/` so the extension and `@dojak/web` share one encoder.
3. Update [docs/SPEC.md](docs/SPEC.md) in the same PR.
4. Do not invent a second marker “for compatibility.” Greenfield: one envelope.

Dogecoin inscriptions use **P2SH commit → reveal**. Do not add single-tx P2PKH `OP_IF` envelopes.

Broadcast goes **command.dog → Core**, not public `/push` relays.

## PRs

- One logical change per PR.
- Do not commit `.env`, keys, or `backend/.env`.
- Brand name and logo stay reserved (LICENSE); code is MIT.

## Security

See [SECURITY.md](SECURITY.md).
