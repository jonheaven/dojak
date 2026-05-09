import React, { createContext, useContext, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { LiveActivityToastContainer } from '../components/LiveActivityToastContainer';
import { DrawerData } from './DoginalDrawerContext';

export interface LiveActivityToastData {
  id: string;
  message: string;
  type: 'network' | 'marketplace' | 'mint' | 'transfer';
  personal?: boolean;
  duration?: number;
  drawerData?: DrawerData;
}

export interface SentinelStatus {
  isConnected: boolean;
  lastActivity: number | null;
  connectionAttempts: number;
  errorMessage?: string;
}

interface LiveActivityContextType {
  showLiveActivity: (message: string, type?: 'network' | 'marketplace' | 'mint' | 'transfer', personal?: boolean, drawerData?: DrawerData, duration?: number) => void;
  network: (message: string, personal?: boolean, drawerData?: DrawerData, duration?: number) => void;
  marketplace: (message: string, personal?: boolean, drawerData?: DrawerData, duration?: number) => void;
  mint: (message: string, personal?: boolean, drawerData?: DrawerData, duration?: number) => void;
  transfer: (message: string, personal?: boolean, drawerData?: DrawerData, duration?: number) => void;
  sentinelStatus: SentinelStatus;
  updateSentinelStatus: (status: Partial<SentinelStatus>) => void;
}

const LiveActivityContext = createContext<LiveActivityContextType | undefined>(undefined);

export const useLiveActivity = () => {
  const context = useContext(LiveActivityContext);
  if (!context) {
    throw new Error('useLiveActivity must be used within a LiveActivityProvider');
  }
  return context;
};

interface LiveActivityProviderProps {
  children: ReactNode;
}

export const LiveActivityProvider: React.FC<LiveActivityProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<LiveActivityToastData[]>([]);
  const [sentinelStatus, setSentinelStatus] = useState<SentinelStatus>({
    isConnected: false,
    lastActivity: null,
    connectionAttempts: 0,
    errorMessage: undefined
  });

  const showLiveActivity = (
    message: string,
    type: 'network' | 'marketplace' | 'mint' | 'transfer' = 'network',
    personal = false,
    drawerData?: DrawerData,
    duration = 6000
  ) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const toast: LiveActivityToastData = {
      id,
      message,
      type,
      personal,
      drawerData,
      duration
    };

    setToasts(prev => {
      // Limit to 10 toasts to prevent memory issues
      const newToasts = [...prev, toast];
      return newToasts.slice(-10);
    });

    // Note: Removal is now handled by LiveActivityToast component to prevent double removal
  };

  const network = (message: string, personal?: boolean, drawerData?: DrawerData, duration?: number) =>
    showLiveActivity(message, 'network', personal, drawerData, duration);
  const marketplace = (message: string, personal?: boolean, drawerData?: DrawerData, duration?: number) =>
    showLiveActivity(message, 'marketplace', personal, drawerData, duration);
  const mint = (message: string, personal?: boolean, drawerData?: DrawerData, duration?: number) =>
    showLiveActivity(message, 'mint', personal, drawerData, duration);
  const transfer = (message: string, personal?: boolean, drawerData?: DrawerData, duration?: number) =>
    showLiveActivity(message, 'transfer', personal, drawerData, duration);

  const removeToast = (id: string) => {
    try {
      setToasts(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error removing toast:', error);
    }
  };

  const updateSentinelStatus = (status: Partial<SentinelStatus>) => {
    setSentinelStatus(prev => ({ ...prev, ...status }));
  };

  return (
    <LiveActivityContext.Provider value={{
      showLiveActivity,
      network,
      marketplace,
      mint,
      transfer,
      sentinelStatus,
      updateSentinelStatus
    }}>
      {children}
      {createPortal(
        <LiveActivityToastContainer toasts={toasts} onRemove={removeToast} />,
        document.body
      )}
    </LiveActivityContext.Provider>
  );
};
