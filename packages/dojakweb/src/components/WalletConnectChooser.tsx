'use client';

import { AlertCircle, Cpu, LoaderCircle, Monitor, Usb, Watch } from 'lucide-react';
import { WalletProviderIcon } from './wallet/WalletProviderIcon';
import {
  useWalletConnectOptions,
  type ConnectKind,
} from '../hooks/useWalletConnectOptions';
import { useDojakwebI18n } from '../contexts/DojakwebLocaleContext';

export type { ConnectKind };

export type WalletConnectChooserProps = {
  /** Called when user picks Local Browser (turnkey create / import flow). */
  onSelectBrowser: () => void;
  /** Called after a non-browser wallet connects successfully. */
  onConnected?: () => void;
  className?: string;
};

/**
 * Icon-grid wallet picker: Local Browser, MyDoge, Dojak, SpookyDoge, Doge Soft, Dogewatch, Ledger.
 * Shared by WalletSelectionModal and the phone-drawer intro.
 */
export function WalletConnectChooser({
  onSelectBrowser,
  onConnected,
  className = '',
}: WalletConnectChooserProps) {
  const { t } = useDojakwebI18n();
  const {
    tiles,
    connectingType,
    connectionError,
    anyConnecting,
    handleConnect,
  } = useWalletConnectOptions({
    onSelectBrowser,
    onConnected: () => onConnected?.(),
  });

  const iconTileBase =
    'relative flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center rounded-2xl border text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-accent-solid)]/55';
  const iconTileReady = 'border-white/20 bg-white/[0.07] hover:border-white/40 hover:bg-white/[0.12]';
  const iconTileMuted = 'cursor-not-allowed border-white/[0.08] bg-white/[0.03] opacity-[0.42]';

  const renderGlyph = (type: ConnectKind, logo?: string) => {
    if (type === 'browser') {
      return (
        <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-200 to-zinc-500 text-zinc-950 shadow-inner">
          <Monitor className="h-6 w-6" aria-hidden="true" />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-md border border-white/25 bg-zinc-900 text-amber-300 shadow-md">
            <Cpu className="h-3 w-3" aria-hidden="true" />
          </span>
        </span>
      );
    }
    if (type === 'dogewatch') {
      return (
        <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-600 text-zinc-950 shadow-inner">
          <Watch className="h-6 w-6" aria-hidden="true" />
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-md border border-white/20 bg-zinc-900 text-amber-300 shadow-md">
            <Usb className="h-3 w-3" aria-hidden="true" />
          </span>
        </span>
      );
    }
    if (logo) {
      return (
        <span className="relative flex h-11 w-11 items-center justify-center">
          <img
            src={logo}
            alt=""
            className={type === 'ledger' ? 'h-9 w-9 opacity-95' : 'h-11 w-11 rounded-xl object-cover'}
          />
          {type === 'ledger' ? (
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-md border border-white/20 bg-zinc-900 text-sky-300 shadow-md">
              <Usb className="h-3 w-3" aria-hidden="true" />
            </span>
          ) : null}
        </span>
      );
    }
    return <WalletProviderIcon walletType={type} size="lg" />;
  };

  const browser = tiles.find((tile) => tile.type === 'browser');
  const extensions = tiles.filter(
    (tile) =>
      tile.type === 'mydoge' ||
      tile.type === 'dojak' ||
      tile.type === 'spookydoge' ||
      tile.type === 'dogesoft',
  );
  const hardware = tiles.filter((tile) => tile.type === 'dogewatch' || tile.type === 'ledger');

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
          {browser ? (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => void handleConnect('browser')}
                disabled={anyConnecting}
                aria-label={browser.ariaLabel}
                title={browser.ariaLabel}
                className={`${iconTileBase} ${iconTileReady} border-[#FCD34D]/45 ${
                  connectingType === 'browser' ? 'cursor-wait' : ''
                } ${anyConnecting && connectingType !== 'browser' ? 'opacity-[0.42]' : ''}`}
              >
                {renderGlyph('browser')}
                {connectingType === 'browser' ? (
                  <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/55">
                    <LoaderCircle className="h-7 w-7 animate-spin text-white" aria-hidden="true" />
                  </span>
                ) : null}
              </button>
              <span className="text-[11px] font-semibold text-[#FCD34D]/90">{browser.title}</span>
            </div>
          ) : null}

          <div className="flex w-full max-w-[20rem] flex-wrap items-center justify-center gap-3">
            {extensions.map((tile) => {
              const busy = connectingType === tile.type;
              return (
                <button
                  key={tile.type}
                  type="button"
                  onClick={() => void handleConnect(tile.type)}
                  disabled={!tile.available || connectingType !== null}
                  aria-label={tile.ariaLabel}
                  title={tile.ariaLabel}
                  className={`${iconTileBase} ${
                    tile.available && connectingType === null ? iconTileReady : iconTileMuted
                  }`}
                >
                  {renderGlyph(tile.type, tile.logo)}
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
            {hardware.map((tile) => {
              const busy = connectingType === tile.type;
              return (
                <button
                  key={tile.type}
                  type="button"
                  onClick={() => void handleConnect(tile.type)}
                  disabled={!tile.available || connectingType !== null}
                  aria-label={tile.ariaLabel}
                  title={tile.ariaLabel}
                  className={`${iconTileBase} ${
                    tile.available && connectingType === null ? iconTileReady : iconTileMuted
                  }`}
                >
                  {renderGlyph(tile.type, tile.logo)}
                  {busy ? (
                    <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/55">
                      <LoaderCircle className="h-7 w-7 animate-spin text-white" aria-hidden="true" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-xs leading-relaxed text-white/45">
        {t('wallet.connectionModal.footer')}
      </p>
    </div>
  );
}
