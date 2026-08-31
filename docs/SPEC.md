# Dojak × Dogenals spec

Normative rules: **[dogenals/spec](https://github.com/jonheaven/dogenals/tree/main/spec)** (studio copy `../dogenals/spec`).

This wallet **encodes, signs, and displays**. It does **not** index. Chain truth is [dogex](https://github.com/jonheaven/dogex). Product APIs are [command.dog](https://github.com/jonheaven/command.dog).

Encoders: `packages/core/src/modules/dogenals/` — re-exported from `@dojak/web` and `@dojak/web/wallet`.

## Core Suite (ship first)

| Protocol | Marker | Wallet | Code |
| --- | --- | --- | --- |
| **Ðunes** | `0xD0` | Encode etch/mint/edicts; protect dune UTXOs | `packages/dojakweb/src/lib/dunestone.ts` |
| **ÐogeTreats** | `p:"dt"` | Encode deploy/mint/transfer/burn OP_RETURN | `packages/dojakweb/src/lib/treats/` |
| **ÐMP** | `p:"Ð:MP"` | Spec envelope + PSDT listing/buy | `modules/dogenals/dmp.ts` · `services/dmp.ts` · `doginal-psdt.ts` |
| **Ðocial** | `Ð:SOC` | 30-byte binary engage/follow + post JSON | `modules/dogenals/dsocial.ts` (vectors SOC-OR-001…003) |
| **Ðignal** | `Ð:DIG` | 50-byte binary signal + encrypted inscription JSON | `modules/dogenals/dignal.ts` |
| **ÐLotto** | `p:"Ð:LOTTO"` | Detect/hold tickets; mint on dogecoin.games | `modules/dogenals/dlotto.ts` |
| **ÐSwap Core / DXD** | `dxd` | Sign/broadcast storefront swaps | hosts + tx journal |

## Identity & names

| Protocol | Marker | Wallet |
| --- | --- | --- |
| **Ð𝕏** | compact `DX` | Extension tip/bind · `packages/core/src/dx/` · `dojakweb/src/lib/dx/` |
| **DNS** | `p:"dns"` | Register `.doge` · `dnsPublish.ts` |
| **ÐN05** | `Ð:N05` / `N05` | NIP-05 bind · `dn05.ts` |
| **ÐPFP / ÐPFA** | `Ð:PFP` / `Ð:PFA` | Profile binds · `dpfpPublish.ts` |

## Also implemented

| Protocol | Notes |
| --- | --- |
| **DOTC** | `dotc\|1\|…` OP_RETURN · `lib/dotc.ts` |
| **Ðclaims** | `p:"dclaims"` · `lib/dclaims/` |
| **Ð:WOW** | Guestbook JSON · `modules/dogenals/wow.ts` |
| **ÐLaunch** | Ðunes `0x03` curve tags in dunestone |
| **ÐLocker** | BIP65 CLTV product · `cltv-tools.ts` |
| **BurneÐ** | Valued `OP_RETURN` carrier burn · `incinerator-tools.ts` |
| **Charms / Ðalkanes / ÐWatch** | Labs surfaces in `@dojak/web` |
| **DRC-20** | Legacy read-only. No new deploys. |

## Deferred (do not ship as production)

ÐAMM, ÐLend, full ÐSwap (ve/orderbook). Wallets SHOULD NOT surface these until Phase 2.

## Rules

- One social marker: **Ð:SOC**. Do not also emit `Ð:P` / ÐEcho on the same action.
- Ðignal magic is **`Ð:DIG`**, not the old Era-2 `Ð:W` line.
- ÐMP `p` is **`Ð:MP`**. Price is a **string** of koinu. PSDT is the fill contract.
- Inscriptions on Dogecoin: **P2SH commit → reveal** (Core rejects push-only `OP_IF` in `scriptSig`).
- Broadcast: **command.dog `POST /v1/tx/broadcast`** → Core.

See `DOGENALS_PROTOCOLS` in `packages/core/src/modules/dogenals/protocols.ts` for the machine-readable table.
