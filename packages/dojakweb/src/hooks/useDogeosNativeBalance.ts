import { useBalance } from 'wagmi';
import { getDogeosChainId } from '@/lib/dogeos-chain';

/**
 * Native DogeOS balance via wagmi + viem (same RPC as `dogeosChain`).
 * No injected connector required — address is watch-only from HD derivation.
 */
export function useDogeosNativeBalance(address: `0x${string}` | null | undefined, enabled: boolean) {
  const chainId = getDogeosChainId();
  return useBalance({
    address: address ?? undefined,
    chainId,
    query: {
      enabled: Boolean(enabled && address),
      staleTime: 15_000,
      refetchInterval: 45_000,
    },
  });
}
