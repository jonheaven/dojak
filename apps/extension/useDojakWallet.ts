import { useState, useEffect, useCallback } from 'react';

// Types
interface DojakProvider {
  request: (args: { method: string; params?: any }) => Promise<any>;
  on: (event: string, handler: Function) => void;
  removeListener: (event: string, handler: Function) => void;
  isDojak?: boolean;
}

interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  balance: {
    availableBalance: number;
    unavailableBalance: number;
    totalBalance: number;
  } | null;
  network: string | null;
  error: string | null;
}

interface VerificationResult {
  address: string;
  message: string;
  signature: string;
  timestamp: number;
}

// Hook for Dojak wallet integration
export const useDojakWallet = () => {
  const [state, setState] = useState<WalletState>({
    address: null,
    isConnected: false,
    isConnecting: false,
    balance: null,
    network: null,
    error: null
  });

  // Check if Dojak wallet is available
  const isWalletAvailable = useCallback(() => {
    return typeof window !== 'undefined' &&
           (window.dojak || window.dojak_wallet);
  }, []);

  // Get the wallet provider
  const getProvider = useCallback((): DojakProvider | null => {
    if (typeof window === 'undefined') return null;
    return (window as any).dojak || (window as any).dojak_wallet || null;
  }, []);

  // Connect to wallet
  const connect = useCallback(async () => {
    if (!isWalletAvailable()) {
      setState(prev => ({
        ...prev,
        error: 'Dojak wallet extension not found. Please install it first.'
      }));
      return false;
    }

    setState(prev => ({
      ...prev,
      isConnecting: true,
      error: null
    }));

    try {
      const provider = getProvider();
      if (!provider) throw new Error('Provider not available');

      // Request account access
      const accounts = await provider.request({
        method: 'requestAccounts'
      });

      if (accounts && accounts.length > 0) {
        const address = accounts[0];

        // Get balance
        const balance = await provider.request({ method: 'getBalanceV2' });

        // Get network
        const network = await provider.request({ method: 'getNetwork' });

        setState(prev => ({
          ...prev,
          address,
          isConnected: true,
          isConnecting: false,
          balance,
          network,
          error: null
        }));

        return true;
      } else {
        throw new Error('No accounts returned');
      }
    } catch (error: any) {
      console.error('Wallet connection failed:', error);
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error.message || 'Failed to connect wallet'
      }));
      return false;
    }
  }, [isWalletAvailable, getProvider]);

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    try {
      const provider = getProvider();
      if (provider) {
        await provider.request({ method: 'disconnect' });
      }
    } catch (error) {
      console.error('Disconnect failed:', error);
    }

    setState(prev => ({
      ...prev,
      address: null,
      isConnected: false,
      balance: null,
      network: null,
      error: null
    }));
  }, [getProvider]);

  // Sign message for verification
  const signVerificationMessage = useCallback(async (
    customMessage?: string
  ): Promise<VerificationResult | null> => {
    if (!state.address || !state.isConnected) {
      setState(prev => ({
        ...prev,
        error: 'Wallet not connected'
      }));
      return null;
    }

    try {
      const provider = getProvider();
      if (!provider) throw new Error('Provider not available');

      const timestamp = Date.now();
      const message = customMessage || `Verify wallet ownership for BorkStarter\\nTimestamp: ${timestamp}\\nAddress: ${state.address}`;

      const signature = await provider.request({
        method: 'signMessage',
        params: {
          message,
          type: 'ecdsa'
        }
      });

      const result: VerificationResult = {
        address: state.address,
        message,
        signature,
        timestamp
      };

      setState(prev => ({ ...prev, error: null }));
      return result;

    } catch (error: any) {
      console.error('Message signing failed:', error);
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to sign message'
      }));
      return null;
    }
  }, [state.address, state.isConnected, getProvider]);

  // Verify signature (client-side, should also verify on backend)
  const verifySignature = useCallback(async (
    verification: VerificationResult
  ): Promise<boolean> => {
    try {
      const provider = getProvider();
      if (!provider) return false;

      // Note: In production, this should be verified on your backend
      // Client-side verification is for UX only
      return await provider.verifyMessageOfBIP322Simple(
        verification.address,
        verification.message,
        verification.signature
      );
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }, [getProvider]);

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (!state.address || !state.isConnected) return;

    try {
      const provider = getProvider();
      if (!provider) return;

      const balance = await provider.request({ method: 'getBalanceV2' });
      setState(prev => ({ ...prev, balance }));
    } catch (error) {
      console.error('Balance refresh failed:', error);
    }
  }, [state.address, state.isConnected, getProvider]);

  // Send DOGE transaction
  const sendDoge = useCallback(async (
    toAddress: string,
    amountSatoshis: number,
    options?: { feeRate?: number; memo?: string }
  ) => {
    if (!state.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      const provider = getProvider();
      if (!provider) throw new Error('Provider not available');

      const txid = await provider.request({
        method: 'sendBitcoin',
        params: {
          toAddress,
          satoshis: amountSatoshis,
          options
        }
      });

      // Refresh balance after sending
      setTimeout(refreshBalance, 2000);

      return txid;
    } catch (error: any) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }, [state.isConnected, getProvider, refreshBalance]);

  // Listen for wallet events
  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts && accounts.length > 0) {
        setState(prev => ({
          ...prev,
          address: accounts[0],
          isConnected: true
        }));
        refreshBalance();
      } else {
        setState(prev => ({
          ...prev,
          address: null,
          isConnected: false,
          balance: null
        }));
      }
    };

    const handleNetworkChanged = (networkData: any) => {
      setState(prev => ({
        ...prev,
        network: networkData.network || null
      }));
    };

    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('networkChanged', handleNetworkChanged);

    return () => {
      provider.removeListener('accountsChanged', handleAccountsChanged);
      provider.removeListener('networkChanged', handleNetworkChanged);
    };
  }, [getProvider, refreshBalance]);

  return {
    // State
    ...state,

    // Methods
    connect,
    disconnect,
    signVerificationMessage,
    verifySignature,
    refreshBalance,
    sendDoge,

    // Utilities
    isWalletAvailable: isWalletAvailable(),
    provider: getProvider()
  };
};

// Helper function to format DOGE amounts
export const formatDogeAmount = (satoshis: number): string => {
  return (satoshis / 100000000).toFixed(8);
};

// Helper function to parse DOGE amounts
export const parseDogeAmount = (doge: number): number => {
  return Math.floor(doge * 100000000);
};
