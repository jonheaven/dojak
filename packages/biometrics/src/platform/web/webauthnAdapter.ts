import { BiometricAdapter, BiometricAuthResult, BiometricAvailability } from '../../types';

const CRED_ID_KEY = 'dojak.biometric.webauthn.credential-id';

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(base64: string) {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function randomChallenge(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

export class WebAuthnAdapter implements BiometricAdapter {
  getMethod() {
    return 'webauthn-platform' as const;
  }

  async isBiometricAvailable(): Promise<BiometricAvailability> {
    const hasApi = typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;
    if (!hasApi) return { available: false, method: this.getMethod(), reason: 'WebAuthn API unavailable' };
    return { available: true, method: this.getMethod() };
  }

  async registerIfNeeded(userName = 'Dojak Wallet'): Promise<boolean> {
    const existing = localStorage.getItem(CRED_ID_KEY);
    if (existing) return true;

    if (!window.PublicKeyCredential || !navigator.credentials) return false;

    const userId = randomChallenge(16);
    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge: randomChallenge(),
      rp: { name: 'Dojak Wallet' },
      user: {
        id: userId,
        name: userName,
        displayName: userName
      },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'preferred' },
      timeout: 60_000,
      attestation: 'none'
    };

    const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
    if (!credential?.rawId) return false;

    localStorage.setItem(CRED_ID_KEY, bytesToBase64(new Uint8Array(credential.rawId)));
    return true;
  }

  async authenticateWithBiometric(): Promise<BiometricAuthResult> {
    try {
      const available = await this.isBiometricAvailable();
      if (!available.available) {
        return { ok: false, method: this.getMethod(), errorCode: 'biometric/not-available', errorMessage: available.reason };
      }

      const credId = localStorage.getItem(CRED_ID_KEY);
      if (!credId) return { ok: false, method: this.getMethod(), errorCode: 'biometric/not-enrolled', errorMessage: 'Biometric credential not enrolled' };

      const publicKey: PublicKeyCredentialRequestOptions = {
        challenge: randomChallenge(),
        timeout: 60_000,
        userVerification: 'preferred',
        allowCredentials: [{ id: base64ToBytes(credId), type: 'public-key' }]
      };

      const result = await navigator.credentials.get({ publicKey });
      if (!result) return { ok: false, method: this.getMethod(), errorCode: 'biometric/auth-failed', errorMessage: 'Authentication failed' };
      return { ok: true, method: this.getMethod() };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      return { ok: false, method: this.getMethod(), errorCode: 'biometric/auth-failed', errorMessage: message };
    }
  }
}
