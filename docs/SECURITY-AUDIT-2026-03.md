# Dojak Wallet Security & Architecture Audit (2026-03)

## Scope
- Browser extension codebase under `src/` and top-level build configuration.
- Focused review of key management, signing logic, provider trust model, and Dogecoin alignment.
- Preliminary mobile-portability review for future iOS/Android productization.

## Executive Summary
Dojak has already made a strong strategic move by replacing Bitcoin-hardcoded keyring behavior with a native Dogecoin keyring service. The highest-priority security issue identified in this audit was an embedded third-party API key and excessive key-management debug logging. Both have been remediated in this patch.

Overall risk snapshot:
- **Critical**: 0 open after remediation in this patch
- **High**: 2
- **Medium**: 5
- **Low**: 6

## Remediations Included In This Patch

### 1) Removed high-volume key-management debug logging
- Removed `console.log` traces across Dogecoin HD keyring + keyring service paths to reduce operational leakage (mnemonic flow timing, derivation internals, account/index behavior, and wallet lifecycle traces).
- This lowers risk from extension log exfiltration and reduces sensitive metadata disclosure in debug builds.

### 2) Removed hardcoded Tatum API key from source
- Replaced embedded testnet `x-api-key` value with runtime env lookup via `TATUM_API_KEY`.
- Added warning when the key is not configured.
- This removes a credential from source control and enables safer CI/CD secret handling.

## High-Priority Findings (Still Open)

### H-01: Strong cryptography, but KDF should be strengthened for wallet threat model
Current keyring encryption uses PBKDF2 (100k iterations) + AES-GCM. This is functional, but below modern wallet-hardening expectations in 2026. Recommended:
1. Move to Argon2id (preferred) or significantly increase PBKDF2 iterations with calibrated target latency.
2. Add migration logic for existing vault payloads.
3. Add explicit memory-hard KDF profile for mobile builds.

### H-02: Provider trust concentration and data integrity risks
Balances/UTXO/inscription metadata are provider-fed (Tatum/local RPC/Dojak API). Missing robust multi-provider consensus checks can create integrity exposure (stale/poisoned state, censorship, inconsistent history).

Recommended:
1. Add optional quorum verification for critical reads (UTXO set + tx details).
2. Canonicalize provider schemas and validate response invariants before acceptance.
3. Record provider provenance in UI state for forensic debugging.

## Medium Findings

1. **Terminology debt (`btc*` naming)** still appears in many state/contracts and can lead to semantic mistakes while adding features.
2. **Large service classes** (notably `walletapi.ts`) mix transport, provider orchestration, feature routing, and compatibility translation in one place.
3. **Direct extension API coupling** (e.g., direct `chrome.*` assumptions) increases friction for React Native / Capacitor / native bridge adoption.
4. **No reproducible security gate** in CI shown (dependency audit, lint/test matrix, typed API contract checks).
5. **Fallback behaviors** may mark providers healthy optimistically; this is practical, but should be observable and bounded.

## Dogecoin Alignment Review

### Good
- Native Dogecoin network constants and coin type handling are present.
- Dogecoin-specific keyring classes exist and are integrated as default service path.
- P2PKH-centric address flow aligns with prevailing Dogecoin usage.

### Needs Follow-Up
- Build a dedicated dogecoin-core-based integration test suite against regtest/testnet (address derivation vectors, WIF import/export, signed message verify, tx lifecycle).
- Standardize Dogecoin unit naming (`DOGE`, `koinu`) and remove lingering `btc` naming from user/domain models.

## Mobile Conversion Readiness (iOS/Android)

To maximize extension-to-mobile reuse and ship faster:
1. Introduce a `platform-core` boundary: storage, secure key handling, network, and background task interfaces.
2. Keep key derivation/signing in pure TS modules (already mostly true) and isolate browser APIs behind adapters.
3. Replace extension-specific state assumptions with app lifecycle-aware services (foreground/background lock policy, biometric unlock hooks).
4. Add React Native target package that consumes the same domain core and swaps adapter implementations.
5. Define one canonical RPC/provider client package shared by extension + mobile.

## Dependency & Build Modernization Backlog
- Lock ESLint major version with existing config style or migrate to flat config.
- Add Dependabot/Renovate with security-first update policy.
- Add SCA + semgrep + unit/integration test gates to CI.
- Pin Node/toolchain versions via `.nvmrc` + engine policy.

## Recommended 30-60-90 Day Plan

### 0-30 days
- Complete secret externalization (all API keys, DSNs, webhook secrets).
- Add CI security gates (lint, test, dep audit, static checks).
- Ship provider response validators + telemetry.

### 31-60 days
- KDF migration plan + implementation (Argon2id preferred).
- Refactor provider manager into composable modules.
- Start `platform-core` adapter layer and mobile bootstrap app.

### 61-90 days
- Dogecoin regtest integration harness.
- Security testing: fuzzing for tx/parsing paths, malicious provider simulation, extension permission hardening.
- External pentest + reproducible release process.

## Notes
This document is a codebase audit, not a cryptographic proof or formal verification report. A production go-live should include external security review and incident response runbooks.
