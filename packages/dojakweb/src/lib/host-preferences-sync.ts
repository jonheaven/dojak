/**
 * Host ↔ Dojakweb preference sync via localStorage + CustomEvent.
 * Any embedding site can read/write these keys so its UI and the wallet module stay aligned.
 * Dojakweb does not assume a specific host product.
 */

export const DOJAKWEB_PREFERRED_LOCALE_KEY = 'dojakweb-preferred-locale';
export const DOJAKWEB_PREFERRED_FIAT_KEY = 'dojakweb-preferred-fiat';
export const DOJAKWEB_ONE_CLICK_LOCAL_SIGNING_KEY = 'dojakweb:oneClickLocalSigning:v1';
export const DOJAKWEB_ONE_CLICK_LOCAL_SIGNING_MAX_DOGE_KEY = 'dojakweb:oneClickLocalSigningMaxDoge:v1';
export const DOJAKWEB_DEFAULT_ONE_CLICK_LOCAL_SIGNING_MAX_DOGE = 0.05;

/**
 * When `'1'` or missing/empty, Dojakweb may show fiat equivalents next to Ð amounts.
 * Set to `'0'` or `'false'` to hide.
 */
export const DOJAKWEB_SHOW_FIAT_AMOUNTS_KEY = 'dojakweb-show-fiat-amounts';

export const DOJAKWEB_PREFERRED_LOCALE_CHANGED_EVENT = 'dojakweb-preferred-locale-changed';
export const DOJAKWEB_PREFERRED_FIAT_CHANGED_EVENT = 'dojakweb-preferred-fiat-changed';
export const DOJAKWEB_ONE_CLICK_LOCAL_SIGNING_CHANGED_EVENT = 'dojakweb-one-click-local-signing-changed';
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

/** Default false: spending/signing flows should be review-first unless the user opts in. */
export function readOneClickLocalSigningPreference(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DOJAKWEB_ONE_CLICK_LOCAL_SIGNING_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeOneClickLocalSigningPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DOJAKWEB_ONE_CLICK_LOCAL_SIGNING_KEY, enabled ? '1' : '0');
    window.dispatchEvent(new CustomEvent(DOJAKWEB_ONE_CLICK_LOCAL_SIGNING_CHANGED_EVENT, { detail: enabled }));
  } catch {
    // ignore
  }
}

export type OneClickLocalSigningPolicy = {
  enabled: boolean;
  maxDoge: number;
};

export function readOneClickLocalSigningPolicy(): OneClickLocalSigningPolicy {
  if (typeof window === 'undefined') {
    return { enabled: false, maxDoge: DOJAKWEB_DEFAULT_ONE_CLICK_LOCAL_SIGNING_MAX_DOGE };
  }
  try {
    const rawMax = window.localStorage.getItem(DOJAKWEB_ONE_CLICK_LOCAL_SIGNING_MAX_DOGE_KEY);
    const parsedMax = rawMax == null ? NaN : Number(rawMax);
    const maxDoge = Number.isFinite(parsedMax) && parsedMax > 0
      ? Math.min(parsedMax, 100)
      : DOJAKWEB_DEFAULT_ONE_CLICK_LOCAL_SIGNING_MAX_DOGE;
    return {
      enabled: readOneClickLocalSigningPreference(),
      maxDoge,
    };
  } catch {
    return { enabled: false, maxDoge: DOJAKWEB_DEFAULT_ONE_CLICK_LOCAL_SIGNING_MAX_DOGE };
  }
}

export function writeOneClickLocalSigningPolicy(policy: OneClickLocalSigningPolicy): void {
  if (typeof window === 'undefined') return;
  const maxDoge = Number.isFinite(policy.maxDoge) && policy.maxDoge > 0
    ? Math.min(policy.maxDoge, 100)
    : DOJAKWEB_DEFAULT_ONE_CLICK_LOCAL_SIGNING_MAX_DOGE;
  try {
    window.localStorage.setItem(DOJAKWEB_ONE_CLICK_LOCAL_SIGNING_KEY, policy.enabled ? '1' : '0');
    window.localStorage.setItem(DOJAKWEB_ONE_CLICK_LOCAL_SIGNING_MAX_DOGE_KEY, String(maxDoge));
    window.dispatchEvent(new CustomEvent(DOJAKWEB_ONE_CLICK_LOCAL_SIGNING_CHANGED_EVENT, {
      detail: { enabled: policy.enabled, maxDoge },
    }));
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

export function subscribeOneClickLocalSigning(listener: (policy: OneClickLocalSigningPolicy) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const read = (): OneClickLocalSigningPolicy => readOneClickLocalSigningPolicy();

  const onStorage = (e: StorageEvent) => {
    if (
      e.key === DOJAKWEB_ONE_CLICK_LOCAL_SIGNING_KEY ||
      e.key === DOJAKWEB_ONE_CLICK_LOCAL_SIGNING_MAX_DOGE_KEY
    ) {
      listener(read());
    }
  };
  const onCustom = (e: Event) => {
    const d = (e as CustomEvent<boolean | OneClickLocalSigningPolicy>).detail;
    if (typeof d === 'boolean') listener({ ...read(), enabled: d });
    else if (d && typeof d === 'object' && typeof d.enabled === 'boolean') listener(d);
    else listener(read());
  };

  window.addEventListener('storage', onStorage);
  window.addEventListener(DOJAKWEB_ONE_CLICK_LOCAL_SIGNING_CHANGED_EVENT, onCustom);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(DOJAKWEB_ONE_CLICK_LOCAL_SIGNING_CHANGED_EVENT, onCustom);
  };
}
