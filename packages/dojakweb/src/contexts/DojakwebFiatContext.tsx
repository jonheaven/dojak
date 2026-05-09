'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { readPreferredFiat, subscribePreferredFiat, writePreferredFiat } from '../lib/host-preferences-sync';
import { useDogePriceContext } from './DogePriceContext';

export type DojakwebFiatCurrency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD';

const VALID: Record<string, DojakwebFiatCurrency> = {
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  JPY: 'JPY',
  AUD: 'AUD',
  CAD: 'CAD',
};

const FALLBACK_FX_FROM_USD: Record<DojakwebFiatCurrency, number> = {
  USD: 1,
  EUR: 0.9,
  GBP: 0.78,
  JPY: 150,
  AUD: 1.5,
  CAD: 1.35,
};

function detectDefaultCurrency(): DojakwebFiatCurrency {
  if (typeof navigator === 'undefined') return 'USD';
  const lang = navigator.language || 'en-US';
  if (lang.startsWith('en-GB')) return 'GBP';
  if (lang.startsWith('en-AU')) return 'AUD';
  if (lang.startsWith('en-CA') || lang.startsWith('fr-CA')) return 'CAD';
  if (lang.startsWith('ja')) return 'JPY';
  if (lang.startsWith('de') || lang.startsWith('fr') || lang.startsWith('es') || lang.startsWith('it')) {
    return 'EUR';
  }
  return 'USD';
}

type Value = {
  currency: DojakwebFiatCurrency;
  setCurrency: (c: DojakwebFiatCurrency) => void;
  /** USD per 1 DOGE from DogePriceContext */
  priceUsd: number | null;
  convertUsd: (doge: number | null | undefined) => number | null;
  convert: (doge: number | null | undefined) => number | null;
  formatFiat: (amount: number | null, code?: DojakwebFiatCurrency) => string;
};

const Ctx = createContext<Value | undefined>(undefined);

export function DojakwebFiatProvider({
  children,
  fxRatesUrl,
}: {
  children: ReactNode;
  /** e.g. `"/api/fx-rates"` from your backend — JSON `{ rates: { EUR: number, ... } }` (USD base). */
  fxRatesUrl?: string;
}) {
  const { dogecoinPrice } = useDogePriceContext();
  const [currency, setCurrencyState] = useState<DojakwebFiatCurrency>('USD');
  const [fxFromUsd, setFxFromUsd] = useState<Record<DojakwebFiatCurrency, number>>(FALLBACK_FX_FROM_USD);

  useEffect(() => {
    const raw = readPreferredFiat();
    if (raw && VALID[raw]) {
      setCurrencyState(VALID[raw]!);
    } else {
      setCurrencyState(detectDefaultCurrency());
    }
    return subscribePreferredFiat((v) => {
      if (VALID[v]) setCurrencyState(VALID[v]!);
    });
  }, []);

  useEffect(() => {
    if (!fxRatesUrl) return;
    let cancelled = false;
    async function pull() {
      try {
        const res = await fetch(fxRatesUrl, { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { rates?: Record<string, number> };
        if (!json.rates || cancelled) return;
        setFxFromUsd((prev) => {
          const next = { ...prev };
          (Object.keys(next) as DojakwebFiatCurrency[]).forEach((code) => {
            if (code === 'USD') next.USD = 1;
            else if (typeof json.rates?.[code] === 'number' && Number.isFinite(json.rates[code]!)) {
              next[code] = json.rates[code]!;
            }
          });
          return next;
        });
      } catch {
        // keep fallback
      }
    }
    void pull();
    const id = window.setInterval(pull, 10 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [fxRatesUrl]);

  const setCurrency = (c: DojakwebFiatCurrency) => {
    setCurrencyState(c);
    writePreferredFiat(c);
  };

  const value = useMemo<Value>(() => {
    const priceUsd = dogecoinPrice != null && Number.isFinite(dogecoinPrice) && dogecoinPrice > 0 ? dogecoinPrice : null;

    const convertUsd = (doge: number | null | undefined) => {
      if (doge == null || !Number.isFinite(doge) || priceUsd == null) return null;
      return doge * priceUsd;
    };

    const convert = (doge: number | null | undefined) => {
      const usd = convertUsd(doge);
      if (usd == null) return null;
      const fx = fxFromUsd[currency] ?? 1;
      return usd * fx;
    };

    const formatFiat = (amount: number | null, code?: DojakwebFiatCurrency) => {
      if (amount == null || !Number.isFinite(amount)) return '—';
      const c = code ?? currency;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: c,
        maximumFractionDigits: 2,
      }).format(amount);
    };

    return {
      currency,
      setCurrency,
      priceUsd,
      convertUsd,
      convert,
      formatFiat,
    };
  }, [currency, dogecoinPrice, fxFromUsd]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDojakwebFiat() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useDojakwebFiat must be used within DojakwebFiatProvider');
  }
  return ctx;
}

export function useDojakwebFiatOptional(): Value | undefined {
  return useContext(Ctx);
}
