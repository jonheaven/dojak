'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, LoaderCircle, Monitor, ShieldCheck, Wallet2 } from 'lucide-react';
import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';
import { useMyDogeWallet } from '../contexts/MyDogeWalletContext';
import { useBrowserWallet } from '../contexts/BrowserWalletContext';
import { LedgerWallet } from '../lib/ledger-wallet';
import { useDojakwebI18n } from '../contexts/DojakwebLocaleContext';

interface SimpleWalletConnectProps {
  onConnect?: () => void;
  onError?: (error: string) => void;
}

interface WalletIcon {
  type: 'spookydoge' | 'mydoge' | 'dojak' | 'browser' | 'ledger';
  icon: typeof ShieldCheck;
  logo?: string;
  detected: boolean;
  name: string;
}

export default function SimpleWalletConnect({ onConnect, onError }: SimpleWalletConnectProps) {
  const { connect } = useUnifiedWallet();
  const myDogeContext = useMyDogeWallet();
  const { hasWallet } = useBrowserWallet();
  const { t } = useDojakwebI18n();

  const [connectingType, setConnectingType] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [hasBrowserWallet, setHasBrowserWallet] = useState(false);
  const [ledgerSupported, setLedgerSupported] = useState(false);

  const myDoge = myDogeContext?.myDoge || null;
  const spooky = typeof window !== 'undefined' &&
    (window as any).dogecoin?.isSpookyWallet === true
      ? (window as any).dogecoin
      : null;
  const dojak = typeof window !== 'undefined' && window.dojak?.isDojak ? window.dojak : null;

  const walletIcons: WalletIcon[] = useMemo(
    () => [
      {
        type: 'mydoge',
        icon: Wallet2,
        logo: '/mydoge.webp',
        detected: !!myDoge,
        name: 'MyDoge',
      },
      {
        type: 'spookydoge',
        icon: Wallet2,
        logo: '/spookydoge.webp',
        detected: !!spooky,
        name: 'SpookyDoge',
      },
      {
        type: 'dojak',
        icon: Wallet2,
        logo: '/dojak.png',
        detected: !!dojak,
        name: 'Dojak',
      },
      {
        type: 'browser',
        icon: Monitor,
        detected: hasBrowserWallet,
        name: 'Browser Wallet',
      },
      {
        type: 'ledger',
        icon: ShieldCheck,
        logo: '/ledger.svg',
        detected: ledgerSupported,
        name: 'Ledger',
      },
    ],
    [myDoge, spooky, dojak, hasBrowserWallet, ledgerSupported]
  );

  useEffect(() => {
    void (async () => {
      setHasBrowserWallet(await hasWallet());
      setLedgerSupported(await LedgerWallet.isSupported());
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
    [connect, onConnect, onError]
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
          const isDisabled = !wallet.detected && wallet.type !== 'browser';

          return (
            <button
              key={wallet.type}
              onClick={() => handleConnect(wallet.type)}
              disabled={isConnecting || isDisabled}
              className={`relative p-4 rounded-xl border transition-all ${
                wallet.detected
                  ? 'border-white/40 bg-white/10 hover:bg-white/20'
                  : 'border-white/20 bg-white/5 hover:bg-white/10 opacity-50'
              } ${isConnecting ? 'animate-pulse' : ''}`}
              title={wallet.detected ? `Connect ${wallet.name}` : `Install ${wallet.name}`}
            >
              <div className="flex flex-col items-center gap-2">
                {wallet.logo ? (
                  <img
                    src={wallet.logo}
                    alt={wallet.name}
                    className="w-8 h-8 rounded-lg object-cover"
                  />
                ) : (
                  <wallet.icon className="w-8 h-8 text-white" />
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