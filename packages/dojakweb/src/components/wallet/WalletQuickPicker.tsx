'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertCircle, Cpu, LoaderCircle, Monitor, Usb, Watch, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  useWalletConnectOptions,
  type ConnectKind,
} from '../../hooks/useWalletConnectOptions';
import { useUnifiedWallet } from '../../contexts/UnifiedWalletContext';
import { useDojakwebI18n } from '../../contexts/DojakwebLocaleContext';
import { useDojakwebTheme } from '../../contexts/DojakwebThemeContext';
import { WalletProviderIcon } from './WalletProviderIcon';

export type WalletDrawerOpenStep = 'chooser' | 'entry' | 'dashboard' | 'unlock';

export type WalletQuickPickerProps = {
  open: boolean;
  onClose: () => void;
  /** Desktop popover vs mobile sheet/modal list */
  variant: 'flyout' | 'sheet';
  /** Anchor element for flyout positioning (the connect icon button). */
  anchorRef?: React.RefObject<HTMLElement | null>;
  onRequestOpenDrawer: (step: WalletDrawerOpenStep) => void;
};

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

function TileGlyph({
  type,
  logo,
}: {
  type: ConnectKind;
  logo?: string;
}) {
  if (type === 'browser') {
    return (
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-200 to-zinc-500 text-zinc-950 shadow-inner">
        <Monitor className="h-5 w-5" aria-hidden />
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-md border border-white/25 bg-zinc-900 text-amber-300">
          <Cpu className="h-2.5 w-2.5" aria-hidden />
        </span>
      </span>
    );
  }
  if (type === 'dogewatch') {
    return (
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-600 text-zinc-950 shadow-inner">
        <Watch className="h-5 w-5" aria-hidden />
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-md border border-white/20 bg-zinc-900 text-amber-300">
          <Usb className="h-2.5 w-2.5" aria-hidden />
        </span>
      </span>
    );
  }
  if (logo) {
    return (
      <span className="relative flex h-9 w-9 items-center justify-center">
        <img src={logo} alt="" className="h-9 w-9 rounded-xl object-cover" draggable={false} />
        {type === 'ledger' ? (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-md border border-white/20 bg-zinc-900 text-sky-300">
            <Usb className="h-2.5 w-2.5" aria-hidden />
          </span>
        ) : null}
      </span>
    );
  }
  return <WalletProviderIcon walletType={type} size="md" />;
}

export function WalletQuickPicker({
  open,
  onClose,
  variant,
  anchorRef,
  onRequestOpenDrawer,
}: WalletQuickPickerProps) {
  const { connected, walletType } = useUnifiedWallet();
  const { t } = useDojakwebI18n();
  const { theme } = useDojakwebTheme();
  const isLight = theme === 'light';
  const panelRef = useRef<HTMLDivElement>(null);
  const [flyoutStyle, setFlyoutStyle] = useState<React.CSSProperties | undefined>();

  const {
    tiles,
    connectingType,
    connectionError,
    anyConnecting,
    handleSelect,
    handleDisconnect,
  } = useWalletConnectOptions({
    onSelectBrowser: () => {
      onClose();
      onRequestOpenDrawer('entry');
    },
    onConnected: () => {
      onClose();
      onRequestOpenDrawer('dashboard');
    },
  });

  useLayoutEffect(() => {
    if (!open || variant !== 'flyout') {
      setFlyoutStyle(undefined);
      return;
    }
    const place = () => {
      const anchor = anchorRef?.current;
      if (!anchor) {
        setFlyoutStyle({ top: 72, right: 16 });
        return;
      }
      const rect = anchor.getBoundingClientRect();
      const gap = 8;
      const width = 280;
      let left = rect.right - width;
      if (left < 8) left = 8;
      if (left + width > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - width - 8);
      }
      let top = rect.bottom + gap;
      const estimatedHeight = 280;
      if (top + estimatedHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - estimatedHeight - gap);
      }
      setFlyoutStyle({ top, left, width });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchorRef, open, variant]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (variant !== 'flyout') return;
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
    };
  }, [anchorRef, onClose, open, variant]);

  if (!open || typeof document === 'undefined') return null;

  const onTileClick = (type: ConnectKind) => {
    void handleSelect(type, {
      onAlreadyActive: () => {
        onClose();
        onRequestOpenDrawer('dashboard');
      },
    });
  };

  const openWalletFooter =
    connected && walletType ? (
      <button
        type="button"
        className="ds-wallet-quick-picker__open"
        onClick={() => {
          onClose();
          onRequestOpenDrawer('dashboard');
        }}
      >
        {t('wallet.quickPicker.openWallet')}
      </button>
    ) : null;

  const tileButtons = tiles.map((tile) => {
    const busy = connectingType === tile.type;
    const disabled = (!tile.available && tile.type !== 'browser') || (anyConnecting && !busy);
    const statusHint = tile.isActive
      ? 'Active'
      : tile.connected
        ? 'Connected'
        : null;
    return (
      <div key={tile.type} className="ds-wallet-quick-picker__cell">
        <button
          type="button"
          disabled={disabled}
          title={statusHint ? `${tile.title} — ${statusHint}` : tile.title}
          aria-label={statusHint ? `${tile.ariaLabel}. ${statusHint}` : tile.ariaLabel}
          aria-pressed={tile.isActive}
          onClick={() => onTileClick(tile.type)}
          className={cx(
            'ds-wallet-quick-picker__tile',
            tile.isActive && 'ds-wallet-quick-picker__tile--active',
            tile.connected && !tile.isActive && 'ds-wallet-quick-picker__tile--connected',
            !tile.available && tile.type !== 'browser' && 'ds-wallet-quick-picker__tile--muted',
            variant === 'sheet' && 'ds-wallet-quick-picker__tile--row',
          )}
        >
          <span className="ds-wallet-quick-picker__glyph">
            <TileGlyph type={tile.type} logo={tile.logo} />
            {busy ? (
              <span className="ds-wallet-quick-picker__busy">
                <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
              </span>
            ) : null}
            {tile.connected && !busy ? (
              <span
                className={cx(
                  'ds-wallet-quick-picker__dot',
                  tile.isActive && 'ds-wallet-quick-picker__dot--active',
                )}
                aria-hidden
              />
            ) : null}
          </span>
          {variant === 'sheet' ? (
            <span className="ds-wallet-quick-picker__row-text">
              <span className="ds-wallet-quick-picker__row-title">{tile.shortTitle}</span>
              <span className="ds-wallet-quick-picker__row-sub">{tile.subtitle}</span>
            </span>
          ) : null}
        </button>
        {tile.connected && !busy ? (
          <button
            type="button"
            className="ds-wallet-quick-picker__disconnect"
            aria-label={t('wallet.quickPicker.disconnectAria', { name: tile.shortTitle })}
            title={t('wallet.quickPicker.disconnectAria', { name: tile.shortTitle })}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void handleDisconnect(tile.type);
            }}
          >
            <X className="h-3 w-3" strokeWidth={2.5} aria-hidden />
          </button>
        ) : null}
      </div>
    );
  });

  const body = (
    <div
      ref={panelRef}
      className={cx(
        'ds-wallet-quick-picker',
        variant === 'flyout' ? 'ds-wallet-quick-picker--flyout' : 'ds-wallet-quick-picker--sheet',
        isLight && 'ds-light',
      )}
      style={variant === 'flyout' ? flyoutStyle : undefined}
      role="dialog"
      aria-label={t('wallet.quickPicker.title')}
      data-ds-theme={isLight ? 'light' : 'dark'}
    >
      <div className="ds-wallet-quick-picker__header">
        <p className="ds-wallet-quick-picker__title">{t('wallet.quickPicker.title')}</p>
        {variant === 'sheet' ? (
          <button
            type="button"
            className="ds-wallet-quick-picker__close"
            onClick={onClose}
            aria-label={t('wallet.connectionModal.close')}
          >
            ×
          </button>
        ) : null}
      </div>

      {connectionError ? (
        <div className="ds-wallet-quick-picker__alert">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          <span>{connectionError}</span>
        </div>
      ) : null}

      <div
        className={cx(
          'ds-wallet-quick-picker__grid',
          variant === 'sheet' && 'ds-wallet-quick-picker__grid--list',
        )}
      >
        {tileButtons}
      </div>

      <div className="ds-wallet-quick-picker__footer">
        {openWalletFooter}
        <p className="ds-wallet-quick-picker__hint">{t('wallet.quickPicker.hint')}</p>
      </div>
    </div>
  );

  if (variant === 'sheet') {
    return createPortal(
      <div className={cx('ds-wallet-quick-picker-backdrop', isLight && 'ds-light')} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()}>{body}</div>
      </div>,
      document.body,
    );
  }

  return createPortal(body, document.body);
}
