const STORAGE_KEY = 'dojakweb:price-source-config';

export type DogePriceSourceId = 'aster' | 'coingecko' | 'coinpaprika';

export interface DogePriceSource {
  id: DogePriceSourceId;
  label: string;
  description: string;
  url: string;
}

export interface DogePriceSourceConfig {
  sources: DogePriceSourceId[];
}

export const DOGE_PRICE_SOURCE_LIST: DogePriceSource[] = [
  {
    id: 'aster',
    label: 'Aster',
    description: 'Aster DEX perpetual last price (DOGEUSDT)',
    url: 'https://fapi.asterdex.com/fapi/v1/ticker/price?symbol=DOGEUSDT',
  },
  {
    id: 'coingecko',
    label: 'CoinGecko',
    description: 'CoinGecko public API (no key required)',
    url: 'https://api.coingecko.com/api/v3/simple/price?ids=dogecoin&vs_currencies=usd',
  },
  {
    id: 'coinpaprika',
    label: 'CoinPaprika',
    description: 'CoinPaprika public API (no key required)',
    url: 'https://api.coinpaprika.com/v1/tickers/doge-dogecoin',
  },
];

/** Default: Aster DEX only; users can add CoinGecko / CoinPaprika in wallet settings → Price. */
const DEFAULT_CONFIG: DogePriceSourceConfig = {
  sources: ['aster'],
};

export function getDogePriceSourceConfig(): DogePriceSourceConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DogePriceSourceConfig;
      if (Array.isArray(parsed.sources)) return parsed;
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_CONFIG };
}

export const DOGE_PRICE_SOURCES_CHANGED_EVENT = 'dojakweb:doge-price-sources-changed';

function parseAster(data: unknown): number {
  if (data && typeof data === 'object' && 'price' in data) {
    const raw = (data as { price: unknown }).price;
    const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function parseCoingecko(data: unknown): number {
  const d = data as { dogecoin?: { usd?: number } };
  const n = d?.dogecoin?.usd;
  return typeof n === 'number' && Number.isFinite(n) ? n : NaN;
}

function parseCoinpaprika(data: unknown): number {
  const d = data as { quotes?: { USD?: { price?: number } } };
  const n = d?.quotes?.USD?.price;
  return typeof n === 'number' && Number.isFinite(n) ? n : NaN;
}

const PARSERS: Record<DogePriceSourceId, (data: unknown) => number> = {
  aster: parseAster,
  coingecko: parseCoingecko,
  coinpaprika: parseCoinpaprika,
};

export type OrderedDogePriceSource = { url: string; parse: (data: unknown) => number };

/** Ordered list of price endpoints + parsers for DogePriceProvider. */
export function getOrderedDogePriceSources(): OrderedDogePriceSource[] {
  const { sources } = getDogePriceSourceConfig();
  const byId = new Map(DOGE_PRICE_SOURCE_LIST.map((s) => [s.id, s]));
  const out: OrderedDogePriceSource[] = [];
  for (const id of sources) {
    const row = byId.get(id);
    if (row) out.push({ url: row.url, parse: PARSERS[id] });
  }
  return out;
}

export function setDogePriceSourceConfig(config: DogePriceSourceConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DOGE_PRICE_SOURCES_CHANGED_EVENT));
    }
  } catch {
    // ignore
  }
}
