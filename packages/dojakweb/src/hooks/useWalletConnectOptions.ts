'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';
import { useBrowserWallet } from '../contexts/BrowserWalletContext';
import { useDojakwebI18n } from '../contexts/DojakwebLocaleContext';
import type { WalletType } from '../types/wallet';
import { getInjectedDogeSoftProvider } from '../utils/dogesoft-provider';

/** Install / download pages for wallets that are not injected yet. */
export const WALLET_INSTALL_URLS: Partial<Record<ConnectKind, string>> = {
  dojak: 'https://github.com/jonheaven/dojak',
  dogesoft: 'https://dogesoft.io/',
  ledger: 'https://www.ledger.com/',
  dogewatch: 'https://dogewatch.io/',
};

function isHardwareKind(type: ConnectKind): boolean {
  return type === 'ledger' || type === 'dogewatch';
}

/** Local browser + detected extensions + already-connected sessions. Hardware stays in Other until connected. */
export function isQuickPathWalletTile(tile: WalletOptionTile): boolean {
  if (tile.type === 'browser') return true;
  if (tile.connected || tile.isActive) return true;
  if (isHardwareKind(tile.type)) return false;
  return tile.available;
}

export function partitionWalletTiles(tiles: WalletOptionTile[]): {
  primary: WalletOptionTile[];
  other: WalletOptionTile[];
} {
  const primary: WalletOptionTile[] = [];
  const other: WalletOptionTile[] = [];
  for (const tile of tiles) {
    if (isQuickPathWalletTile(tile)) primary.push(tile);
    else other.push(tile);
  }
  return { primary, other };
}

export type ConnectKind = Extract<
  WalletType,
  'dogesoft' | 'browser' | 'dojak' | 'ledger' | 'dogewatch'
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
  installUrl?: string;
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
  /** Disconnect one connected session from the picker (does not require it to be active). */
  handleDisconnect: (type: ConnectKind) => Promise<void>;
  anyDisconnecting: boolean;
};

function shortName(type: ConnectKind, t: (key: string) => string): string {
  switch (type) {
    case 'browser':
      return t('wallet.quickPicker.short.browser');
    case 'dojak':
      return t('wallet.quickPicker.short.dojak');
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
  const { connect, setActiveWallet, disconnectWallet, availableWallets, walletType } = useUnifiedWallet();
  const { hasWallet } = useBrowserWallet();
  const { t } = useDojakwebI18n();

  const onSelectBrowser = options?.onSelectBrowser;
  const onConnected = options?.onConnected;

  const [hasBrowserWallet, setHasBrowserWallet] = useState(false);
  const [connectingType, setConnectingType] = useState<ConnectKind | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

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
      try {
        setHasBrowserWallet(await hasWallet());
      } catch {
        setHasBrowserWallet(false);
      }
    })();
  }, [hasWallet]);

  // Capability flags only — never call WebUSB/Web Serial requestDevice/getPorts here.
  // Enumerating devices on picker mount is what prompted "allow this site to read USB devices"
  // on dogenals.com before the user even opened a hardware wallet.
  const usbPresent = typeof navigator !== 'undefined' && 'usb' in navigator;
  const serialPresent = typeof navigator !== 'undefined' && 'serial' in navigator;

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
        installUrl: WALLET_INSTALL_URLS.dojak,
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
        installUrl: WALLET_INSTALL_URLS.dogesoft,
      },
      {
        type: 'dogewatch',
        title: t('wallet.options.dogewatch.title'),
        shortTitle: shortName('dogewatch', t),
        subtitle: serialPresent
          ? t('wallet.options.dogewatch.subtitle')
          : t('wallet.options.dogewatch.serialRequired'),
        ariaLabel: serialPresent
          ? `${t('wallet.options.dogewatch.title')}. ${t('wallet.options.dogewatch.subtitle')}`
          : `${t('wallet.options.dogewatch.title')}. ${t('wallet.options.dogewatch.serialRequired')}`,
        available: serialPresent,
        connected: connectedTypes.has('dogewatch'),
        isActive: walletType === 'dogewatch',
        installUrl: WALLET_INSTALL_URLS.dogewatch,
      },
      {
        type: 'ledger',
        title: t('wallet.options.ledger.title'),
        shortTitle: shortName('ledger', t),
        subtitle: usbPresent
          ? t('wallet.options.ledger.subtitle')
          : t('wallet.options.ledger.webusbRequired'),
        ariaLabel: usbPresent
          ? `${t('wallet.options.ledger.title')}. ${t('wallet.options.ledger.subtitle')}`
          : `${t('wallet.options.ledger.title')}. ${t('wallet.options.ledger.webusbRequired')}`,
        logo: '/ledger.svg',
        available: usbPresent,
        connected: connectedTypes.has('ledger'),
        isActive: walletType === 'ledger',
        installUrl: WALLET_INSTALL_URLS.ledger,
      },
    ];

    return list;
  }, [
    connectedTypes,
    dojak,
    dogeSoft,
    hasBrowserWallet,
    serialPresent,
    t,
    usbPresent,
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

  const handleDisconnect = useCallback(
    async (type: ConnectKind) => {
      try {
        setConnectionError(null);
        setConnectingType(type);
        await disconnectWallet(type);
      } catch (error: any) {
        setConnectionError(error?.message || 'Unable to disconnect wallet.');
      } finally {
        setConnectingType(null);
      }
    },
    [disconnectWallet],
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
    handleDisconnect,
    anyDisconnecting: connectingType !== null,
  };
}
