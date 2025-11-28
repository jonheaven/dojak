import { useCallback, useEffect, useRef } from 'react';
import { useCurrentAccount } from '../state/accounts/hooks';
import { useWallet } from '../utils';

interface RealtimeEvent {
  type: 'address_update' | 'marketplace_update' | 'new_block';
  timestamp: number;
  [key: string]: any;
}

interface UseRealtimeUpdatesOptions {
  enableAddressUpdates?: boolean;
  enableMarketplaceUpdates?: boolean;
  enableBlockUpdates?: boolean;
  onAddressUpdate?: (event: RealtimeEvent) => void;
  onMarketplaceUpdate?: (event: RealtimeEvent) => void;
  onBlockUpdate?: (event: RealtimeEvent) => void;
  onError?: (error: any) => void;
}

export const useRealtimeUpdates = (options: UseRealtimeUpdatesOptions = {}) => {
  const wallet = useWallet();
  const currentAccount = useCurrentAccount();

  const subscriptionsRef = useRef<(() => void)[]>([]);
  const optionsRef = useRef(options);

  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const cleanupSubscriptions = useCallback(() => {
    subscriptionsRef.current.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    subscriptionsRef.current = [];
  }, []);

  const setupSubscriptions = useCallback(() => {
    if (!currentAccount?.address) return;

    cleanupSubscriptions();

    const {
      enableAddressUpdates = true,
      enableMarketplaceUpdates = false,
      enableBlockUpdates = false,
      onAddressUpdate,
      onMarketplaceUpdate,
      onBlockUpdate,
      onError
    } = optionsRef.current;

    // Address events subscription
    if (enableAddressUpdates && onAddressUpdate) {
      const unsubscribeAddress = wallet.subscribeToAddressEvents(
        currentAccount.address,
        (event: RealtimeEvent) => {
          if (event.type === 'address_update') {
            onAddressUpdate(event);
          }
        },
        onError
      );
      if (typeof unsubscribeAddress === 'function') {
        subscriptionsRef.current.push(unsubscribeAddress);
      }
    }

    // Marketplace events subscription
    if (enableMarketplaceUpdates && onMarketplaceUpdate) {
      const unsubscribeMarketplace = wallet.subscribeToMarketplaceEvents(
        (event: RealtimeEvent) => {
          if (event.type === 'marketplace_update') {
            onMarketplaceUpdate(event);
          }
        },
        onError
      );
      if (typeof unsubscribeMarketplace === 'function') {
        subscriptionsRef.current.push(unsubscribeMarketplace);
      }
    }

    // New blocks subscription
    if (enableBlockUpdates && onBlockUpdate) {
      const unsubscribeBlocks = wallet.subscribeToNewBlocks(
        (event: RealtimeEvent) => {
          if (event.type === 'new_block') {
            onBlockUpdate(event);
          }
        },
        onError
      );
      if (typeof unsubscribeBlocks === 'function') {
        subscriptionsRef.current.push(unsubscribeBlocks);
      }
    }
  }, [wallet, currentAccount?.address, cleanupSubscriptions]);

  // Setup subscriptions when account changes or options change
  useEffect(() => {
    setupSubscriptions();

    return cleanupSubscriptions;
  }, [setupSubscriptions, currentAccount?.address]);

  // Manual refresh function
  const refreshData = useCallback(async () => {
    if (!currentAccount?.address) return;

    try {
      // Trigger manual data refresh
      const balance = await wallet.getMultiAssetBalance(currentAccount.address);
      const inscriptions = await wallet.getDoginals(currentAccount.address);

      // Call the address update callback with fresh data
      if (optionsRef.current.onAddressUpdate) {
        optionsRef.current.onAddressUpdate({
          type: 'address_update',
          address: currentAccount.address,
          balance,
          inscriptions: inscriptions.list,
          timestamp: Date.now(),
          manual: true
        });
      }
    } catch (error) {
      console.error('Failed to refresh data:', error);
      if (optionsRef.current.onError) {
        optionsRef.current.onError(error);
      }
    }
  }, [wallet, currentAccount?.address]);

  return {
    refreshData,
    isSubscribed: subscriptionsRef.current.length > 0
  };
};
