import { BiometricAdapter, BiometricAuthResult, BiometricAvailability } from '../../types';

const DEFAULT_CRED_ID_KEY = 'dojak.biometric.webauthn.credential-id';

export type WebAuthnAdapterOptions = {
  /** Defaults to `dojak.biometric.webauthn.credential-id` (extension). Use a host-specific key for embedded web wallets. */
  credentialStorageKey?: string;
  /** When true, do not restrict to platform authenticators so USB / cross-device security keys can enroll. */
  allowUsbSecurityKeys?: boolean;
};

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
  private readonly credentialStorageKey: string;
  private readonly allowUsbSecurityKeys: boolean;

  constructor(options?: WebAuthnAdapterOptions) {
    this.credentialStorageKey = options?.credentialStorageKey ?? DEFAULT_CRED_ID_KEY;
    this.allowUsbSecurityKeys = options?.allowUsbSecurityKeys ?? false;
  }

  getMethod() {
    return 'webauthn-platform' as const;
  }

  async isBiometricAvailable(): Promise<BiometricAvailability> {
    const hasApi = typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;
    if (!hasApi) return { available: false, method: this.getMethod(), reason: 'WebAuthn API unavailable' };
    return { available: true, method: this.getMethod() };
  }

  async registerIfNeeded(userName = 'Dojak Wallet'): Promise<boolean> {
    const existing = localStorage.getItem(this.credentialStorageKey);
    if (existing) return true;

    if (!window.PublicKeyCredential || !navigator.credentials) return false;

    const userId = randomChallenge(16);
    const authenticatorSelection = this.allowUsbSecurityKeys
      ? { userVerification: 'preferred' as const }
      : { authenticatorAttachment: 'platform' as const, userVerification: 'preferred' as const };

    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge: randomChallenge(),
      rp: { name: 'Dojak Wallet' },
      user: {
        id: userId,
        name: userName,
        displayName: userName
      },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
      authenticatorSelection,
      timeout: 60_000,
      attestation: 'none'
    };

    const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
    if (!credential?.rawId) return false;

    localStorage.setItem(this.credentialStorageKey, bytesToBase64(new Uint8Array(credential.rawId)));
    return true;
  }

  async authenticateWithBiometric(): Promise<BiometricAuthResult> {
    try {
      const available = await this.isBiometricAvailable();
      if (!available.available) {
        return { ok: false, method: this.getMethod(), errorCode: 'biometric/not-available', errorMessage: available.reason };
      }

      const credId = localStorage.getItem(this.credentialStorageKey);
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
