import {
  createBiometricFacade,
  DigitalPersonaAdapter,
  WebAuthnAdapter,
  type BiometricFacade,
  type SessionSecretStore,
} from '@dojak/biometrics';
import { stampUnlockExpiry, unlockExpiryElapsed, writeUnlockExpiresAt } from './unlock-window';

const SESSION_SECRET_KEY = 'dojakweb.biometric.session-secret';
const LEGACY_SESSION_KEYS = [
  SESSION_SECRET_KEY,
  'dojak.biometric.session-secret',
] as const;

/** In-memory unlock secret. Survives SPA remounts, not a full reload. */
let memorySecret: string | null = null;

/**
 * `window` (default): sessionStorage plus the Display "stay unlocked" clock.
 * A refresh in the same tab stays unlocked until that quiet period ends.
 * `tab`: sessionStorage with no clock, for a game host that must last until the tab closes.
 * `memory`: unlock dies on refresh. Explicit opt-in.
 * The secret dies when the tab closes. Never localStorage.
 */
export type DojakwebUnlockPersistence = 'memory' | 'tab' | 'window';

const TAB_UNLOCK_KEY = 'dojakweb.tab-unlock-secret';
let unlockPersistence: DojakwebUnlockPersistence = 'window';

export function setDojakwebUnlockPersistence(mode: DojakwebUnlockPersistence): void {
  if (mode === 'tab' || mode === 'memory' || mode === 'window') {
    unlockPersistence = mode;
    return;
  }
  unlockPersistence = 'window';
}

export function dojakwebUnlockPersistsForTab(): boolean {
  return unlockPersistence === 'tab';
}

export function dojakwebUnlockUsesWindow(): boolean {
  return unlockPersistence === 'window';
}

function sessionUnlockEnabled(): boolean {
  return unlockPersistence === 'tab' || unlockPersistence === 'window';
}

function readTabUnlockSecret(): string | null {
  if (!sessionUnlockEnabled() || typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage.getItem(TAB_UNLOCK_KEY);
  } catch {
    return null;
  }
}

function writeTabUnlockSecret(secret: string | null): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (secret && sessionUnlockEnabled()) sessionStorage.setItem(TAB_UNLOCK_KEY, secret);
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
 * Public site: sessionStorage for this tab, with the stay-unlocked clock.
 * Game hosts may opt into `tab` (no clock) or `memory` (dies on refresh).
 * Never write the unlock password to localStorage.
 */
export function createDojakwebSessionSecretStore(): SessionSecretStore {
  const chromeSession = getChromeSessionStorage();
  wipeLegacyWebStorage();

  const store: SessionSecretStore = {
    async saveSecret(secret: string) {
      wipeLegacyWebStorage();
      writeTabUnlockSecret(secret);
      if (unlockPersistence === 'window') stampUnlockExpiry();
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
          if (fromChrome) {
            if (unlockPersistence === 'window' && unlockExpiryElapsed()) {
              await store.clearSecret();
              return null;
            }
            return fromChrome;
          }
        } catch {
          /* fall through */
        }
      }
      const secret = memorySecret ?? readTabUnlockSecret();
      if (!secret) return null;
      if (unlockPersistence === 'window' && unlockExpiryElapsed()) {
        await store.clearSecret();
        return null;
      }
      return secret;
    },
    async clearSecret() {
      memorySecret = null;
      writeTabUnlockSecret(null);
      writeUnlockExpiresAt(null);
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
  return store;
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
