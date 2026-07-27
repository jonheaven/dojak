// API utilities for wallet-agnostic data providers (indexer / RPC gateway)
import axios from 'axios';
import { getEnv } from './env';

export type WalletDataProviderType = 'mydoge' | 'dogex' | 'commanddog';

function normalizeWalletDataProvider(value: unknown): WalletDataProviderType {
  // Legacy: wzrd.dog alias → dogex indexer (MyDoge-compat routes on dogex host)
  if (value === 'wzrd' || value === 'dogex') return 'dogex';
  if (value === 'commanddog') return 'commanddog';
  return 'mydoge';
}

export interface WalletDataProviderConfig {
  walletDataProvider: WalletDataProviderType;
  walletDataProviderUrl?: string;
  /** Same-origin indexer proxy (e.g. `/api/indexer` on dogenals.com, `/__indexer` on Dojakweb dev). */
  indexerApiBase?: string;
  /** Optional override for command.dog API (dogenals passes `/api/commanddog`). */
  commandDogApiBase?: string;
  /** Same-origin wonky-dogeord proxy (e.g. `/api/wonky` on dogenals.com). Used for Dunes address balances. */
  wonkyOrdApiBase?: string;
  /** When true, fall back to wonky-dogeord if dogex returns no dune address balances. Default false. */
  wonkyOrdFallback?: boolean;
  /**
   * When true (default), merge [InuBits](https://inubits.com/api/wallet/inscriptions) wallet inscription results
   * with the primary provider. InuBits indexes text/plain and other types MyDoge may omit.
   */
  mergeInuBitsInscriptions: boolean;
  /**
   * When true, hide text/* and application/json inscriptions from the NFT grid
   * (lotto tickets, protocols, plain text). Default false.
   */
  hideTextJsonInscriptions?: boolean;
  /** Public dogex CDN origin for inscription thumbnails (e.g. https://cdn.example.com). */
  dogexCdnBase?: string;
}

const WALLET_PROVIDER_STORAGE_KEY = 'dojakweb-wallet-data-provider';
/** One-time migration: older hosts stamped commanddog; reset to MyDoge defaults once. */
const WALLET_PROVIDER_DEFAULTS_MIGRATION_KEY = 'dojakweb-wallet-data-provider-defaults-v2';

/** Fired on `window` after `setWalletDataProviderConfig` (same-tab; `storage` only fires in other tabs). */
export const WALLET_DATA_PROVIDER_CHANGED_EVENT = 'dojakweb-wallet-data-provider-changed';
const DEFAULT_MYDOGE_PROVIDER_URL = 'https://api.mydoge.com';
const INUBITS_WALLET_INSCRIPTIONS_PATH = '/api/wallet/inscriptions';

/** Canonical factory defaults — MyDoge public API, no custom URL override. */
export function getFactoryWalletDataProviderConfig(): WalletDataProviderConfig {
  return {
    walletDataProvider: 'mydoge',
    walletDataProviderUrl: DEFAULT_MYDOGE_PROVIDER_URL,
    mergeInuBitsInscriptions: true,
  };
}

function urlsMatch(a?: string | null, b?: string | null): boolean {
  return normalizeBaseUrl(a) === normalizeBaseUrl(b);
}

/**
 * True when the stored/active URL is empty or equals the provider's built-in default
 * (i.e. user has not set a custom API base).
 */
export function isDefaultWalletDataProviderUrl(
  provider: WalletDataProviderType,
  url?: string | null,
): boolean {
  const normalized = normalizeBaseUrl(url);
  if (!normalized) return true;
  return urlsMatch(normalized, getDefaultWalletDataProviderUrl(provider));
}

type InubitsWindow = Window & {
  __DOJAKWEB_INUBITS_API_BASE__?: string;
};

/**
 * InuBits does not send CORS headers. Call it via a same-origin path proxied to inubits.com:
 * - Dojakweb Vite dev: `vite.config.ts` → `/__inubits` → https://inubits.com
 * - Next.js hosts: `rewrites` `/__inubits/:path*` → https://inubits.com/:path*
 *
 * Production builds set `import.meta.env.DEV === false`, so we cannot rely on
 * DEV; in the browser we default to `origin/__inubits` and expect the host to proxy.
 *
 * Override: `VITE_INUBITS_API_BASE` / `NEXT_PUBLIC_INUBITS_API_BASE` (absolute URL, or path
 * like `/__inubits`), or `window.__DOJAKWEB_INUBITS_API_BASE__` at runtime.
 */
function getInubitsWalletInscriptionsBase(): string {
  if (typeof window !== 'undefined') {
    const w = window as InubitsWindow;
    const custom = typeof w.__DOJAKWEB_INUBITS_API_BASE__ === 'string' ? w.__DOJAKWEB_INUBITS_API_BASE__.trim() : '';
    if (custom) {
      if (/^https?:\/\//i.test(custom)) return normalizeBaseUrl(custom);
      const path = custom.startsWith('/') ? custom : `/${custom}`;
      return normalizeBaseUrl(new URL(path, window.location.origin).href);
    }
  }

  const viteEnv =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_INUBITS_API_BASE
      ? String(import.meta.env.VITE_INUBITS_API_BASE).trim()
      : '';
  const nextEnv =
    typeof process !== 'undefined' && typeof process.env?.NEXT_PUBLIC_INUBITS_API_BASE === 'string'
      ? process.env.NEXT_PUBLIC_INUBITS_API_BASE.trim()
      : '';
  const fromEnv = normalizeBaseUrl(viteEnv || nextEnv);
  if (fromEnv) {
    if (typeof window !== 'undefined' && fromEnv.startsWith('/')) {
      return normalizeBaseUrl(new URL(fromEnv, window.location.origin).href);
    }
    return fromEnv;
  }

  if (typeof window !== 'undefined') {
    return normalizeBaseUrl(new URL('/__inubits', window.location.origin).href);
  }

  return 'https://inubits.com';
}

const normalizeBaseUrl = (value?: string | null): string => (value || '').trim().replace(/\/$/, '');

/**
 * Same-origin proxy path (Vite dev + optional Vercel rewrite) so browser `fetch` avoids cross-origin
 * failures (privacy tools, flaky CORP, etc.) when calling Command.dog.
 */
export const COMMAND_DOG_DEV_PROXY_PATH = '/__commanddog';

/** Public command.dog API (tunnel or production). Override with `VITE_COMMAND_DOG_API_URL` or `NEXT_PUBLIC_COMMAND_DOG_API_URL` (e.g. Vite hosts using process.env injection). */
export function getCommandDogApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const cfg = getWalletDataProviderConfig();
    if (cfg.commandDogApiBase) return cfg.commandDogApiBase;
  }
  const fromEnv = normalizeBaseUrl(
    getEnv('VITE_COMMAND_DOG_API_URL', '') || getEnv('NEXT_PUBLIC_COMMAND_DOG_API_URL', '')
  );
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    return normalizeBaseUrl(new URL(COMMAND_DOG_DEV_PROXY_PATH, window.location.origin).href);
  }
  return 'https://api.command.dog';
}

/** Indexer HTTP root for ÐogeTreats / doginals read APIs. */
export function getIndexerApiBase(): string {
  if (typeof window !== 'undefined') {
    const cfg = getWalletDataProviderConfig();
    if (cfg.indexerApiBase) return cfg.indexerApiBase;
    return normalizeBaseUrl(new URL('/__indexer', window.location.origin).href);
  }
  const fromEnv = normalizeBaseUrl(
    getEnv('VITE_MARKETPLACE_API_BASE', '') || getEnv('NEXT_PUBLIC_MARKETPLACE_API_BASE', '')
  );
  return fromEnv || 'https://indexer.command.dog';
}

/** wonky-dogeord HTTP root — Dunes UTXO balances (dogex proxies here server-side too). */
export function getWonkyOrdApiBase(): string {
  if (typeof window !== 'undefined') {
    const cfg = getWalletDataProviderConfig();
    if (cfg.wonkyOrdApiBase) return cfg.wonkyOrdApiBase;
    return normalizeBaseUrl(new URL('/api/wonky', window.location.origin).href);
  }
  const fromEnv = normalizeBaseUrl(
    getEnv('VITE_WONKY_ORD_URL', '') || getEnv('NEXT_PUBLIC_WONKY_ORD_URL', '')
  );
  return fromEnv || 'https://wonky-ord.dogeord.io';
}

function mapWonkyDuneHoldings(payload: unknown): DuneHolding[] {
  const root = payload as { dunes?: unknown[]; balances?: unknown[] };
  const rows = Array.isArray(root?.dunes)
    ? root.dunes
    : Array.isArray(root?.balances)
      ? root.balances
      : Array.isArray(payload)
        ? (payload as unknown[])
        : [];
  return rows.map((row: any) => ({
    dune: String(row?.dune ?? row?.spaced_dune ?? row?.name ?? row?.ticker ?? ''),
    ticker: String(row?.ticker ?? row?.dune ?? row?.name ?? ''),
    balance: String(row?.total_balance ?? row?.balance ?? row?.amount ?? '0'),
    amount: String(row?.total_balance ?? row?.amount ?? row?.balance ?? '0'),
    symbol: row?.symbol != null ? String(row.symbol) : undefined,
  }));
}

async function fetchDunesFromIndexer(address: string): Promise<DuneHolding[]> {
  const base = getIndexerApiBase().replace(/\/+$/, '');
  const url = `${base}/api/doginals/dunes/balance/${encodeURIComponent(address)}?list_dunes=true`;
  try {
    const res = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    return mapWonkyDuneHoldings(data);
  } catch {
    return [];
  }
}

async function fetchDunesFromWonky(address: string): Promise<DuneHolding[]> {
  const base = getWonkyOrdApiBase().replace(/\/+$/, '');
  const url = `${base}/dunes/balance/${encodeURIComponent(address)}?list_dunes=true`;
  const data = await fetchJson(url);
  return mapWonkyDuneHoldings(data);
}

/** Path for `POST` body `{ hex }` → `{ txid }` (see command.dog/api `http_tx_broadcast`). */
export const COMMAND_DOG_TX_BROADCAST_PATH = '/v1/tx/broadcast';

/** `GET` — Smart fee in koinu/kB from Core behind Command.dog (`estimatesmartfee` / `estimatefee`). */
export const COMMAND_DOG_FEE_ESTIMATE_PATH = '/v1/chain/fee-estimate';

/** `GET` — Core-backed tx status (confirmations + mempool) from the same node as broadcast. */
export function commandDogTxStatusPath(txid: string): string {
  const id = txid.trim();
  return `/v1/tx/${encodeURIComponent(id)}/status`;
}

export interface CommandDogTxStatusBody {
  txid: string;
  known: boolean;
  confirmations?: number;
  in_block?: boolean;
  in_mempool?: boolean;
}

/** `GET /v1/tx/{txid}/mempool` — Core `getmempoolentry` summary. */
export interface CommandDogTxMempoolBody {
  txid: string;
  in_mempool: boolean;
  bip125_replaceable?: boolean;
  time_unix?: number;
  fee_rate_koinu_per_kb?: number | null;
}

export function commandDogTxMempoolPath(txid: string): string {
  const id = txid.trim();
  return `/v1/tx/${encodeURIComponent(id)}/mempool`;
}

/**
 * Poll command.dog for mempool/chain state of a txid (no Blockchair).
 * Returns `null` on network/parse errors; `{ known: false }` means Core does not know this tx.
 */
export async function fetchCommandDogTxStatus(txid: string): Promise<CommandDogTxStatusBody | null> {
  const base = getCommandDogApiBaseUrl().trim().replace(/\/$/, '');
  const id = txid.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(id)) return null;
  try {
    const res = await fetch(`${base}${commandDogTxStatusPath(id)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as Partial<CommandDogTxStatusBody> | null;
    if (!data || typeof data.known !== 'boolean' || typeof data.txid !== 'string') return null;
    return data as CommandDogTxStatusBody;
  } catch {
    return null;
  }
}

/**
 * Mempool feerate / BIP125 / age from Command.dog (same Core as broadcast). Returns `in_mempool: false` if not in node's mempool.
 */
export async function fetchCommandDogTxMempoolEntry(txid: string): Promise<CommandDogTxMempoolBody | null> {
  const base = getCommandDogApiBaseUrl().trim().replace(/\/$/, '');
  const id = txid.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(id)) return null;
  try {
    const res = await fetch(`${base}${commandDogTxMempoolPath(id)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as Partial<CommandDogTxMempoolBody> | null;
    if (!data || typeof data.in_mempool !== 'boolean' || typeof data.txid !== 'string') return null;
    return data as CommandDogTxMempoolBody;
  } catch {
    return null;
  }
}

export const getDefaultWalletDataProviderUrl = (provider: WalletDataProviderType): string => {
  if (provider === 'dogex') return getIndexerApiBase();
  if (provider === 'commanddog') return getCommandDogApiBaseUrl();
  return DEFAULT_MYDOGE_PROVIDER_URL;
};

/** CDN base for dogex `/cdn/content/:id` (env or same as indexer). */
export function getDogexCdnBase(): string {
  if (typeof window !== 'undefined') {
    const cfg = getWalletDataProviderConfig();
    if (cfg.dogexCdnBase) return normalizeBaseUrl(cfg.dogexCdnBase);
  }
  const fromEnv = normalizeBaseUrl(getEnv('VITE_DOGEX_CDN_BASE', '') || getEnv('NEXT_PUBLIC_DOGEX_CDN_BASE', ''));
  if (fromEnv) return fromEnv;
  return getIndexerApiBase();
}

export function dogexCdnContentUrl(inscriptionId: string): string {
  const base = getDogexCdnBase().replace(/\/+$/, '');
  const id = inscriptionId.trim();
  return `${base}/cdn/content/${encodeURIComponent(id)}`;
}

export const getWalletDataProviderConfig = (): WalletDataProviderConfig => {
  if (typeof window === 'undefined') {
    return getFactoryWalletDataProviderConfig();
  }

  try {
    const raw = window.localStorage.getItem(WALLET_PROVIDER_STORAGE_KEY);
    if (!raw) {
      return getFactoryWalletDataProviderConfig();
    }

    const parsed = JSON.parse(raw) as Partial<WalletDataProviderConfig>;
    const walletDataProvider = normalizeWalletDataProvider(parsed.walletDataProvider);
    // Custom URL only when stored and different from the provider default.
    // Empty / missing / default-equivalent → built-in MyDoge (or provider) URL at runtime.
    const storedUrl = normalizeBaseUrl(parsed.walletDataProviderUrl);
    const defaultUrl = getDefaultWalletDataProviderUrl(walletDataProvider);
    const walletDataProviderUrl =
      storedUrl && !urlsMatch(storedUrl, defaultUrl) ? storedUrl : defaultUrl;
    const mergeInuBitsInscriptions = parsed.mergeInuBitsInscriptions !== false;
    const hideTextJsonInscriptions = parsed.hideTextJsonInscriptions === true;
    const indexerApiBase = normalizeBaseUrl(parsed.indexerApiBase) || undefined;
    const commandDogApiBase = normalizeBaseUrl(parsed.commandDogApiBase) || undefined;
    const dogexCdnBase = normalizeBaseUrl(parsed.dogexCdnBase) || undefined;
    const wonkyOrdApiBase = normalizeBaseUrl(parsed.wonkyOrdApiBase) || undefined;
    const wonkyOrdFallback =
      typeof parsed.wonkyOrdFallback === 'boolean' ? parsed.wonkyOrdFallback : undefined;

    return {
      walletDataProvider,
      walletDataProviderUrl,
      mergeInuBitsInscriptions,
      hideTextJsonInscriptions,
      indexerApiBase,
      commandDogApiBase,
      dogexCdnBase,
      wonkyOrdApiBase,
      wonkyOrdFallback,
    };
  } catch {
    return getFactoryWalletDataProviderConfig();
  }
};

/**
 * Persist wallet data settings.
 * Omits `walletDataProviderUrl` from storage when it is empty or equals the provider default
 * so Settings stays "no custom API" for the default MyDoge path.
 * Hosts may pass partial updates; unspecified keys are preserved from current storage.
 */
export const setWalletDataProviderConfig = (
  config: Partial<WalletDataProviderConfig> & Pick<WalletDataProviderConfig, 'walletDataProvider'>,
) => {
  if (typeof window === 'undefined') return;

  const current = getWalletDataProviderConfig();
  const walletDataProvider = normalizeWalletDataProvider(
    config.walletDataProvider ?? current.walletDataProvider,
  );
  const defaultUrl = getDefaultWalletDataProviderUrl(walletDataProvider);

  // Prefer explicit config URL (including empty string = clear custom).
  // If key omitted, keep current only when still non-default for this provider.
  let nextUrl: string | undefined;
  if (Object.prototype.hasOwnProperty.call(config, 'walletDataProviderUrl')) {
    const raw = normalizeBaseUrl(config.walletDataProviderUrl);
    nextUrl = raw && !urlsMatch(raw, defaultUrl) ? raw : undefined;
  } else {
    const cur = normalizeBaseUrl(current.walletDataProviderUrl);
    nextUrl = cur && !urlsMatch(cur, defaultUrl) ? cur : undefined;
  }

  const mergeInuBitsInscriptions =
    typeof config.mergeInuBitsInscriptions === 'boolean'
      ? config.mergeInuBitsInscriptions
      : current.mergeInuBitsInscriptions !== false;

  const hideTextJsonInscriptions =
    typeof config.hideTextJsonInscriptions === 'boolean'
      ? config.hideTextJsonInscriptions
      : current.hideTextJsonInscriptions === true;

  const indexerApiBase =
    config.indexerApiBase !== undefined
      ? normalizeBaseUrl(config.indexerApiBase) || undefined
      : current.indexerApiBase;
  const commandDogApiBase =
    config.commandDogApiBase !== undefined
      ? normalizeBaseUrl(config.commandDogApiBase) || undefined
      : current.commandDogApiBase;
  const dogexCdnBase =
    config.dogexCdnBase !== undefined
      ? normalizeBaseUrl(config.dogexCdnBase) || undefined
      : current.dogexCdnBase;
  const wonkyOrdApiBase =
    config.wonkyOrdApiBase !== undefined
      ? normalizeBaseUrl(config.wonkyOrdApiBase) || undefined
      : current.wonkyOrdApiBase;
  const wonkyOrdFallback =
    typeof config.wonkyOrdFallback === 'boolean'
      ? config.wonkyOrdFallback
      : current.wonkyOrdFallback;

  const payload: Record<string, unknown> = {
    walletDataProvider,
    mergeInuBitsInscriptions,
    hideTextJsonInscriptions,
  };
  // Only persist a custom URL override — never stamp the built-in default into localStorage.
  if (nextUrl) {
    payload.walletDataProviderUrl = nextUrl;
  }
  if (indexerApiBase) payload.indexerApiBase = indexerApiBase;
  if (commandDogApiBase) payload.commandDogApiBase = commandDogApiBase;
  if (dogexCdnBase) payload.dogexCdnBase = dogexCdnBase;
  if (wonkyOrdApiBase) payload.wonkyOrdApiBase = wonkyOrdApiBase;
  if (typeof wonkyOrdFallback === 'boolean') payload.wonkyOrdFallback = wonkyOrdFallback;

  window.localStorage.setItem(WALLET_PROVIDER_STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent(WALLET_DATA_PROVIDER_CHANGED_EVENT));
};

/**
 * Ensure factory defaults (MyDoge, no custom URL) for first-time / migrated hosts.
 * Older dogecoin.games builds forced `commanddog` into localStorage every load — flip once.
 * Safe to call on every app boot; runs migration at most once per browser profile.
 */
export function ensureDefaultWalletDataProvider(): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.localStorage.getItem(WALLET_PROVIDER_DEFAULTS_MIGRATION_KEY) === '1') {
      return;
    }
    window.localStorage.setItem(WALLET_PROVIDER_DEFAULTS_MIGRATION_KEY, '1');

    const raw = window.localStorage.getItem(WALLET_PROVIDER_STORAGE_KEY);
    if (!raw) {
      setWalletDataProviderConfig({
        walletDataProvider: 'mydoge',
        walletDataProviderUrl: undefined,
        mergeInuBitsInscriptions: true,
      });
      return;
    }

    let parsed: Partial<WalletDataProviderConfig> = {};
    try {
      parsed = JSON.parse(raw) as Partial<WalletDataProviderConfig>;
    } catch {
      setWalletDataProviderConfig({
        walletDataProvider: 'mydoge',
        walletDataProviderUrl: undefined,
        mergeInuBitsInscriptions: true,
      });
      return;
    }

    const provider = normalizeWalletDataProvider(parsed.walletDataProvider);
    // Hosts commonly forced commanddog; reset those profiles to MyDoge defaults once.
    // Leave dogex alone if the user explicitly chose it.
    if (provider === 'commanddog' || !parsed.walletDataProvider) {
      setWalletDataProviderConfig({
        walletDataProvider: 'mydoge',
        walletDataProviderUrl: undefined,
        mergeInuBitsInscriptions: parsed.mergeInuBitsInscriptions !== false,
        indexerApiBase: parsed.indexerApiBase,
        commandDogApiBase: parsed.commandDogApiBase,
        dogexCdnBase: parsed.dogexCdnBase,
        wonkyOrdApiBase: parsed.wonkyOrdApiBase,
        wonkyOrdFallback: parsed.wonkyOrdFallback,
      });
      return;
    }

    // Strip a stored URL that is just the provider default (cleanup UI "custom URL" noise).
    if (isDefaultWalletDataProviderUrl(provider, parsed.walletDataProviderUrl)) {
      setWalletDataProviderConfig({
        walletDataProvider: provider,
        walletDataProviderUrl: undefined,
        mergeInuBitsInscriptions: parsed.mergeInuBitsInscriptions !== false,
        indexerApiBase: parsed.indexerApiBase,
        commandDogApiBase: parsed.commandDogApiBase,
        dogexCdnBase: parsed.dogexCdnBase,
        wonkyOrdApiBase: parsed.wonkyOrdApiBase,
        wonkyOrdFallback: parsed.wonkyOrdFallback,
      });
    }
  } catch {
    /* ignore quota / private mode */
  }
}

const getWalletProviderBaseUrl = () => {
  const config = getWalletDataProviderConfig();
  if (config.walletDataProvider === 'dogex') {
    return normalizeBaseUrl(config.indexerApiBase || config.walletDataProviderUrl) || getIndexerApiBase();
  }
  return normalizeBaseUrl(config.walletDataProviderUrl)
    || getDefaultWalletDataProviderUrl(config.walletDataProvider);
};

const API_BASE_URL = getEnv('VITE_WALLET_DATA_API_BASE_URL', 'http://localhost:3001/api').replace(/\/$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use((config) => config);
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.message?.includes('Network Error') || !error.config?.url?.includes('localhost')) {
      console.error('API Error:', error);
    }
    return Promise.reject(error);
  }
);

export interface MyDogeInscription {
  address: string;
  content: string;
  contentBody: string;
  contentLength: number;
  contentType: string;
  genesisTransaction: string;
  inscriptionId: string;
  inscriptionNumber: number;
  output: string;
  outputValue: string;
  preview: string;
  timestamp: number;
  height: number;
  location: string;
}

export interface MyDogeInscriptionsResponse {
  list: MyDogeInscription[];
  total: number;
}

export interface DRC20Token {
  ticker: string;
  balance: string;
  transferable: string;
  available: string;
  inscriptionId?: string;
  content?: any;
}

export interface DogeTransaction {
  txid: string;
  type: 'sent' | 'received';
  amount: number; // DOGE, always positive
  address: string; // counterparty address
  confirmations: number;
  timestamp: string; // e.g. "2026-04-10 14:35:45"
  pending: boolean;
}

export interface DogeTransactionsPage {
  transactions: DogeTransaction[];
  total: number;
}

export interface DuneHolding {
  dune?: string;
  ticker?: string;
  balance: string;
  amount?: string;
  symbol?: string;
}

export interface DuneTermsInfo {
  amount?: string;
  cap?: string;
  heightStart?: number;
  heightEnd?: number;
  offsetStart?: number;
  offsetEnd?: number;
}

export interface DuneInfo {
  id: string;       // "block:tx"
  name: string;     // spaced name, e.g. "DOGE•COIN"
  divisibility: number;
  symbol?: string;
  supply?: string;
  mints?: string;
  burned?: string;
  premine?: string;
  turbo?: boolean;
  block?: number;
  etching?: string; // txid
  terms?: DuneTermsInfo;
  mintable?: boolean;
}

export interface WalletInfo {
  balance: number;
  balanceSatoshis: number;
  address: string;
  totalUtxos?: number;
}

export interface DRC20ApiResponse {
  balances: Array<{
    ticker: string;
    availableBalance: string;
    transferableBalance: string;
    overallBalance: string;
    protocol: string;
  }>;
  total: number;
  last_updated: {
    block_hash: string;
    block_height: number;
  };
}

const fetchJson = async (
  url: string,
  opts?: { networkErrorMessage?: string },
): Promise<any> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Request failed (${response.status}): ${errorText || response.statusText}`);
    }
    return response.json();
  } catch (error: any) {
    if (error instanceof TypeError) {
      throw new Error(
        opts?.networkErrorMessage ??
          'Balance service is unavailable. Please retry in a moment.',
      );
    }
    throw error;
  }
};

const resolveAddress = async (walletOrAddress: any): Promise<string> => {
  if (typeof walletOrAddress === 'string' && walletOrAddress.trim()) {
    return walletOrAddress;
  }
  if (walletOrAddress && typeof walletOrAddress.getAddress === 'function') {
    const addr = await Promise.resolve(walletOrAddress.getAddress());
    if (typeof addr === 'string' && addr.trim()) return addr;
  }
  if (walletOrAddress && typeof walletOrAddress.address === 'string' && walletOrAddress.address.trim()) {
    return walletOrAddress.address;
  }
  throw new Error('Wallet address not available');
};

const extractArray = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.balances)) return data.balances;
  if (Array.isArray(data?.utxos)) return data.utxos;
  if (Array.isArray(data?.result)) return data.result;
  return [];
};

const getWalletEndpoint = (path: string, address: string) => `${getWalletProviderBaseUrl()}${path}${encodeURIComponent(address)}`;

const mapWalletInfo = (address: string, data: any): WalletInfo => {
  const nested = data?.wallet || data?.data || data?.result || data;
  const balanceSatoshis = Number(
    nested?.balanceSatoshis
    ?? nested?.confirmedBalance
    ?? nested?.balance
    ?? nested?.spendable
    ?? nested?.value
    ?? 0
  );

  return {
    address,
    balanceSatoshis,
    balance: balanceSatoshis / 100000000,
    totalUtxos: Number((nested?.utxoCount ?? nested?.totalUtxos ?? nested?.utxos ?? 0)) || undefined,
  };
};

export const claimsApi = {
  getActive: (address: string) => api.get('/claims/active', { params: { address } }),
  claim: (launchId: string, data: any) => api.post(`/launches/${launchId}/claim`, data),
};

export const launchesApi = {
  create: (launchData: any) => api.post('/launches', launchData),
  getAll: () => api.get('/launches'),
  getById: (id: string) => api.get(`/launches/${id}`),
  update: (id: string, data: any) => api.put(`/launches/${id}`, data),
};

const isBackendAvailable = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Doginals inscription id: 64-char genesis txid (hex) + `i` + index (e.g. `…e0dbi0`).
 * Some events mistakenly append a UTXO vout (`:1`) after the id; MyDoge then 400s. Strip that suffix.
 */
export function normalizeDoginalInscriptionId(raw: string): string {
  const t = raw.trim();
  const m = t.match(/^([0-9a-fA-F]{64}i\d+)(:\d+)$/);
  return m ? m[1] : t;
}

/**
 * Single inscription metadata from the active wallet data provider (e.g. MyDoge `GET /inscription/{id}`).
 * Shape matches public indexer JSON; fields may be partial on some hosts.
 */
export type InscriptionLookupResult = Pick<
  MyDogeInscription,
  'inscriptionId' | 'inscriptionNumber' | 'contentType' | 'content' | 'preview' | 'genesisTransaction'
> &
  Partial<MyDogeInscription>;

function normalizeOutpointKey(raw: string): string {
  const t = raw.trim();
  const idx = t.lastIndexOf(':');
  if (idx <= 0) return t.toLowerCase();
  const tx = t.slice(0, idx).toLowerCase();
  const v = t.slice(idx + 1);
  return `${tx}:${v}`;
}

function genesisTxFromInscriptionId(id: string): string {
  const t = normalizeDoginalInscriptionId(id);
  const m = t.match(/^([0-9a-fA-F]{64})i\d+$/);
  return m ? m[1] : t.slice(0, 64);
}

interface InubitsWalletInscriptionRow {
  inscriptionId?: string;
  inscriptionNumber?: number;
  txid?: string;
  vout?: number;
  address?: string;
  value?: number;
  contentType?: string;
  contentLength?: number;
  contentUrl?: string;
  timestamp?: number;
  genesisHeight?: number;
}

function mapInubitsRowToMyDoge(row: InubitsWalletInscriptionRow, walletAddress: string): MyDogeInscription | null {
  const txid = String(row.txid ?? '').trim();
  const vout = Number(row.vout);
  const inscriptionId = normalizeDoginalInscriptionId(String(row.inscriptionId ?? ''));
  if (!txid || !Number.isInteger(vout) || vout < 0 || !inscriptionId) return null;
  const out = `${txid.toLowerCase()}:${vout}`;
  const path = row.contentUrl ? String(row.contentUrl) : '';
  // Prefer same-origin `/__inubits` proxy — raw inubits.com has no CORS for browser body fetch.
  const inubitsBase = getInubitsWalletInscriptionsBase();
  const preview = path
    ? path.startsWith('http')
      ? (() => {
          try {
            const u = new URL(path);
            if (u.hostname === 'inubits.com' || u.hostname.endsWith('.inubits.com')) {
              return `${inubitsBase}${u.pathname}${u.search}`;
            }
          } catch {
            /* keep absolute */
          }
          return path;
        })()
      : `${inubitsBase}${path.startsWith('/') ? path : `/${path}`}`
    : '';
  // Prefer InuBits content URL; fall back to dogex CDN for body fetch in the UI.
  // Never throw here — a bad CDN base must not drop the whole InuBits merge (text tickets).
  let content = preview;
  if (!content) {
    try {
      content = dogexCdnContentUrl(inscriptionId);
    } catch {
      content = '';
    }
  }
  return {
    address: String(row.address ?? walletAddress),
    content,
    contentBody: '',
    contentLength: Number(row.contentLength ?? 0),
    contentType: String(row.contentType ?? ''),
    genesisTransaction: genesisTxFromInscriptionId(inscriptionId),
    inscriptionId,
    inscriptionNumber: Number(row.inscriptionNumber ?? 0),
    output: out,
    outputValue: String(row.value ?? 100_000),
    preview: content || preview,
    timestamp: Number(row.timestamp ?? 0),
    height: Number(row.genesisHeight ?? 0),
    location: out,
  };
}

function mergeInscriptionListsById(primary: MyDogeInscription[], secondary: MyDogeInscription[]): MyDogeInscription[] {
  const byId = new Map<string, MyDogeInscription>();
  for (const p of primary) {
    const id = normalizeDoginalInscriptionId(String(p.inscriptionId ?? ''));
    if (!id) continue;
    const rawOut = p.output || p.location;
    byId.set(id.toLowerCase(), {
      ...p,
      inscriptionId: id,
      ...(rawOut
        ? {
            output: normalizeOutpointKey(rawOut),
            location: normalizeOutpointKey(p.location || rawOut),
          }
        : {}),
    });
  }
  for (const s of secondary) {
    const id = normalizeDoginalInscriptionId(String(s.inscriptionId ?? ''));
    if (!id) continue;
    const k = id.toLowerCase();
    if (!byId.has(k)) byId.set(k, s);
  }
  return [...byId.values()];
}

const isCommandDogWalletDataProvider = (): boolean =>
  getWalletDataProviderConfig().walletDataProvider === 'commanddog';

async function fetchInubitsWalletInscriptions(address: string): Promise<MyDogeInscription[]> {
  const base = getInubitsWalletInscriptionsBase();
  const url = `${base}${INUBITS_WALLET_INSCRIPTIONS_PATH}?address=${encodeURIComponent(address)}`;
  const data = await fetchJson(url, {
    networkErrorMessage:
      'Could not reach InuBits. The API blocks browser CORS — proxy `/__inubits/*` to `https://inubits.com/*` on your dev server (Dojakweb Vite and dogex Next config do this), or set NEXT_PUBLIC_INUBITS_API_BASE / VITE_INUBITS_API_BASE to your proxy URL. You can turn off “Merge InuBits inscriptions” in wallet settings to skip this request.',
  });
  if (!data || data.success !== true || !Array.isArray(data.inscriptions)) return [];
  const out: MyDogeInscription[] = [];
  for (const row of data.inscriptions as InubitsWalletInscriptionRow[]) {
    try {
      const m = mapInubitsRowToMyDoge(row, address);
      if (m) out.push(m);
    } catch (err) {
      console.warn('[walletDataApi] skip InuBits inscription row', err);
    }
  }
  return out;
}

export const walletDataApi = {
  fetchWalletInfo: async (address: string): Promise<WalletInfo> => {
    if (isCommandDogWalletDataProvider()) {
      const base = getWalletProviderBaseUrl();
      const data = await fetchJson(`${base}/v1/address/${encodeURIComponent(address)}`);
      return mapWalletInfo(address, data);
    }
    const data = await fetchJson(getWalletEndpoint('/wallet/info?route=/address/', address));
    return mapWalletInfo(address, data);
  },

  /** Resolve inscription id against Dojakweb wallet settings (MyDoge / custom URL / wzrd). Returns null if unknown. */
  fetchInscriptionById: async (inscriptionId: string): Promise<InscriptionLookupResult | null> => {
    const base = getWalletProviderBaseUrl();
    const id = normalizeDoginalInscriptionId(inscriptionId);
    const path = isCommandDogWalletDataProvider() ? '/v1/inscription/' : '/inscription/';
    const url = `${base}${path}${encodeURIComponent(id)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = (await res.json()) as InscriptionLookupResult;
      if (!data?.inscriptionId && id) {
        return { ...data, inscriptionId: id };
      }
      return data;
    } catch {
      return null;
    }
  },

  fetchInscriptions: async (address: string): Promise<MyDogeInscription[]> => {
    if (isCommandDogWalletDataProvider()) {
      // dogex chain truth: GET /api/doginals/address/:addr/inscriptions
      try {
        const indexerBase = getIndexerApiBase().replace(/\/+$/, '');
        const res = await fetch(
          `${indexerBase}/api/doginals/address/${encodeURIComponent(address)}/inscriptions?limit=100`,
        );
        if (!res.ok) return [];
        const payload = await res.json() as any;
        const rows: any[] = Array.isArray(payload?.inscriptions)
          ? payload.inscriptions
          : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload?.data)
              ? payload.data
              : Array.isArray(payload)
                ? payload
                : [];
        return rows.map((row: any) => ({
          inscriptionId: row.inscriptionId ?? row.id ?? row.inscription_id ?? '',
          inscriptionNumber: row.inscriptionNumber ?? row.number ?? row.inscription_number ?? 0,
          contentType: row.contentType ?? row.content_type ?? 'image/png',
          contentLength: row.contentLength ?? row.content_length,
          content: null,
          ownerAddress: row.ownerAddress ?? row.owner ?? row.address ?? address,
          collectionSymbol: row.collectionId ?? row.collectionSlug ?? '',
          collectionName: row.collectionName ?? '',
          itemName: row.itemName ?? row.name ?? '',
          listed: Boolean(row.listed),
          price: row.price ?? null,
          status: row.status ?? '',
        } as MyDogeInscription));
      } catch {
        return [];
      }
    }
    const data = await fetchJson(getWalletEndpoint('/inscriptions/', address));
    const primary = extractArray(data) as MyDogeInscription[];
    const { mergeInuBitsInscriptions } = getWalletDataProviderConfig();
    if (mergeInuBitsInscriptions === false) {
      return primary;
    }
    try {
      const fromInu = await fetchInubitsWalletInscriptions(address);
      return mergeInscriptionListsById(primary, fromInu);
    } catch (e) {
      console.warn('[walletDataApi] InuBits inscription merge failed', e);
      return primary;
    }
  },

  fetchDRC20Tokens: async (walletOrAddress: any): Promise<DRC20Token[]> => {
    if (isCommandDogWalletDataProvider()) {
      // Try kabosu indexer for DRC-20 holdings (endpoint added when kabosu gains DRC-20 support).
      // Falls back to an empty list if the endpoint doesn't exist yet.
      try {
        const address = await resolveAddress(walletOrAddress);
        const base = typeof window !== 'undefined' ? window.location.origin : 'https://indexer.command.dog';
        const indexerBase = `${base}/__indexer`;
        const res = await fetch(`${indexerBase}/v1/drc20/${encodeURIComponent(address)}`);
        if (!res.ok) return [];
        const payload = await res.json() as any;
        const balances: any[] = Array.isArray(payload?.balances) ? payload.balances
          : Array.isArray(payload) ? payload
          : [];
        return balances.map((b: any) => ({
          ticker: b.ticker ?? b.tick ?? 'UNKNOWN',
          balance: String(b.overallBalance ?? b.balance ?? b.amount ?? '0'),
          transferable: String(b.transferableBalance ?? b.transferable ?? '0'),
          available: String(b.availableBalance ?? b.available ?? '0'),
          inscriptionId: b.inscriptionId,
          content: b.content,
        }));
      } catch {
        return [];
      }
    }
    const address = await resolveAddress(walletOrAddress);
    const data = await fetchJson(getWalletEndpoint('/DRC20/', address)) as DRC20ApiResponse | any;
    const balances = extractArray(data);

    return balances.map((balance: any) => ({
      ticker: balance.ticker ?? balance.tick ?? 'UNKNOWN',
      balance: String(balance.overallBalance ?? balance.balance ?? balance.amount ?? '0'),
      transferable: String(balance.transferableBalance ?? balance.transferable ?? balance.availableBalance ?? '0'),
      available: String(balance.availableBalance ?? balance.available ?? balance.transferableBalance ?? '0'),
      inscriptionId: balance.inscriptionId,
      content: balance.content,
    }));
  },

  /** ÐogeTreats (`p:"dt"`) balances from dogex / indexer read API. */
  fetchTreatsBalances: async (address: string): Promise<Array<{ tick: string; balance: string }>> => {
    if (!address?.trim()) return [];
    try {
      const base = getIndexerApiBase();
      const res = await fetch(
        `${base.replace(/\/+$/, '')}/api/doginals/treats/balance/${encodeURIComponent(address)}`,
        { cache: 'no-store', headers: { Accept: 'application/json' } },
      );
      if (!res.ok) return [];
      const payload = (await res.json()) as { balances?: Array<{ tick: string; balance: string }> };
      return Array.isArray(payload.balances) ? payload.balances : [];
    } catch {
      return [];
    }
  },

  fetchDunes: async (address: string): Promise<DuneHolding[]> => {
    if (isCommandDogWalletDataProvider()) {
      const cfg = getWalletDataProviderConfig();
      const allowWonky =
        cfg.wonkyOrdFallback === true ||
        (typeof import.meta !== 'undefined' &&
          import.meta.env?.VITE_WONKY_ORD_FALLBACK === '1');

      // Prefer wonky when fallback is on — indexer.command.dog is often offline (502).
      if (allowWonky) {
        try {
          const fromWonky = await fetchDunesFromWonky(address);
          if (fromWonky.length > 0) return fromWonky;
        } catch {
          /* try indexer next */
        }
      }

      const fromDogex = await fetchDunesFromIndexer(address);
      if (fromDogex.length > 0 || !allowWonky) {
        return fromDogex;
      }
      try {
        return await fetchDunesFromWonky(address);
      } catch {
        return fromDogex;
      }
    }
    const data = await fetchJson(getWalletEndpoint('/Dunes/', address));
    const dunes = extractArray(data);
    return dunes.map((dune: any) => ({
      dune: dune.dune ?? dune.name ?? dune.ticker,
      ticker: dune.ticker ?? dune.symbol ?? dune.dune,
      balance: String(dune.balance ?? dune.amount ?? '0'),
      amount: String(dune.amount ?? dune.balance ?? '0'),
      symbol: dune.symbol,
    }));
  },

  fetchDuneInfo: async (name: string): Promise<DuneInfo | null> => {
    if (isCommandDogWalletDataProvider()) {
      const indexerBase = getIndexerApiBase().replace(/\/+$/, '');
      const cleaned = name.replace(/[.•\s]/g, '').toUpperCase();
      const indexerCandidates = [
        `${indexerBase}/api/doginals/dunes/dune/${encodeURIComponent(name)}`,
        `${indexerBase}/api/doginals/dunes/dune/${encodeURIComponent(cleaned)}`,
      ];
      for (const url of indexerCandidates) {
        try {
          const res = await fetch(url, { headers: { Accept: 'application/json' } });
          if (!res.ok) continue;
          const d = await res.json();
          if (!d || typeof d !== 'object') continue;
          const id = String(d.id ?? d.dune_id ?? d.duneId ?? '');
          if (!id) continue;
          return {
            id,
            name: String(d.spaced_name ?? d.name ?? name),
            divisibility: Number(d.divisibility ?? 0),
            symbol: d.symbol ? String(d.symbol) : undefined,
            supply: d.supply != null ? String(d.supply) : undefined,
            mints: d.mints != null ? String(d.mints) : undefined,
            burned: d.burned != null ? String(d.burned) : undefined,
            premine: d.premine != null ? String(d.premine) : undefined,
            turbo: Boolean(d.turbo),
            block: d.block != null ? Number(d.block) : undefined,
            etching: d.etching ? String(d.etching) : undefined,
            terms: d.terms ? {
              amount: d.terms.amount != null ? String(d.terms.amount) : undefined,
              cap: d.terms.cap != null ? String(d.terms.cap) : undefined,
              heightStart: d.terms.height?.[0] ?? d.terms.heightStart ?? undefined,
              heightEnd: d.terms.height?.[1] ?? d.terms.heightEnd ?? undefined,
              offsetStart: d.terms.offset?.[0] ?? d.terms.offsetStart ?? undefined,
              offsetEnd: d.terms.offset?.[1] ?? d.terms.offsetEnd ?? undefined,
            } : undefined,
            mintable: d.mintable != null ? Boolean(d.mintable) : (d.terms != null),
          };
        } catch {
          continue;
        }
      }
      const cfg = getWalletDataProviderConfig();
      const allowWonky =
        cfg.wonkyOrdFallback === true ||
        (typeof import.meta !== 'undefined' &&
          import.meta.env?.VITE_WONKY_ORD_FALLBACK === '1');
      if (!allowWonky) {
        return null;
      }
    }
    if (isCommandDogWalletDataProvider()) {
      const wonkyBase = getWonkyOrdApiBase().replace(/\/+$/, '');
      const cleaned = name.replace(/[.•\s]/g, '').toUpperCase();
      const candidates = [
        `${wonkyBase}/dune/${encodeURIComponent(name)}`,
        `${wonkyBase}/dune/${encodeURIComponent(cleaned)}`,
      ];
      for (const url of candidates) {
        try {
          const res = await fetch(url, { headers: { Accept: 'application/json' } });
          if (!res.ok) continue;
          const data = await res.json();
          const d = data?.dune ?? data?.data ?? data?.result ?? data;
          if (!d || typeof d !== 'object') continue;
          const id = String(d.id ?? d.duneId ?? d.dune_id ?? '');
          if (!id || !id.includes(':')) continue;
          return {
            id,
            name: String(d.name ?? d.spaced_name ?? d.spaced_dune ?? name),
            divisibility: Number(d.divisibility ?? 0),
            symbol: d.symbol ? String(d.symbol) : undefined,
            supply: d.supply != null ? String(d.supply) : undefined,
            mints: d.mints != null ? String(d.mints) : undefined,
            burned: d.burned != null ? String(d.burned) : undefined,
            premine: d.premine != null ? String(d.premine) : undefined,
            turbo: Boolean(d.turbo),
            block: d.block != null ? Number(d.block) : undefined,
            etching: d.etching ? String(d.etching) : undefined,
            terms: d.terms ? {
              amount: d.terms.amount != null ? String(d.terms.amount) : undefined,
              cap: d.terms.cap != null ? String(d.terms.cap) : undefined,
              heightStart: d.terms.height?.[0] ?? d.terms.heightStart ?? undefined,
              heightEnd: d.terms.height?.[1] ?? d.terms.heightEnd ?? undefined,
              offsetStart: d.terms.offset?.[0] ?? d.terms.offsetStart ?? undefined,
              offsetEnd: d.terms.offset?.[1] ?? d.terms.offsetEnd ?? undefined,
            } : undefined,
            mintable: d.mintable != null ? Boolean(d.mintable) : (d.terms != null),
          };
        } catch {
          continue;
        }
      }
      return null;
    }
    const base = getWalletProviderBaseUrl();
    const cleaned = name.replace(/[.•\s]/g, '').toUpperCase();
    // Try common provider path patterns for dune info
    const candidates = [
      `${base}/dune/${encodeURIComponent(name)}`,
      `${base}/dune/${encodeURIComponent(cleaned)}`,
      `${base}/Dune/${encodeURIComponent(name)}`,
    ];
    for (const url of candidates) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        const d = data?.dune ?? data?.data ?? data?.result ?? data;
        if (!d || typeof d !== 'object') continue;
        const id = String(d.id ?? d.duneId ?? d.dune_id ?? '');
        if (!id || !id.includes(':')) continue;
        return {
          id,
          name: String(d.name ?? d.spaced_name ?? d.spaced_dune ?? name),
          divisibility: Number(d.divisibility ?? 0),
          symbol: d.symbol ? String(d.symbol) : undefined,
          supply: d.supply != null ? String(d.supply) : undefined,
          mints: d.mints != null ? String(d.mints) : undefined,
          burned: d.burned != null ? String(d.burned) : undefined,
          premine: d.premine != null ? String(d.premine) : undefined,
          turbo: Boolean(d.turbo),
          block: d.block != null ? Number(d.block) : undefined,
          etching: d.etching ? String(d.etching) : undefined,
          terms: d.terms ? {
            amount: d.terms.amount != null ? String(d.terms.amount) : undefined,
            cap: d.terms.cap != null ? String(d.terms.cap) : undefined,
            heightStart: d.terms.height?.[0] ?? d.terms.heightStart ?? undefined,
            heightEnd: d.terms.height?.[1] ?? d.terms.heightEnd ?? undefined,
            offsetStart: d.terms.offset?.[0] ?? d.terms.offsetStart ?? undefined,
            offsetEnd: d.terms.offset?.[1] ?? d.terms.offsetEnd ?? undefined,
          } : undefined,
          mintable: d.mintable != null ? Boolean(d.mintable) : (d.terms != null),
        };
      } catch {
        continue;
      }
    }
    return null;
  },

  fetchBalance: async (address: string): Promise<number> => {
    const info = await walletDataApi.fetchWalletInfo(address);
    return info.balance;
  },

  /**
   * Confirmed UTXOs from the configured wallet data provider (MyDoge-compatible `/utxos/:address`).
   * Paginates via `next_cursor`. Never hits Blockchair/BlockCypher.
   * When the active provider is command.dog (no wallet UTXO list), uses the MyDoge public API.
   */
  fetchUtxosPaginated: async (
    address: string,
  ): Promise<
    Array<{
      txid: string;
      vout: number;
      value: number;
      confirmations?: number;
      scriptPubKey?: string;
    }>
  > => {
    const cfg = getWalletDataProviderConfig();
    // command.dog product API does not expose MyDoge-style /utxos — use MyDoge for coin selection.
    const base =
      cfg.walletDataProvider === 'commanddog'
        ? DEFAULT_MYDOGE_PROVIDER_URL
        : getWalletProviderBaseUrl();
    const collected: Array<{
      txid: string;
      vout: number;
      value: number;
      confirmations?: number;
      scriptPubKey?: string;
    }> = [];
    let cursor: string | null | undefined = undefined;
    const maxPages = 25;

    for (let page = 0; page < maxPages; page++) {
      const path = `${base.replace(/\/+$/, '')}/utxos/${encodeURIComponent(address)}`;
      const url =
        cursor == null || cursor === ''
          ? path
          : `${path}?cursor=${encodeURIComponent(String(cursor))}`;
      const data = await fetchJson(url, {
        networkErrorMessage: 'Wallet UTXO provider is unavailable. Please retry in a moment.',
      });
      const rows: any[] = Array.isArray(data?.utxos)
        ? data.utxos
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : [];

      for (const row of rows) {
        const conf = Number(row.confirmations ?? row.conf ?? 1);
        // Treat missing confirmations as confirmed (some providers omit the field).
        if (Number.isFinite(conf) && conf < 1) continue;
        const satRaw = row.satoshis ?? row.value ?? row.amount ?? row.sats;
        const sat =
          typeof satRaw === 'string' ? parseInt(satRaw, 10) : Number(satRaw);
        if (!Number.isFinite(sat) || sat <= 0) continue;
        const txid = String(row.txid ?? row.tx_hash ?? row.transaction_hash ?? '').trim();
        const vout = Number(row.vout ?? row.tx_output_n ?? row.index ?? row.n);
        if (!txid || !Number.isInteger(vout) || vout < 0) continue;
        collected.push({
          txid,
          vout,
          value: sat,
          confirmations: Number.isFinite(conf) ? conf : undefined,
          scriptPubKey: String(row.scriptPubKey ?? row.script ?? row.script_hex ?? '') || undefined,
        });
      }

      const next = data?.next_cursor ?? data?.nextCursor ?? null;
      if (next == null || next === '') break;
      cursor = String(next);
    }

    console.log('[walletDataApi] provider UTXOs', {
      provider: cfg.walletDataProvider,
      base,
      address: address.slice(0, 10) + '…',
      count: collected.length,
    });
    return collected;
  },

  fetchUtxos: async (address: string): Promise<any> => {
    const utxos = await walletDataApi.fetchUtxosPaginated(address);
    return { utxos };
  },

  getAddress: async (wallet?: any): Promise<string> => resolveAddress(wallet),

  getWalletAddress: (wallet: any): string | null => {
    try {
      return wallet?.getAddress() || null;
    } catch (error) {
      console.error('❌ Failed to get wallet address:', error);
      return null;
    }
  },

  fetchTransactions: async (address: string, page = 1, pageSize = 10): Promise<DogeTransactionsPage> => {
    if (isCommandDogWalletDataProvider()) {
      return { transactions: [], total: 0 };
    }
    const base = getWalletProviderBaseUrl();
    const route = `/address/${address}?page=${page}&pageSize=${pageSize}`;
    const url = `${base}/wallet/info?route=${encodeURIComponent(route)}`;
    const data = await fetchJson(url);

    // The response shape varies; try common field names
    const nested = data?.wallet || data?.data || data?.result || data;
    const rawTxs: any[] = Array.isArray(nested?.txs)
      ? nested.txs
      : Array.isArray(nested?.transactions)
      ? nested.transactions
      : Array.isArray(nested?.items)
      ? nested.items
      : Array.isArray(data?.txs)
      ? data.txs
      : [];

    const total: number = Number(nested?.total ?? nested?.totalTransactions ?? data?.total ?? rawTxs.length);

    const transactions: DogeTransaction[] = rawTxs.map((tx: any) => {
      // Determine sign from amount or explicit type
      const rawAmount = Number(tx.amount ?? tx.value ?? 0);
      const isSent =
        tx.type === 'sent' ||
        tx.type === 'send' ||
        tx.type === 'out' ||
        tx.direction === 'out' ||
        rawAmount < 0;

      const amount = Math.abs(rawAmount);

      // Counterparty address
      const counterparty = tx.address ?? (isSent ? (tx.to ?? tx.toAddress ?? '') : (tx.from ?? tx.fromAddress ?? ''));
      const address = String(counterparty ?? '');

      // Confirmations
      const confirmations = Number(tx.confirmations ?? tx.confirms ?? 0);
      const pending = confirmations === 0;

      // Timestamp string – normalize to "YYYY-MM-DD HH:MM:SS"
      let timestamp = '';
      const rawTs = tx.timestamp ?? tx.date ?? tx.blockTime ?? tx.time ?? '';
      if (rawTs) {
        const d = typeof rawTs === 'number'
          ? new Date(rawTs > 1e10 ? rawTs : rawTs * 1000)
          : new Date(rawTs);
        if (!isNaN(d.getTime())) {
          timestamp = d.toISOString().replace('T', ' ').slice(0, 19);
        } else {
          timestamp = String(rawTs);
        }
      }

      return {
        txid: String(tx.txid ?? tx.txId ?? tx.hash ?? tx.id ?? ''),
        type: isSent ? 'sent' : 'received',
        amount,
        address,
        confirmations,
        timestamp,
        pending,
      };
    });

    return { transactions, total };
  },
};

/** POST raw tx hex to command.dog `POST /v1/tx/broadcast`; returns txid. */
export async function broadcastHexViaCommandDog(rawTxHex: string): Promise<string> {
  const base = getCommandDogApiBaseUrl().trim().replace(/\/$/, '');
  let res: Response;
  try {
    res = await fetch(`${base}${COMMAND_DOG_TX_BROADCAST_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ hex: rawTxHex }),
    });
  } catch (e) {
    const isDevProxy = import.meta.env.DEV && base.includes(COMMAND_DOG_DEV_PROXY_PATH);
    const hint = isDevProxy
      ? ' Dev uses same-origin /__commanddog — confirm `npm run dev` and vite.config proxy.'
      : ' Check network, VPN, and that https://api.command.dog is reachable from the browser.';
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Command.dog broadcast: ${msg}.${hint}`);
  }
  const data = (await res.json().catch(() => null)) as
    | {
        txid?: string;
        error?: string;
        message?: string;
        rpc_code?: number;
        rpc_message?: string;
      }
    | null;
  if (!res.ok) {
    const rpcMsg =
      data && typeof data.rpc_message === 'string' && data.rpc_message.trim()
        ? data.rpc_message.trim()
        : '';
    const msg =
      (data && typeof data.error === 'string' && data.error) ||
      rpcMsg ||
      (data && typeof data.message === 'string' && data.message) ||
      JSON.stringify(data);
    const codeHint =
      data && typeof data.rpc_code === 'number' ? ` [Core RPC ${data.rpc_code}]` : '';
    throw new Error(`Command.dog broadcast failed (${res.status}): ${msg}${codeHint}`);
  }
  const txid = data?.txid?.trim();
  if (txid && /^[a-fA-F0-9]{64}$/.test(txid)) return txid;
  throw new Error('Command.dog broadcast returned no txid');
}

export const myDogeApi = walletDataApi;

export { api, isBackendAvailable };
