import {
  createBiometricFacade,
  DigitalPersonaAdapter,
  WebAuthnAdapter,
  type BiometricFacade,
  type SessionSecretStore,
} from '@dojak/biometrics';

const SESSION_SECRET_KEY = 'dojakweb.biometric.session-secret';
const LEGACY_SESSION_KEYS = [
  SESSION_SECRET_KEY,
  'dojak.biometric.session-secret',
] as const;

/** In-memory unlock secret. Survives SPA remounts, not a full reload. */
let memorySecret: string | null = null;

/**
 * `memory` (default): unlock dies on refresh. Used by dogenals and the public wallet.
 * `tab`: also write sessionStorage so a game host can keep the player in across refresh.
 * The secret still dies when the tab closes. Never localStorage.
 */
export type DojakwebUnlockPersistence = 'memory' | 'tab';

const TAB_UNLOCK_KEY = 'dojakweb.tab-unlock-secret';
let unlockPersistence: DojakwebUnlockPersistence = 'memory';

export function setDojakwebUnlockPersistence(mode: DojakwebUnlockPersistence): void {
  unlockPersistence = mode === 'tab' ? 'tab' : 'memory';
}

export function dojakwebUnlockPersistsForTab(): boolean {
  return unlockPersistence === 'tab';
}

function readTabUnlockSecret(): string | null {
  if (unlockPersistence !== 'tab' || typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage.getItem(TAB_UNLOCK_KEY);
  } catch {
    return null;
  }
}

function writeTabUnlockSecret(secret: string | null): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (secret && unlockPersistence === 'tab') sessionStorage.setItem(TAB_UNLOCK_KEY, secret);
    else sessionStorage.removeItem(TAB_UNLOCK_KEY);
  } catch {
    /* private-mode quota */
  }
}

function wipeLegacyWebStorage(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      for (const k of LEGACY_SESSION_KEYS) sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof localStorage !== 'undefined') {
      for (const k of LEGACY_SESSION_KEYS) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

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
 * Extension: chrome.storage.session only.
 * Public site: in-memory for the JS realm (survives SPA remounts, not full reload).
 * Game hosts may opt into `tab` persistence (sessionStorage) via DojakWalletProvider.
 * Never write the unlock password to localStorage.
 */
export function createDojakwebSessionSecretStore(): SessionSecretStore {
  const chromeSession = getChromeSessionStorage();
  wipeLegacyWebStorage();

  return {
    async saveSecret(secret: string) {
      wipeLegacyWebStorage();
      writeTabUnlockSecret(secret);
      if (chromeSession) {
        try {
          await chromeSession.set({ [SESSION_SECRET_KEY]: secret });
          memorySecret = null;
          return;
        } catch {
          /* fall through to memory */
        }
      }
      memorySecret = secret;
    },
    async getSecret() {
      if (chromeSession) {
        try {
          const result = await chromeSession.get([SESSION_SECRET_KEY]);
          const fromChrome = result?.[SESSION_SECRET_KEY] ?? null;
          if (fromChrome) return fromChrome;
        } catch {
          /* fall through */
        }
      }
      return memorySecret ?? readTabUnlockSecret();
    },
    async clearSecret() {
      memorySecret = null;
      writeTabUnlockSecret(null);
      wipeLegacyWebStorage();
      if (chromeSession) {
        try {
          await chromeSession.remove([SESSION_SECRET_KEY]);
        } catch {
          /* ignore */
        }
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
