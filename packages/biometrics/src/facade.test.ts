import { createBiometricFacade } from './facade';
import { BiometricAdapter, SessionSecretStore } from './types';

const createStore = (secret: string | null): SessionSecretStore => ({
  saveSecret: async () => undefined,
  getSecret: async () => secret,
  clearSecret: async () => undefined
});

const createAdapter = (ok: boolean): BiometricAdapter => ({
  getMethod: () => 'touch-id',
  isBiometricAvailable: async () => ({ available: true, method: 'touch-id' }),
  authenticateWithBiometric: async () => ({ ok, method: 'touch-id', errorCode: ok ? undefined : 'biometric/auth-failed' })
});

describe('createBiometricFacade', () => {
  it('unlocks with stored secret after successful biometric auth', async () => {
    const facade = createBiometricFacade([createAdapter(true)], createStore('pw-123'));
    const unlockSpy = jest.fn(async () => undefined);

    const result = await facade.unlockWalletWithBiometric(unlockSpy, 'unlock');

    expect(result.ok).toBe(true);
    expect(unlockSpy).toHaveBeenCalledWith('pw-123');
  });

  it('returns secret-missing when biometric succeeds without saved secret', async () => {
    const facade = createBiometricFacade([createAdapter(true)], createStore(null));
    const unlockSpy = jest.fn(async () => undefined);

    const result = await facade.unlockWalletWithBiometric(unlockSpy, 'unlock');

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('biometric/secret-missing');
    expect(unlockSpy).not.toHaveBeenCalled();
  });

  it('rate limits repeated failed attempts', async () => {
    const failingAdapter: BiometricAdapter = {
      getMethod: () => 'touch-id',
      isBiometricAvailable: async () => ({ available: true, method: 'touch-id' }),
      authenticateWithBiometric: async () => ({ ok: false, method: 'touch-id', errorCode: 'biometric/auth-failed' })
    };

    const facade = createBiometricFacade([failingAdapter], createStore('pw'));
    for (let i = 0; i < 5; i += 1) {
      await facade.authenticateWithBiometric('unlock');
    }
    const locked = await facade.authenticateWithBiometric('unlock');
    expect(locked.errorCode).toBe('biometric/rate-limited');
  });
});
