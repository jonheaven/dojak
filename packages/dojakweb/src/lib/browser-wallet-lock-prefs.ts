/**
 * Per-address unlock UX preferences for browser local wallets (dojakweb).
 * Encryption always uses the chosen secret (password or PIN string); this metadata drives UI only.
 */

export type WalletLockPrimary = 'password' | 'pin';
export type WalletSecretStrength = 'standard' | 'high' | 'maximum';

export type WalletLockPreferences = {
  primary: WalletLockPrimary;
  strength: WalletSecretStrength;
  /** User enrolled WebAuthn / Digital Persona quick unlock for this address (secret cached after successful password/PIN unlock). */
  biometricQuickUnlock: boolean;
};

const STORAGE_KEY = 'dojakweb_wallet_lock_prefs_v1';

type LockPrefsMap = Record<string, WalletLockPreferences>;

function readAll(): LockPrefsMap {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as LockPrefsMap) : {};
  } catch {
    return {};
  }
}

function writeAll(map: LockPrefsMap) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function readWalletLockPreferences(address: string): WalletLockPreferences | null {
  if (!address) return null;
  const map = readAll();
  return map[address] ?? null;
}

export function writeWalletLockPreferences(address: string, prefs: WalletLockPreferences): void {
  if (!address) return;
  const map = readAll();
  map[address] = prefs;
  writeAll(map);
}

export function defaultWalletLockPreferences(): WalletLockPreferences {
  return {
    primary: 'password',
    strength: 'standard',
    biometricQuickUnlock: false,
  };
}
