/**
 * DogeOS chain metadata for viem RPC reads.
 * Override with VITE_DOGEOS_RPC and VITE_DOGEOS_CHAIN_ID for your deployment.
 */
import { defineChain, type Chain } from 'viem';

const DEFAULT_CHAIN_ID = 1313500;
const DEFAULT_RPC = 'https://rpc.dogeos.io';

export function getDogeosChainId(): number {
  const raw = import.meta.env.VITE_DOGEOS_CHAIN_ID;
  const n = raw ? Number.parseInt(String(raw), 10) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CHAIN_ID;
}

export function getDogeosRpcUrl(): string {
  return import.meta.env.VITE_DOGEOS_RPC?.trim() || DEFAULT_RPC;
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
