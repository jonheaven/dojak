'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Cpu, LoaderCircle, Monitor, Usb, Watch } from 'lucide-react';
import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';
import { useMyDogeWallet } from '../contexts/useMyDogeWallet';
import { useBrowserWallet } from '../contexts/BrowserWalletContext';
import { LedgerWallet } from '../lib/ledger-wallet';
import { DogewatchWallet } from '../lib/dogewatch-wallet';
import { useDojakwebI18n } from '../contexts/DojakwebLocaleContext';

export type ConnectKind = 'spookydoge' | 'mydoge' | 'browser' | 'dojak' | 'ledger' | 'dogewatch';

export type WalletConnectChooserProps = {
  /** Called when user picks Local Browser (turnkey create / import flow). */
  onSelectBrowser: () => void;
  /** Called after a non-browser wallet connects successfully. */
  onConnected?: () => void;
  className?: string;
};

/**
 * Icon-grid wallet picker: Local Browser, MyDoge, Dojak, SpookyDoge, Dogewatch, Ledger.
 * Shared by WalletSelectionModal and the phone-drawer intro.
 */
export function WalletConnectChooser({
  onSelectBrowser,
  onConnected,
  className = '',
}: WalletConnectChooserProps) {
  const { connect } = useUnifiedWallet();
  const myDogeContext = useMyDogeWallet();
  const { hasWallet } = useBrowserWallet();
  const { t } = useDojakwebI18n();

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

  const handleConnect = useCallback(
    async (type: ConnectKind) => {
      try {
        setConnectionError(null);
        setConnectingType(type);
        if (type === 'browser') {
          onSelectBrowser();
          return;
        }
        await connect(type);
        onConnected?.();
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

  const extensionTiles = useMemo(
    () =>
      [
        {
          type: 'mydoge' as const,
          logo: '/mydoge.webp',
          title: t('wallet.options.mydoge.title'),
          subtitle: myDoge ? t('wallet.options.mydoge.subtitleOk') : t('wallet.options.mydoge.subtitleInstall'),
          available: !!myDoge,
        },
        {
          type: 'dojak' as const,
          logo: '/dojak.png',
          title: t('wallet.options.dojak.title'),
          subtitle: dojak ? t('wallet.options.dojak.subtitleOk') : t('wallet.options.dojak.subtitleInstall'),
          available: !!dojak,
        },
        {
          type: 'spookydoge' as const,
          logo: '/spookydoge.webp',
          title: t('wallet.options.spookydoge.title'),
          subtitle: spooky ? t('wallet.options.spookydoge.subtitleOk') : t('wallet.options.spookydoge.subtitleInstall'),
          available: !!spooky,
        },
      ] as const,
    [dojak, myDoge, spooky, t],
  );

  const browserAria = `${t('wallet.options.browser.title')}. ${
    hasBrowserWallet ? t('wallet.options.browser.subtitleHas') : t('wallet.options.browser.subtitleNew')
  }`;
  const ledgerAria = ledgerSupported
    ? `${t('wallet.options.ledger.title')}. ${t('wallet.options.ledger.subtitle')}`
    : `${t('wallet.options.ledger.title')}. ${t('wallet.options.ledger.webusbRequired')}`;
  const dogewatchAria = dogewatchSupported
    ? `${t('wallet.options.dogewatch.title')}. ${t('wallet.options.dogewatch.subtitle')}`
    : `${t('wallet.options.dogewatch.title')}. ${t('wallet.options.dogewatch.serialRequired')}`;

  useEffect(() => {
    void (async () => {
      setHasBrowserWallet(await hasWallet());
      setLedgerSupported(await LedgerWallet.isSupported());
      setDogewatchSupported(await DogewatchWallet.isSupported());
    })();
  }, [hasWallet]);

  const ledgerConnecting = connectingType === 'ledger';
  const dogewatchConnecting = connectingType === 'dogewatch';
  const browserBusy = connectingType === 'browser';
  const anyConnecting = connectingType !== null;

  const iconTileBase =
    'relative flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center rounded-2xl border text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-accent-solid)]/55';
  const iconTileReady = 'border-white/20 bg-white/[0.07] hover:border-white/40 hover:bg-white/[0.12]';
  const iconTileMuted = 'cursor-not-allowed border-white/[0.08] bg-white/[0.03] opacity-[0.42]';

  return (
    <div className={className}>
      {connectionError ? (
        <div className="ds-wallet-modal__alert mb-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{connectionError}</span>
        </div>
      ) : null}

      <div className="ds-wallet-options ds-wallet-options--icon-grid">
        <div className="flex flex-col items-center gap-6 py-1">
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => handleConnect('browser')}
              disabled={anyConnecting}
              aria-label={browserAria}
              title={browserAria}
              className={`${iconTileBase} ${iconTileReady} border-[#FCD34D]/45 ${browserBusy ? 'cursor-wait' : ''} ${
                anyConnecting && !browserBusy ? 'opacity-[0.42]' : ''
              }`}
            >
              <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-200 to-zinc-500 text-zinc-950 shadow-inner">
                <Monitor className="h-6 w-6" aria-hidden="true" />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-md border border-white/25 bg-zinc-900 text-amber-300 shadow-md">
                  <Cpu className="h-3 w-3" aria-hidden="true" />
                </span>
              </span>
              {browserBusy ? (
                <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/55">
                  <LoaderCircle className="h-7 w-7 animate-spin text-white" aria-hidden="true" />
                </span>
              ) : null}
            </button>
            <span className="text-[11px] font-semibold text-[#FCD34D]/90">
              {t('wallet.options.browser.title')}
            </span>
          </div>

          <div className="flex w-full max-w-[16.5rem] items-center justify-center gap-3">
            {extensionTiles.map((tile) => {
              const busy = connectingType === tile.type;
              const extAria =
                tile.type === 'spookydoge' && spookyHint && spooky
                  ? `${tile.title}. ${t('wallet.options.spookydoge.preferred')}. ${tile.subtitle}`
                  : `${tile.title}. ${tile.subtitle}`;
              return (
                <button
                  key={tile.type}
                  type="button"
                  onClick={() => handleConnect(tile.type)}
                  disabled={!tile.available || connectingType !== null}
                  aria-label={extAria}
                  title={extAria}
                  className={`${iconTileBase} ${tile.available && connectingType === null ? iconTileReady : iconTileMuted}`}
                >
                  <img src={tile.logo} alt="" className="h-11 w-11 rounded-xl object-cover" />
                  {tile.type === 'spookydoge' && spooky && spookyHint ? (
                    <span
                      className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_0_2px_rgba(0,0,0,0.35)]"
                      aria-hidden="true"
                    />
                  ) : null}
                  {busy ? (
                    <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/55">
                      <LoaderCircle className="h-7 w-7 animate-spin text-white" aria-hidden="true" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex w-full max-w-[16.5rem] items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => handleConnect('dogewatch')}
              disabled={!dogewatchSupported || connectingType !== null}
              aria-label={dogewatchAria}
              title={dogewatchAria}
              className={`${iconTileBase} ${
                dogewatchSupported && connectingType === null ? iconTileReady : iconTileMuted
              }`}
            >
              <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-600 text-zinc-950 shadow-inner">
                <Watch className="h-6 w-6" aria-hidden="true" />
                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-md border border-white/20 bg-zinc-900 text-amber-300 shadow-md">
                  <Usb className="h-3 w-3" aria-hidden="true" />
                </span>
              </span>
              {dogewatchConnecting ? (
                <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/55">
                  <LoaderCircle className="h-7 w-7 animate-spin text-white" aria-hidden="true" />
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => handleConnect('ledger')}
              disabled={!ledgerSupported || connectingType !== null}
              aria-label={ledgerAria}
              title={ledgerAria}
              className={`${iconTileBase} ${
                ledgerSupported && connectingType === null ? iconTileReady : iconTileMuted
              }`}
            >
              <span className="relative flex h-11 w-11 items-center justify-center">
                <img src="/ledger.svg" alt="" className="h-9 w-9 opacity-95" />
                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-md border border-white/20 bg-zinc-900 text-sky-300 shadow-md">
                  <Usb className="h-3 w-3" aria-hidden="true" />
                </span>
              </span>
              {ledgerConnecting ? (
                <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/55">
                  <LoaderCircle className="h-7 w-7 animate-spin text-white" aria-hidden="true" />
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-xs leading-relaxed text-white/45">
        {t('wallet.connectionModal.footer')}
      </p>
    </div>
  );
}
