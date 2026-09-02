import { webcrypto } from 'node:crypto';

const g = globalThis as typeof globalThis & { window?: typeof globalThis };

if (typeof g.window === 'undefined') {
  g.window = g;
}

if (typeof g.window.location === 'undefined' || typeof g.window.location.hostname === 'undefined') {
  Object.defineProperty(g.window, 'location', {
    configurable: true,
    value: {
      hostname: 'localhost',
      href: 'http://localhost/',
      origin: 'http://localhost',
    },
  });
}

if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: false,
    configurable: true,
  });
}

if (typeof globalThis.btoa === 'undefined') {
  globalThis.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
  globalThis.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
}

const mem = new Map<string, string>();
const memoryLocalStorage = {
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

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: memoryLocalStorage,
});
