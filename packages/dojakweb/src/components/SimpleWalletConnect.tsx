'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';
import { useMyDogeWallet } from '../contexts/useMyDogeWallet';
import { useBrowserWallet } from '../contexts/BrowserWalletContext';
import { getInjectedDogeSoftProvider } from '../utils/dogesoft-provider';
import { WalletProviderIcon } from './wallet/WalletProviderIcon';

interface SimpleWalletConnectProps {
  onConnect?: () => void;
  onError?: (error: string) => void;
}

interface WalletIcon {
  type: 'spookydoge' | 'dogesoft' | 'mydoge' | 'dojak' | 'browser';
  logo?: string;
  detected: boolean;
  name: string;
}

export default function SimpleWalletConnect({ onConnect, onError }: SimpleWalletConnectProps) {
  const { connect } = useUnifiedWallet();
  const myDogeContext = useMyDogeWallet();
  const { hasWallet } = useBrowserWallet();

  const [connectingType, setConnectingType] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [hasBrowserWallet, setHasBrowserWallet] = useState(false);

  const myDoge = myDogeContext?.myDoge || null;
  const spooky = typeof window !== 'undefined' &&
    (window as any).dogecoin?.isSpookyWallet === true
      ? (window as any).dogecoin
      : null;
  const dojak = typeof window !== 'undefined' && window.dojak?.isDojak ? window.dojak : null;
  const dogeSoft = typeof window !== 'undefined' ? getInjectedDogeSoftProvider() : null;

  const walletIcons: WalletIcon[] = useMemo(
    () => [
      {
        type: 'mydoge',
        logo: '/mydoge.webp',
        detected: !!myDoge,
        name: 'MyDoge',
      },
      {
        type: 'spookydoge',
        logo: '/spookydoge.webp',
        detected: !!spooky,
        name: 'SpookyDoge',
      },
      {
        type: 'dogesoft',
        logo: '/dogesoft.png',
        detected: !!dogeSoft,
        name: 'Doge Soft',
      },
      {
        type: 'dojak',
        logo: '/dojak.png',
        detected: !!dojak,
        name: 'Dojak',
      },
      {
        type: 'browser',
        detected: hasBrowserWallet,
        name: 'Browser Wallet',
      },
    ].filter((wallet) => wallet.type === 'browser' || wallet.detected),
    [myDoge, spooky, dogeSoft, dojak, hasBrowserWallet],
  );

  useEffect(() => {
    void (async () => {
      try {
        setHasBrowserWallet(await hasWallet());
      } catch {
        setHasBrowserWallet(false);
      }
    })();
  }, [hasWallet]);

  const handleConnect = useCallback(
    async (type: string) => {
      try {
        setConnectionError(null);
        setConnectingType(type);
        await connect(type as any);
        onConnect?.();
      } catch (error: any) {
        const message = error?.message || 'Unable to connect wallet.';
        console.warn('Connection warning:', message);
        setConnectionError(message);
        onError?.(message);
      } finally {
        setConnectingType(null);
      }
    },
    [connect, onConnect, onError],
  );

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-center mb-4">Connect Wallet</h3>

      {connectionError && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <span className="text-sm text-red-400">{connectionError}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {walletIcons.map((wallet) => {
          const isConnecting = connectingType === wallet.type;

          return (
            <button
              key={wallet.type}
              onClick={() => handleConnect(wallet.type)}
              disabled={isConnecting}
              className={`relative p-4 rounded-xl border transition-all ${
                wallet.detected
                  ? 'border-white/40 bg-white/10 hover:bg-white/20'
                  : 'border-white/20 bg-white/5 hover:bg-white/10 opacity-50'
              } ${isConnecting ? 'animate-pulse' : ''}`}
              title={`Connect ${wallet.name}`}
            >
              <div className="flex flex-col items-center gap-2">
                {wallet.logo ? (
                  <img
                    src={wallet.logo}
                    alt={wallet.name}
                    className="w-8 h-8 rounded-lg object-cover"
                  />
                ) : (
                  <WalletProviderIcon walletType={wallet.type} size="md" />
                )}
                {isConnecting && (
                  <LoaderCircle className="w-4 h-4 animate-spin text-white" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-white/60 text-center mt-4">
        Select a wallet to connect
      </p>
    </div>
  );
}
