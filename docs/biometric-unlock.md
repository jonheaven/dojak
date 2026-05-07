# Biometric Unlock Architecture

## Scope

Biometric unlock is implemented as a convenience gate for session unlock only.
The seed phrase recovery model remains unchanged and is always the primary recovery path.

## Security model

- Biometric data is never stored or transmitted by the wallet.
- Biometric verification is delegated to platform authenticators:
  - WebAuthn / Windows Hello / platform passkeys for extension
  - Digital Persona U.are.U local agent path for supported desktop setups
  - iOS/Android LocalAuthentication for mobile
- Existing decrypt flow remains password-based (`wallet.unlock(password)`).
- Decrypted key material is kept in memory for active sessions only and cleared on manual lock, app background, or timeout.
- Failed biometric attempts are rate-limited and force password fallback when locked out.
- WebAuthn prompts must be triggered from extension UI context (popup/content surface), not background-only execution.

## Components

- `packages/biometrics/src/facade.ts`
  - Unified orchestration layer
  - Adapter selection + shared error handling
  - Rate-limit integration
- `packages/biometrics/src/platform/web`
  - `WebAuthnAdapter` for platform authenticators
  - `DigitalPersonaAdapter` for U.are.U SDK/WebSocket agent detection
- `packages/biometrics/src/platform/native`
  - `ExpoLocalAuthAdapter` for iOS/Android biometrics
- `packages/biometrics/src/session`
  - Session secret store abstractions for web/native

## UX behavior

- Users can unlock with biometric CTA when enabled.
- Password/PIN fallback is always present.
- Biometric setup is opt-in and requires successful password unlock first.
