# Security Policy

Dojak is a self-custodial wallet. Issues that can steal keys, drain UTXOs, or spend inscription carriers without consent are in scope.

## Reporting

Do not file a public GitHub issue with exploit details.

1. Open a **minimal** private report to the steward: **[jonheaven](https://github.com/jonheaven)** / [**@jontype**](https://x.com/jontype).
2. Include affected package (`@dojak/core`, `@dojak/web`, extension, mobile), impact, and a reproduction that does **not** include real seeds.

If the issue is a Dogenals **spec** ambiguity (indexers disagree), report it on [jonheaven/dogenals](https://github.com/jonheaven/dogenals) instead.

## Scope

In scope:

- Seed / WIF / mnemonic leakage
- Signing prompts that hide fee, recipient, or inscription movement
- Coin selection that spends protocol-bearing UTXOs by default
- Incorrect protocol envelopes that can lock or burn user assets
- XSS / extension origin confusion that reaches the vault

Out of scope:

- Phishing sites that look like Dojak
- User-chosen weak passwords
- Third-party indexers unless Dojak blindly trusts them for spends

## Practice

- Keys stay on-device. Dojak does not escrow seeds.
- Default coin selection excludes inscription / Ðune-bearing outs.
- Broadcast via command.dog → Dogecoin Core only.
