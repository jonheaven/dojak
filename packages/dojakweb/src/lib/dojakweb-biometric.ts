import {
  createBiometricFacade,
  DigitalPersonaAdapter,
  WebAuthnAdapter,
  type BiometricFacade,
  type SessionSecretStore,
} from '@dojak/biometrics';

const SESSION_SECRET_KEY = 'dojakweb.biometric.session-secret';

function getChromeSessionStorage():
  | {
      get: (keys: string[]) => Promise<Record<string, string>>;
      set: (items: Record<string, string>) => Promise<void>;
      remove: (keys: string[]) => Promise<void>;
    }
  | null {
  const maybeChrome = (globalThis as unknown as { chrome?: { storage?: { session?: {
    get: (k: string[]) => Promise<Record<string, string>>;
    set: (i: Record<string, string>) => Promise<void>;
    remove: (k: string[]) => Promise<void>;
  } } } }).chrome;
  return maybeChrome?.storage?.session ?? null;
}

/**
 * Session secret store isolated from the extension (`dojak.biometric.*`) keys.
 * Unlock password is held only in chrome.storage.session when that API exists
 * (browser extension). The public site has no sessionStorage fallback — the
 * user re-enters the password after refresh. Never write the password to
 * localStorage or sessionStorage.
 */
export function createDojakwebSessionSecretStore(): SessionSecretStore {
  const chromeSession = getChromeSessionStorage();

  return {
    async saveSecret(secret: string) {
      if (!chromeSession) return;
      try {
        await chromeSession.set({ [SESSION_SECRET_KEY]: secret });
      } catch {
        /* public site / permission denied — require re-entry */
      }
    },
    async getSecret() {
      if (!chromeSession) return null;
      try {
        const result = await chromeSession.get([SESSION_SECRET_KEY]);
        return result?.[SESSION_SECRET_KEY] ?? null;
      } catch {
        return null;
      }
    },
    async clearSecret() {
      if (chromeSession) {
        try {
          await chromeSession.remove([SESSION_SECRET_KEY]);
        } catch {
          /* ignore */
        }
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(SESSION_SECRET_KEY);
      }
    },
  };
}

/**
 * WebAuthn + Digital Persona (USB fingerprint) with host-specific credential storage so embedded
 * dojakweb does not collide with the browser extension's WebAuthn credential id.
 */
export function createDojakwebBiometricFacade(): BiometricFacade {
  const adapters = [
    new WebAuthnAdapter({
      credentialStorageKey: 'dojakweb.biometric.webauthn.credential-id',
      allowUsbSecurityKeys: true,
    }),
    new DigitalPersonaAdapter(),
  ];
  return createBiometricFacade(adapters, createDojakwebSessionSecretStore());
}
