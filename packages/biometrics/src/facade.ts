import { BiometricRateLimiter } from './rateLimiter';
import { BiometricAdapter, BiometricAuthResult, BiometricFacade, BiometricMethod, SessionSecretStore } from './types';

function defaultFailure(method: BiometricMethod): BiometricAuthResult {
  return { ok: false, method, errorCode: 'biometric/not-available', errorMessage: 'No biometric adapter available' };
}

export function createBiometricFacade(adapters: BiometricAdapter[], secretStore: SessionSecretStore): BiometricFacade {
  const rateLimiter = new BiometricRateLimiter();

  const pickFirstAvailable = async () => {
    for (const adapter of adapters) {
      const availability = await adapter.isBiometricAvailable();
      if (availability.available) return { adapter, availability };
    }
    return null;
  };

  return {
    async isBiometricAvailable() {
      const picked = await pickFirstAvailable();
      if (!picked) return { available: false, method: 'unknown' as const, reason: 'No biometric adapter available' };
      return picked.availability;
    },

    async authenticateWithBiometric(reason) {
      const picked = await pickFirstAvailable();
      if (!picked) return defaultFailure('unknown');
      const rateLimitKey = picked.adapter.getMethod();

      if (rateLimiter.isLocked(rateLimitKey)) {
        const remaining = Math.ceil(rateLimiter.getRemainingLockMs(rateLimitKey) / 1000);
        return {
          ok: false,
          method: rateLimitKey,
          errorCode: 'biometric/rate-limited',
          errorMessage: `Too many attempts. Try again in ${remaining}s or use password fallback.`
        };
      }

      const result = await picked.adapter.authenticateWithBiometric(reason);
      if (result.ok) rateLimiter.recordSuccess(rateLimitKey);
      else rateLimiter.recordFailure(rateLimitKey);
      return result;
    },

    async unlockWalletWithBiometric(unlockWithSecret, reason) {
      const result = await this.authenticateWithBiometric(reason);
      if (!result.ok) return result;

      const secret = await secretStore.getSecret();
      if (!secret) {
        return { ok: false, method: result.method, errorCode: 'biometric/secret-missing', errorMessage: 'No saved fallback secret found' };
      }

      try {
        await unlockWithSecret(secret);
        return result;
      } catch (error) {
        return {
          ok: false,
          method: result.method,
          errorCode: 'biometric/auth-failed',
          errorMessage: error instanceof Error ? error.message : 'Wallet unlock failed'
        };
      }
    }
  };
}
