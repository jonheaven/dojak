/**
 * DogeOS chain metadata for viem RPC reads.
 * Override with VITE_DOGEOS_RPC and VITE_DOGEOS_CHAIN_ID for your deployment.
 */
import { defineChain, type Chain } from 'viem';

const DEFAULT_CHAIN_ID = 1313500;
const DEFAULT_RPC = 'https://rpc.dogeos.io';

/**
 * Read Vite-style env at runtime in consuming apps.
 * Avoid `(import.meta as X).env` — Rolldown can freeze that object at @dojak/web build time.
 */
function readViteEnv(key: string): string | undefined {
  try {
    const envUnknown = Reflect.get(import.meta, 'env');
    if (!envUnknown || typeof envUnknown !== 'object') return undefined;
    const v = (envUnknown as Record<string, unknown>)[key];
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t.length > 0 ? t : undefined;
  } catch {
    return undefined;
  }
}

export function getDogeosChainId(): number {
  const raw = readViteEnv('VITE_DOGEOS_CHAIN_ID');
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CHAIN_ID;
}

export function getDogeosRpcUrl(): string {
  return readViteEnv('VITE_DOGEOS_RPC') ?? DEFAULT_RPC;
}

/** DogeOS EVM chain — opt-in; used only when DogeOS support is enabled in settings. */
export const dogeosChain: Chain = defineChain({
  id: getDogeosChainId(),
  name: 'DogeOS',
  nativeCurrency: {
    decimals: 18,
    name: 'DogeOS Gas',
    symbol: 'DOGE',
  },
  rpcUrls: {
    default: { http: [getDogeosRpcUrl()] },
  },
});
