import { BiometricAdapter } from '../../types';
import { DigitalPersonaAdapter } from './digitalPersonaAdapter';
import { WebAuthnAdapter } from './webauthnAdapter';

export function createWebAdapters(): BiometricAdapter[] {
  // Prefer WebAuthn first, then fallback to U.are.U local agent path.
  return [new WebAuthnAdapter(), new DigitalPersonaAdapter()];
}

export { WebAuthnAdapter, DigitalPersonaAdapter };
