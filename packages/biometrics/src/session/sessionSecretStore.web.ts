import { SessionSecretStore } from '../types';

const KEY = 'dojak.biometric.session-secret';
/** Legacy keys that once held the unlock secret in web-accessible storage — wipe on clear. */
const LEGACY_SESSION_KEYS = [
  KEY,
  'dojakweb.biometric.session-secret',
] as const;

/**
 * In-page only (not sessionStorage/localStorage). Survives SPA navigations within
 * the same JS realm; clears on full reload. XSS cannot scrape Application→Storage.
 */
let memorySecret: string | null = null;

function wipeLegacyWebStorage(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      for (const k of LEGACY_SESSION_KEYS) sessionStorage.removeItem(k);
    }
  } catch {
    /* private mode / blocked */
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
  | { get: (keys: string[]) => Promise<Record<string, string>>; set: (items: Record<string, string>) => Promise<void>; remove: (keys: string[]) => Promise<void> }
  | null {
  const maybeChrome = (globalThis as unknown as { chrome?: { storage?: { session: {
    get: (k: string[]) => Promise<Record<string, string>>;
    set: (i: Record<string, string>) => Promise<void>;
    remove: (k: string[]) => Promise<void>;
  } } } }).chrome;
  if (maybeChrome?.storage?.session) {
    return maybeChrome.storage.session;
  }
  return null;
}

/**
 * Extension: chrome.storage.session (not readable as page sessionStorage).
 * Public web: in-memory only — never write the unlock secret to sessionStorage.
 */
export function createWebSessionSecretStore(): SessionSecretStore {
  const chromeSession = getChromeSessionStorage();
  wipeLegacyWebStorage();

  return {
    async saveSecret(secret: string) {
      if (chromeSession) {
        await chromeSession.set({ [KEY]: secret });
        memorySecret = null;
        wipeLegacyWebStorage();
        return;
      }
      memorySecret = secret;
      wipeLegacyWebStorage();
    },
    async getSecret() {
      if (chromeSession) {
        const result = await chromeSession.get([KEY]);
        return result?.[KEY] ?? null;
      }
      return memorySecret;
    },
    async clearSecret() {
      memorySecret = null;
      wipeLegacyWebStorage();
      if (chromeSession) {
        await chromeSession.remove([KEY]);
      }
    }
  };
}
