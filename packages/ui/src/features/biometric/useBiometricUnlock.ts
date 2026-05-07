import { useMemo } from 'react';

import {
  createBiometricFacade,
  createWebAdapters,
  createWebSessionSecretStore,
  WebAuthnAdapter
} from '@dojak/biometrics';
import { useUnlockCallback } from '@dojak/ui/state/global/hooks';
import { useWallet } from '@dojak/ui/utils';

export function useBiometricUnlock() {
  const wallet = useWallet();
  const unlock = useUnlockCallback();
  const facade = useMemo(
    () => createBiometricFacade(createWebAdapters(), createWebSessionSecretStore()),
    []
  );

  const savePasswordForBiometric = async (password: string) => {
    const store = createWebSessionSecretStore();
    await store.saveSecret(password);
  };

  const clearBiometricSecret = async () => {
    const store = createWebSessionSecretStore();
    await store.clearSecret();
  };

  const enableBiometric = async (password: string) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new Error('Biometric registration must run from extension UI context.');
    }
    const webAuthn = new WebAuthnAdapter();
    const registered = await webAuthn.registerIfNeeded('Dojak Wallet');
    if (!registered) {
      throw new Error('Unable to register biometric credential');
    }
    await savePasswordForBiometric(password);
    await wallet.setBiometricUnlockConfig?.(true, 'webauthn-platform');
  };

  const disableBiometric = async () => {
    await clearBiometricSecret();
    await wallet.setBiometricUnlockConfig?.(false, '');
  };

  const unlockWithBiometric = async () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return {
        ok: false,
        method: 'unknown' as const,
        errorCode: 'biometric/unsupported',
        errorMessage: 'Biometric auth prompt must be triggered from popup/content UI context.'
      };
    }
    return facade.unlockWalletWithBiometric(async (secret) => {
      await unlock(secret);
    }, 'Authenticate to unlock Dojak Wallet');
  };

  const getConfig = async () => {
    const result = await wallet.getBiometricUnlockConfig?.();
    return result ?? { enabled: false, method: '' };
  };

  return {
    facade,
    getConfig,
    enableBiometric,
    disableBiometric,
    unlockWithBiometric
  };
}
