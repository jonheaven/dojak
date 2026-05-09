/**
 * Host ↔ Dojakweb preference sync via localStorage + CustomEvent.
 * Any embedding site can read/write these keys so its UI and the wallet module stay aligned.
 * Dojakweb does not assume a specific host product.
 */

export const DOJAKWEB_PREFERRED_LOCALE_KEY = 'dojakweb-preferred-locale';
export const DOJAKWEB_PREFERRED_FIAT_KEY = 'dojakweb-preferred-fiat';

/**
 * When `'1'` or missing/empty, Dojakweb may show fiat equivalents next to Ð amounts.
 * Set to `'0'` or `'false'` to hide.
 */
export const DOJAKWEB_SHOW_FIAT_AMOUNTS_KEY = 'dojakweb-show-fiat-amounts';

export const DOJAKWEB_PREFERRED_LOCALE_CHANGED_EVENT = 'dojakweb-preferred-locale-changed';
export const DOJAKWEB_PREFERRED_FIAT_CHANGED_EVENT = 'dojakweb-preferred-fiat-changed';
export const DOJAKWEB_SHOW_FIAT_AMOUNTS_CHANGED_EVENT = 'dojakweb-show-fiat-amounts-changed';

export function readPreferredLocale(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(DOJAKWEB_PREFERRED_LOCALE_KEY);
  } catch {
    return null;
  }
}

export function readPreferredFiat(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(DOJAKWEB_PREFERRED_FIAT_KEY);
  } catch {
    return null;
  }
}

export function writePreferredLocale(locale: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DOJAKWEB_PREFERRED_LOCALE_KEY, locale);
    window.dispatchEvent(new CustomEvent(DOJAKWEB_PREFERRED_LOCALE_CHANGED_EVENT, { detail: locale }));
  } catch {
    // ignore
  }
}

export function writePreferredFiat(currency: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DOJAKWEB_PREFERRED_FIAT_KEY, currency);
    window.dispatchEvent(new CustomEvent(DOJAKWEB_PREFERRED_FIAT_CHANGED_EVENT, { detail: currency }));
  } catch {
    // ignore
  }
}

/** Default true when unset. */
export function readShowFiatAmountsPreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const v = window.localStorage.getItem(DOJAKWEB_SHOW_FIAT_AMOUNTS_KEY);
    if (v == null) return true;
    return v !== '0' && v !== 'false';
  } catch {
    return true;
  }
}

export function writeShowFiatAmountsPreference(show: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DOJAKWEB_SHOW_FIAT_AMOUNTS_KEY, show ? '1' : '0');
    window.dispatchEvent(new CustomEvent(DOJAKWEB_SHOW_FIAT_AMOUNTS_CHANGED_EVENT, { detail: show }));
  } catch {
    // ignore
  }
}

export function subscribePreferredLocale(listener: (locale: string) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const onStorage = (e: StorageEvent) => {
    if (e.key === DOJAKWEB_PREFERRED_LOCALE_KEY && e.newValue) listener(e.newValue);
  };
  const onCustom = (e: Event) => {
    const d = (e as CustomEvent<string>).detail;
    if (typeof d === 'string') listener(d);
  };

  window.addEventListener('storage', onStorage);
  window.addEventListener(DOJAKWEB_PREFERRED_LOCALE_CHANGED_EVENT, onCustom);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(DOJAKWEB_PREFERRED_LOCALE_CHANGED_EVENT, onCustom);
  };
}

export function subscribePreferredFiat(listener: (currency: string) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const onStorage = (e: StorageEvent) => {
    if (e.key === DOJAKWEB_PREFERRED_FIAT_KEY && e.newValue) listener(e.newValue);
  };
  const onCustom = (e: Event) => {
    const d = (e as CustomEvent<string>).detail;
    if (typeof d === 'string') listener(d);
  };

  window.addEventListener('storage', onStorage);
  window.addEventListener(DOJAKWEB_PREFERRED_FIAT_CHANGED_EVENT, onCustom);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(DOJAKWEB_PREFERRED_FIAT_CHANGED_EVENT, onCustom);
  };
}

export function subscribeShowFiatAmounts(listener: (show: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const read = (): boolean => readShowFiatAmountsPreference();

  const onStorage = (e: StorageEvent) => {
    if (e.key === DOJAKWEB_SHOW_FIAT_AMOUNTS_KEY) listener(read());
  };
  const onCustom = (e: Event) => {
    const d = (e as CustomEvent<boolean>).detail;
    if (typeof d === 'boolean') listener(d);
    else listener(read());
  };

  window.addEventListener('storage', onStorage);
  window.addEventListener(DOJAKWEB_SHOW_FIAT_AMOUNTS_CHANGED_EVENT, onCustom);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(DOJAKWEB_SHOW_FIAT_AMOUNTS_CHANGED_EVENT, onCustom);
  };
}
