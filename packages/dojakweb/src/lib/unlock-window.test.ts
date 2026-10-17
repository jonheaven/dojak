import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createDojakwebSessionSecretStore,
  setDojakwebUnlockPersistence,
} from './dojakweb-biometric';
import {
  DEFAULT_UNLOCK_WINDOW,
  UNLOCK_EXPIRES_KEY,
  UNLOCK_WINDOW_PREF_KEY,
  msUntilUnlockExpiry,
  readUnlockExpiresAt,
  readUnlockWindow,
  stampUnlockExpiry,
  unlockExpiryElapsed,
  writeUnlockWindow,
} from './unlock-window';

const SECRET = 'pin-stay-unlocked-9f3a';
const TAB_KEY = 'dojakweb.tab-unlock-secret';

function installSessionStorage(): void {
  const mem = new Map<string, string>();
  const storage = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => {
      mem.set(String(k), String(v));
    },
    removeItem: (k: string) => {
      mem.delete(k);
    },
    clear: () => {
      mem.clear();
    },
    key: (index: number) => Array.from(mem.keys())[index] ?? null,
    get length() {
      return mem.size;
    },
  };
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: storage,
  });
}

function localDump(): string {
  const parts: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    parts.push(`${key}=${localStorage.getItem(key) ?? ''}`);
  }
  return parts.join('\n');
}

describe('unlock window preference', () => {
  beforeEach(() => {
    installSessionStorage();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('defaults to 8 hours', () => {
    expect(readUnlockWindow()).toBe(DEFAULT_UNLOCK_WINDOW);
    expect(readUnlockWindow()).toBe('8h');
    localStorage.setItem(UNLOCK_WINDOW_PREF_KEY, 'nope');
    expect(readUnlockWindow()).toBe('8h');
  });

  it('stamps a sliding expiry and treats "this tab" as no clock', () => {
    localStorage.setItem(UNLOCK_WINDOW_PREF_KEY, '15m');
    stampUnlockExpiry(1_000_000);
    expect(readUnlockExpiresAt()).toBe(1_000_000 + 15 * 60 * 1000);
    expect(unlockExpiryElapsed(1_000_000 + 15 * 60 * 1000 - 1)).toBe(false);
    expect(unlockExpiryElapsed(1_000_000 + 15 * 60 * 1000)).toBe(true);
    expect(msUntilUnlockExpiry(1_000_000 + 1000)).toBe(15 * 60 * 1000 - 1000);

    sessionStorage.removeItem(UNLOCK_EXPIRES_KEY);
    expect(msUntilUnlockExpiry(1_000_000)).toBeNull();

    writeUnlockWindow('tab');
    expect(readUnlockWindow()).toBe('tab');
    expect(readUnlockExpiresAt()).toBeNull();
    expect(unlockExpiryElapsed(Number.MAX_SAFE_INTEGER)).toBe(false);
    expect(msUntilUnlockExpiry()).toBeNull();
    expect(localDump()).not.toContain(SECRET);
  });
});

describe('session unlock secret', () => {
  beforeEach(async () => {
    installSessionStorage();
    localStorage.clear();
    sessionStorage.clear();
    setDojakwebUnlockPersistence('window');
    await createDojakwebSessionSecretStore().clearSecret();
  });

  it('keeps the PIN across a reload until the window ends, and never writes it to localStorage', async () => {
    localStorage.setItem(UNLOCK_WINDOW_PREF_KEY, '8h');
    const store = createDojakwebSessionSecretStore();
    await store.saveSecret(SECRET);

    expect(sessionStorage.getItem(TAB_KEY)).toBe(SECRET);
    expect(localDump()).not.toContain(SECRET);
    expect(sessionStorage.getItem(UNLOCK_EXPIRES_KEY)).toBeTruthy();
    expect(await store.getSecret()).toBe(SECRET);

    vi.resetModules();
    const fresh = await import('./dojakweb-biometric');
    const windowMod = await import('./unlock-window');
    fresh.setDojakwebUnlockPersistence('window');
    expect(await fresh.createDojakwebSessionSecretStore().getSecret()).toBe(SECRET);

    sessionStorage.setItem(UNLOCK_EXPIRES_KEY, String(Date.now() - 5));
    expect(windowMod.unlockExpiryElapsed()).toBe(true);
    expect(await fresh.createDojakwebSessionSecretStore().getSecret()).toBeNull();
    expect(sessionStorage.getItem(TAB_KEY)).toBeNull();
    expect(localDump()).not.toContain(SECRET);
  });

  it('memory mode drops the secret on reload', async () => {
    setDojakwebUnlockPersistence('memory');
    await createDojakwebSessionSecretStore().saveSecret(SECRET);
    expect(sessionStorage.getItem(TAB_KEY)).toBeNull();

    vi.resetModules();
    const fresh = await import('./dojakweb-biometric');
    fresh.setDojakwebUnlockPersistence('memory');
    expect(await fresh.createDojakwebSessionSecretStore().getSecret()).toBeNull();
    expect(localDump()).not.toContain(SECRET);
  });

  it('tab mode ignores a stale clock', async () => {
    setDojakwebUnlockPersistence('tab');
    await createDojakwebSessionSecretStore().saveSecret(SECRET);
    sessionStorage.setItem(UNLOCK_EXPIRES_KEY, String(Date.now() - 5));
    expect(await createDojakwebSessionSecretStore().getSecret()).toBe(SECRET);
  });
});
