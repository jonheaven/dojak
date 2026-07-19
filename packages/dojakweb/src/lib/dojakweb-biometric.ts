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
 * Unlock password is held only for this browser tab/session (sessionStorage),
 * so users unlock once and stay unlocked until the tab closes — MetaMask-style.
 * chrome.storage.session is preferred when available, with sessionStorage fallback
 * (some pages expose a partial `chrome` object that cannot actually store).
 */
export function createDojakwebSessionSecretStore(): SessionSecretStore {
  const chromeSession = getChromeSessionStorage();

  return {
    async saveSecret(secret: string) {
      if (chromeSession) {
        try {
          await chromeSession.set({ [SESSION_SECRET_KEY]: secret });
          return;
        } catch {
          /* fall through to sessionStorage */
        }
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(SESSION_SECRET_KEY, secret);
      }
    },
    async getSecret() {
      if (chromeSession) {
        try {
          const result = await chromeSession.get([SESSION_SECRET_KEY]);
          const fromChrome = result?.[SESSION_SECRET_KEY] ?? null;
          if (fromChrome) return fromChrome;
        } catch {
          /* fall through to sessionStorage */
        }
      }
      if (typeof sessionStorage === 'undefined') return null;
      return sessionStorage.getItem(SESSION_SECRET_KEY);
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
