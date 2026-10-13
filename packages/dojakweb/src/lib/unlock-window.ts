/**
 * How long the in-browser wallet stays unlocked.
 * The duration is a local preference. The PIN itself never goes in localStorage.
 * It lives in sessionStorage for this tab and is dropped when the quiet period ends,
 * the tab closes, or the user locks / disconnects.
 */

export const UNLOCK_WINDOW_PREF_KEY = 'dojakweb_unlock_window';
export const UNLOCK_EXPIRES_KEY = 'dojakweb.tab-unlock-expires';
export const UNLOCK_WINDOW_CHANGED_EVENT = 'dojakweb:unlock-window-changed';

export type UnlockWindowId = '15m' | '1h' | '8h' | '24h' | 'tab';

export const DEFAULT_UNLOCK_WINDOW: UnlockWindowId = '8h';

const WINDOW_MS: Record<Exclude<UnlockWindowId, 'tab'>, number> = {
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '8h': 8 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

export const UNLOCK_WINDOW_CHOICES: { id: UnlockWindowId; label: string }[] = [
  { id: '15m', label: '15 min' },
  { id: '1h', label: '1 hour' },
  { id: '8h', label: '8 hours' },
  { id: '24h', label: '24 hours' },
  { id: 'tab', label: 'Until I close this tab' },
];

export function isUnlockWindowId(value: string): value is UnlockWindowId {
  return value === '15m' || value === '1h' || value === '8h' || value === '24h' || value === 'tab';
}

/** Quiet time before lock. `null` means "until this tab closes". */
export function unlockWindowDurationMs(id: UnlockWindowId = readUnlockWindow()): number | null {
  if (id === 'tab') return null;
  return WINDOW_MS[id];
}

export function readUnlockWindow(): UnlockWindowId {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_UNLOCK_WINDOW;
  try {
    const raw = window.localStorage.getItem(UNLOCK_WINDOW_PREF_KEY);
    if (raw && isUnlockWindowId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_UNLOCK_WINDOW;
}

export function readUnlockExpiresAt(): number | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(UNLOCK_EXPIRES_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function writeUnlockExpiresAt(expiresAt: number | null): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (expiresAt == null) sessionStorage.removeItem(UNLOCK_EXPIRES_KEY);
    else sessionStorage.setItem(UNLOCK_EXPIRES_KEY, String(expiresAt));
  } catch {
    /* private-mode quota */
  }
}

/** Start or slide the quiet-period clock. "Until this tab closes" clears the clock. */
export function stampUnlockExpiry(now = Date.now()): void {
  const ms = unlockWindowDurationMs();
  if (ms == null) {
    writeUnlockExpiresAt(null);
    return;
  }
  writeUnlockExpiresAt(now + ms);
}

export function unlockExpiryElapsed(now = Date.now()): boolean {
  if (unlockWindowDurationMs() == null) return false;
  const at = readUnlockExpiresAt();
  if (at == null) return false;
  return now >= at;
}

/** Milliseconds until lock. `null` means there is no clock. */
export function msUntilUnlockExpiry(now = Date.now()): number | null {
  const ms = unlockWindowDurationMs();
  if (ms == null) return null;
  const at = readUnlockExpiresAt();
  if (at == null) return ms;
  return Math.max(0, at - now);
}

export function writeUnlockWindow(id: UnlockWindowId): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(UNLOCK_WINDOW_PREF_KEY, id);
    } catch {
      /* ignore */
    }
  }
  stampUnlockExpiry();
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    window.dispatchEvent(new Event(UNLOCK_WINDOW_CHANGED_EVENT));
  } catch {
    /* non-DOM test */
  }
}
