'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { DOGE_PRICE_SOURCES_CHANGED_EVENT, getOrderedDogePriceSources } from '../utils/price-sources';

interface DogePriceContextValue {
  dogecoinPrice: number | null;
}

const DogePriceContext = createContext<DogePriceContextValue>({ dogecoinPrice: null });

export function DogePriceProvider({ children }: { children: React.ReactNode }) {
  const [dogecoinPrice, setDogecoinPrice] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchPrice = async () => {
      const sources = getOrderedDogePriceSources();
      for (const source of sources) {
        try {
          const response = await fetch(source.url);
          if (!response.ok) continue;
          const data = await response.json();
          const parsed = source.parse(data);
          if (Number.isFinite(parsed) && parsed > 0) {
            if (!cancelled) setDogecoinPrice(parsed);
            return;
          }
        } catch {
          // try next source
        }
      }
    };

    fetchPrice();
    intervalRef.current = setInterval(fetchPrice, 30_000);

    const onSourceChange = () => void fetchPrice();
    window.addEventListener(DOGE_PRICE_SOURCES_CHANGED_EVENT, onSourceChange);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener(DOGE_PRICE_SOURCES_CHANGED_EVENT, onSourceChange);
    };
  }, []);

  return (
    <DogePriceContext.Provider value={{ dogecoinPrice }}>
      {children}
    </DogePriceContext.Provider>
  );
}

export function useDogePriceContext() {
  return useContext(DogePriceContext);
}
