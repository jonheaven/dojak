'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';
import { useMyDogeWallet } from '../contexts/useMyDogeWallet';
import { useBrowserWallet } from '../contexts/BrowserWalletContext';
import { LedgerWallet } from '../lib/ledger-wallet';
import { DogewatchWallet } from '../lib/dogewatch-wallet';
import { useDojakwebI18n } from '../contexts/DojakwebLocaleContext';
import type { WalletType } from '../types/wallet';
import { getInjectedDogeSoftProvider } from '../utils/dogesoft-provider';

export type ConnectKind = Extract<
  WalletType,
  'spookydoge' | 'dogesoft' | 'mydoge' | 'browser' | 'dojak' | 'ledger' | 'dogewatch'
>;

export type WalletOptionTile = {
  type: ConnectKind;
  title: string;
  shortTitle: string;
  subtitle: string;
  ariaLabel: string;
  logo?: string;
  available: boolean;
  connected: boolean;
  isActive: boolean;
};

export type UseWalletConnectOptionsResult = {
  tiles: WalletOptionTile[];
  connectingType: ConnectKind | null;
  connectionError: string | null;
  clearError: () => void;
  hasBrowserWallet: boolean;
  anyConnecting: boolean;
  /**
   * Connect a non-browser wallet, or invoke `onSelectBrowser` for local browser.
   * Does not disconnect sibling sessions.
   */
  handleConnect: (type: ConnectKind) => Promise<void>;
  /**
   * If already connected: set active (or call onAlreadyActive).
   * If not: same as handleConnect.
   */
  handleSelect: (
    type: ConnectKind,
    opts?: { onAlreadyActive?: () => void },
  ) => Promise<void>;
};

function shortName(type: ConnectKind, t: (key: string) => string): string {
  switch (type) {
    case 'browser':
      return t('wallet.quickPicker.short.browser');
    case 'mydoge':
      return t('wallet.quickPicker.short.mydoge');
    case 'dojak':
      return t('wallet.quickPicker.short.dojak');
    case 'spookydoge':
      return t('wallet.quickPicker.short.spookydoge');
    case 'dogesoft':
      return t('wallet.quickPicker.short.dogesoft');
    case 'ledger':
      return t('wallet.quickPicker.short.ledger');
    case 'dogewatch':
      return t('wallet.quickPicker.short.dogewatch');
    default:
      return type;
  }
}

export function useWalletConnectOptions(options?: {
  onSelectBrowser?: () => void;
  onConnected?: (type: ConnectKind) => void;
}): UseWalletConnectOptionsResult {
  const { connect, setActiveWallet, availableWallets, walletType } = useUnifiedWallet();
  const myDogeContext = useMyDogeWallet();
  const { hasWallet } = useBrowserWallet();
  const { t } = useDojakwebI18n();

  const onSelectBrowser = options?.onSelectBrowser;
  const onConnected = options?.onConnected;

  const [hasBrowserWallet, setHasBrowserWallet] = useState(false);
  const [ledgerSupported, setLedgerSupported] = useState(false);
  const [dogewatchSupported, setDogewatchSupported] = useState(false);
  const [connectingType, setConnectingType] = useState<ConnectKind | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const myDoge = myDogeContext?.myDoge || null;
  const spooky =
    typeof window !== 'undefined' && (window as any).dogecoin?.isSpookyWallet === true
      ? (window as any).dogecoin
      : null;
  const spookyHint =
    typeof window !== 'undefined' &&
    !!((window as any).isSpookyWallet || (window as any).__DOJAKWEB_FLAGS?.isSpookyWallet);
  const dojak = typeof window !== 'undefined' && window.dojak?.isDojak ? window.dojak : null;
  const [dogeSoftReady, setDogeSoftReady] = useState(
    () => typeof window !== 'undefined' && !!getInjectedDogeSoftProvider(),
  );
  const dogeSoft = dogeSoftReady ? getInjectedDogeSoftProvider() : null;

  const connectedTypes = useMemo(() => {
    const set = new Set<WalletType>();
    for (const w of availableWallets) {
      if (w.connected) set.add(w.type);
    }
    return set;
  }, [availableWallets]);

  useEffect(() => {
    void (async () => {
      setHasBrowserWallet(await hasWallet());
      setLedgerSupported(await LedgerWallet.isSupported());
      setDogewatchSupported(await DogewatchWallet.isSupported());
    })();
  }, [hasWallet]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (getInjectedDogeSoftProvider()) {
      setDogeSoftReady(true);
      return;
    }
    const onInit = () => setDogeSoftReady(!!getInjectedDogeSoftProvider());
    window.addEventListener('dogesoft#initialized', onInit);
    return () => window.removeEventListener('dogesoft#initialized', onInit);
  }, []);

  const tiles: WalletOptionTile[] = useMemo(() => {
    const browserTitle = t('wallet.options.browser.title');
    const browserSub = hasBrowserWallet
      ? t('wallet.options.browser.subtitleHas')
      : t('wallet.options.browser.subtitleNew');

    const list: WalletOptionTile[] = [
      {
        type: 'browser',
        title: browserTitle,
        shortTitle: shortName('browser', t),
        subtitle: browserSub,
        ariaLabel: `${browserTitle}. ${browserSub}`,
        available: true,
        connected: connectedTypes.has('browser'),
        isActive: walletType === 'browser',
      },
      {
        type: 'mydoge',
        title: t('wallet.options.mydoge.title'),
        shortTitle: shortName('mydoge', t),
        subtitle: myDoge
          ? t('wallet.options.mydoge.subtitleOk')
          : t('wallet.options.mydoge.subtitleInstall'),
        ariaLabel: `${t('wallet.options.mydoge.title')}. ${
          myDoge ? t('wallet.options.mydoge.subtitleOk') : t('wallet.options.mydoge.subtitleInstall')
        }`,
        logo: '/mydoge.webp',
        available: !!myDoge,
        connected: connectedTypes.has('mydoge'),
        isActive: walletType === 'mydoge',
      },
      {
        type: 'dojak',
        title: t('wallet.options.dojak.title'),
        shortTitle: shortName('dojak', t),
        subtitle: dojak
          ? t('wallet.options.dojak.subtitleOk')
          : t('wallet.options.dojak.subtitleInstall'),
        ariaLabel: `${t('wallet.options.dojak.title')}. ${
          dojak ? t('wallet.options.dojak.subtitleOk') : t('wallet.options.dojak.subtitleInstall')
        }`,
        logo: '/dojak.png',
        available: !!dojak,
        connected: connectedTypes.has('dojak'),
        isActive: walletType === 'dojak',
      },
      {
        type: 'spookydoge',
        title: t('wallet.options.spookydoge.title'),
        shortTitle: shortName('spookydoge', t),
        subtitle: spooky
          ? t('wallet.options.spookydoge.subtitleOk')
          : t('wallet.options.spookydoge.subtitleInstall'),
        ariaLabel:
          spookyHint && spooky
            ? `${t('wallet.options.spookydoge.title')}. ${t('wallet.options.spookydoge.preferred')}. ${t('wallet.options.spookydoge.subtitleOk')}`
            : `${t('wallet.options.spookydoge.title')}. ${
                spooky
                  ? t('wallet.options.spookydoge.subtitleOk')
                  : t('wallet.options.spookydoge.subtitleInstall')
              }`,
        logo: '/spookydoge.webp',
        available: !!spooky,
        connected: connectedTypes.has('spookydoge'),
        isActive: walletType === 'spookydoge',
      },
      {
        type: 'dogesoft',
        title: t('wallet.options.dogesoft.title'),
        shortTitle: shortName('dogesoft', t),
        subtitle: dogeSoft
          ? t('wallet.options.dogesoft.subtitleOk')
          : t('wallet.options.dogesoft.subtitleInstall'),
        ariaLabel: `${t('wallet.options.dogesoft.title')}. ${
          dogeSoft
            ? t('wallet.options.dogesoft.subtitleOk')
            : t('wallet.options.dogesoft.subtitleInstall')
        }`,
        logo: '/dogesoft.png',
        available: !!dogeSoft,
        connected: connectedTypes.has('dogesoft'),
        isActive: walletType === 'dogesoft',
      },
      {
        type: 'dogewatch',
        title: t('wallet.options.dogewatch.title'),
        shortTitle: shortName('dogewatch', t),
        subtitle: dogewatchSupported
          ? t('wallet.options.dogewatch.subtitle')
          : t('wallet.options.dogewatch.serialRequired'),
        ariaLabel: dogewatchSupported
          ? `${t('wallet.options.dogewatch.title')}. ${t('wallet.options.dogewatch.subtitle')}`
          : `${t('wallet.options.dogewatch.title')}. ${t('wallet.options.dogewatch.serialRequired')}`,
        available: dogewatchSupported,
        connected: connectedTypes.has('dogewatch'),
        isActive: walletType === 'dogewatch',
      },
      {
        type: 'ledger',
        title: t('wallet.options.ledger.title'),
        shortTitle: shortName('ledger', t),
        subtitle: ledgerSupported
          ? t('wallet.options.ledger.subtitle')
          : t('wallet.options.ledger.webusbRequired'),
        ariaLabel: ledgerSupported
          ? `${t('wallet.options.ledger.title')}. ${t('wallet.options.ledger.subtitle')}`
          : `${t('wallet.options.ledger.title')}. ${t('wallet.options.ledger.webusbRequired')}`,
        logo: '/ledger.svg',
        available: ledgerSupported,
        connected: connectedTypes.has('ledger'),
        isActive: walletType === 'ledger',
      },
    ];

    return list;
  }, [
    connectedTypes,
    dojak,
    dogeSoft,
    dogewatchSupported,
    hasBrowserWallet,
    ledgerSupported,
    myDoge,
    spooky,
    spookyHint,
    t,
    walletType,
  ]);

  const handleConnect = useCallback(
    async (type: ConnectKind) => {
      try {
        setConnectionError(null);
        setConnectingType(type);
        if (type === 'browser') {
          onSelectBrowser?.();
          return;
        }
        await connect(type);
        onConnected?.(type);
      } catch (error: any) {
        const message = error?.message || 'Unable to connect wallet.';
        console.warn('Connection warning:', message);
        setConnectionError(message);
      } finally {
        setConnectingType(null);
      }
    },
    [connect, onConnected, onSelectBrowser],
  );

  const handleSelect = useCallback(
    async (type: ConnectKind, opts?: { onAlreadyActive?: () => void }) => {
      const tile = tiles.find((x) => x.type === type);
      if (!tile) return;

      if (tile.connected && tile.isActive) {
        opts?.onAlreadyActive?.();
        return;
      }

      if (tile.connected && !tile.isActive) {
        try {
          setConnectionError(null);
          setActiveWallet(type);
          onConnected?.(type);
        } catch (error: any) {
          setConnectionError(error?.message || 'Unable to switch wallet.');
        }
        return;
      }

      await handleConnect(type);
    },
    [handleConnect, onConnected, setActiveWallet, tiles],
  );

  return {
    tiles,
    connectingType,
    connectionError,
    clearError: () => setConnectionError(null),
    hasBrowserWallet,
    anyConnecting: connectingType !== null,
    handleConnect,
    handleSelect,
  };
}
