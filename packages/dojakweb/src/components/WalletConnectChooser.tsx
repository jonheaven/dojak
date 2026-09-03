'use client';

import { useState } from 'react';
import { AlertCircle, Cpu, HardDrive, LoaderCircle, Monitor, Usb, Watch } from 'lucide-react';
import { WalletProviderIcon } from './wallet/WalletProviderIcon';
import {
  useWalletConnectOptions,
  partitionWalletTiles,
  type ConnectKind,
  type WalletOptionTile,
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
 * Icon-grid wallet picker: Dojak, Doge Soft, Spooky first; one Hardware entry → Ledger / Doge Watch.
 * Shared by WalletSelectionModal and the phone-drawer intro.
 */
export function WalletConnectChooser({
  onSelectBrowser,
  onConnected,
  className = '',
}: WalletConnectChooserProps) {
  const { t } = useDojakwebI18n();
  const [showOther, setShowOther] = useState(false);
  const [showHardware, setShowHardware] = useState(false);
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
  const { primary, other, hardware } = partitionWalletTiles(tiles);
  const hwConnected = hardware.some((tile) => tile.connected);
  const hwActive = hardware.some((tile) => tile.isActive);
  const hwBusy = hardware.some((tile) => connectingType === tile.type);

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

  const onTileClick = (tile: WalletOptionTile) => {
    if (!tile.available && tile.installUrl && tile.type !== 'browser') {
      window.open(tile.installUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    void handleConnect(tile.type);
  };

  const renderTileButton = (tile: WalletOptionTile, opts?: { asInstall?: boolean }) => {
    const busy = connectingType === tile.type;
    const asInstall = Boolean(opts?.asInstall && !tile.available && tile.installUrl);
    const canClick = tile.type === 'browser' || tile.available || asInstall;
    return (
      <button
        key={tile.type}
        type="button"
        onClick={() => onTileClick(tile)}
        disabled={!canClick || (anyConnecting && !busy)}
        aria-label={
          asInstall
            ? t('wallet.quickPicker.getWallet', { name: tile.shortTitle })
            : tile.ariaLabel
        }
        title={
          asInstall
            ? t('wallet.quickPicker.getWallet', { name: tile.shortTitle })
            : tile.ariaLabel
        }
        className={`${iconTileBase} ${
          (tile.available || tile.type === 'browser' || asInstall) && connectingType === null
            ? iconTileReady
            : iconTileMuted
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
  };

  return (
    <div className={className}>
      {connectionError ? (
        <div className="ds-wallet-modal__alert mb-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{connectionError}</span>
        </div>
      ) : null}

      <div className="ds-wallet-options ds-wallet-options--icon-grid">
        <div className="flex flex-col items-center gap-4 py-1">
          <div className="flex w-full max-w-[20rem] flex-wrap items-center justify-center gap-3">
            {primary.map((tile) =>
              renderTileButton(tile, {
                asInstall: tile.type === 'dojak' || tile.type === 'dogesoft' || tile.type === 'spookydoge',
              }),
            )}
            {hardware.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowHardware((v) => !v)}
                aria-expanded={showHardware}
                aria-label={t('wallet.connectionModal.categoryHardware')}
                title={t('wallet.quickPicker.hardwareHint')}
                className={`${iconTileBase} ${iconTileReady} ${
                  hwActive ? 'ring-2 ring-[color:var(--ds-accent-solid)]' : hwConnected ? 'ring-2 ring-emerald-400/70' : ''
                }`}
              >
                <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-300 to-violet-500 text-zinc-950 shadow-inner">
                  <HardDrive className="h-6 w-6" aria-hidden="true" />
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-md border border-white/25 bg-zinc-900 text-sky-300 shadow-md">
                    <Usb className="h-3 w-3" aria-hidden="true" />
                  </span>
                </span>
                {hwBusy ? (
                  <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/55">
                    <LoaderCircle className="h-7 w-7 animate-spin text-white" aria-hidden="true" />
                  </span>
                ) : null}
              </button>
            ) : null}
          </div>

          {showHardware && hardware.length > 0 ? (
            <div className="flex w-full max-w-[20rem] flex-col items-center gap-2">
              <p className="px-2 text-center text-[11px] leading-snug text-white/40">
                {t('wallet.quickPicker.hardwareHint')}
              </p>
              <div className="flex w-full flex-wrap items-center justify-center gap-3">
                {hardware.map((tile) => renderTileButton(tile, { asInstall: true }))}
              </div>
            </div>
          ) : null}

          {other.length > 0 ? (
            <div className="flex w-full max-w-[20rem] flex-col items-center gap-2">
              <button
                type="button"
                className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold text-white/55 transition hover:border-white/30 hover:text-white"
                aria-expanded={showOther}
                onClick={() => setShowOther((v) => !v)}
              >
                {t('wallet.quickPicker.other')}
              </button>
              {showOther ? (
                <>
                  <p className="px-2 text-center text-[11px] leading-snug text-white/40">
                    {t('wallet.quickPicker.otherHint')}
                  </p>
                  <div className="flex w-full flex-wrap items-center justify-center gap-3">
                    {other.map((tile) => renderTileButton(tile, { asInstall: true }))}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <p className="mt-4 text-center text-xs leading-relaxed text-white/45">
        {t('wallet.connectionModal.footer')}
      </p>
    </div>
  );
}
