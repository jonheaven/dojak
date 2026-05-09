'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  readPreferredLocale,
  subscribePreferredLocale,
  writePreferredLocale,
} from '../lib/host-preferences-sync';
import type { DojakwebBundleLocale } from '../i18n/dojakweb-messages';
import { dojakwebT } from '../i18n/dojakweb-messages';

export type { DojakwebBundleLocale };

/** Map host locale storage → bundle we translate (only en/ja in Dojakweb for now). */
export function normalizeDojakwebLocale(raw: string | null | undefined): DojakwebBundleLocale {
  if (raw === 'ja') return 'ja';
  return 'en';
}

export type DojakwebTranslate = (key: string, vars?: Record<string, string | number>) => string;

type Value = {
  locale: DojakwebBundleLocale;
  setLocale: (locale: DojakwebBundleLocale) => void;
  t: DojakwebTranslate;
};

const Ctx = createContext<Value | undefined>(undefined);

/** Stable fallback when the demo/host omits DojakwebLocaleProvider (avoids new `t` every render → effect loops). */
const noopSetLocale = () => {};
const FALLBACK_I18N: Value = {
  locale: 'en',
  setLocale: noopSetLocale,
  t: (key: string, vars?: Record<string, string | number>) => dojakwebT('en', key, vars),
};

export function DojakwebLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<DojakwebBundleLocale>('en');

  useEffect(() => {
    setLocaleState(normalizeDojakwebLocale(readPreferredLocale()));
    return subscribePreferredLocale((v) => {
      setLocaleState(normalizeDojakwebLocale(v));
    });
  }, []);

  const setLocale = (loc: DojakwebBundleLocale) => {
    setLocaleState(loc);
    writePreferredLocale(loc);
  };

  const value = useMemo<Value>(
    () => ({
      locale,
      setLocale,
      t: (key: string, vars?: Record<string, string | number>) => dojakwebT(locale, key, vars),
    }),
    [locale]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDojakwebI18n() {
  const ctx = useContext(Ctx);
  return ctx ?? FALLBACK_I18N;
}
