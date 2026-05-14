/**
 * Expo / React Native entry: web-safe exports plus native adapters and secure store.
 * Browser code should import from `@dojak/biometrics` only (no Expo peer deps).
 */
export * from './index';
export * from './platform/native';
export { createNativeSessionSecretStore } from './session/sessionSecretStore.native';
