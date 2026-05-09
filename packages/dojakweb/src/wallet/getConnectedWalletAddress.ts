import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';

/**
 * Hook to access the currently connected wallet address from the unified wallet context.
 */
export function useConnectedWalletAddress(): string | null {
  const { address, connected } = useUnifiedWallet();
  return connected && address ? address : null;
}
