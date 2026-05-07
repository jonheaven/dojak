import { SessionSecretStore } from '../types';

const KEY = 'dojak.biometric.session-secret';

function getChromeSessionStorage():
  | { get: (keys: string[]) => Promise<Record<string, string>>; set: (items: Record<string, string>) => Promise<void>; remove: (keys: string[]) => Promise<void> }
  | null {
  const maybeChrome = globalThis.chrome as any;
  if (maybeChrome?.storage?.session) {
    return maybeChrome.storage.session;
  }
  return null;
}

export function createWebSessionSecretStore(): SessionSecretStore {
  const chromeSession = getChromeSessionStorage();

  return {
    async saveSecret(secret: string) {
      if (chromeSession) {
        await chromeSession.set({ [KEY]: secret });
        return;
      }
      sessionStorage.setItem(KEY, secret);
    },
    async getSecret() {
      if (chromeSession) {
        const result = await chromeSession.get([KEY]);
        return result?.[KEY] ?? null;
      }
      return sessionStorage.getItem(KEY);
    },
    async clearSecret() {
      if (chromeSession) {
        await chromeSession.remove([KEY]);
        return;
      }
      sessionStorage.removeItem(KEY);
    }
  };
}
