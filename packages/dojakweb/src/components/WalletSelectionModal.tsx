'use client';

import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';
import DojakwebWalletModal from './DojakwebWalletModal';
import { WalletConnectChooser } from './WalletConnectChooser';
import { useDojakwebI18n } from '../contexts/DojakwebLocaleContext';
import { useDojakwebTheme } from '../contexts/DojakwebThemeContext';

interface WalletSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'modal' | 'drawer';
  drawerSide?: 'left' | 'right';
}

export default function WalletSelectionModal({
  isOpen,
  onClose,
  mode = 'drawer',
  drawerSide = 'right',
}: WalletSelectionModalProps) {
  const { walletType } = useUnifiedWallet();
  const { t } = useDojakwebI18n();
  const { theme } = useDojakwebTheme();
  const isLight = theme === 'light';

  const [showBrowserWallet, setShowBrowserWallet] = useState(false);

  const handleBrowserWalletClose = useCallback(() => {
    setShowBrowserWallet(false);
    if (walletType === 'browser') {
      onClose();
    }
  }, [walletType, onClose]);

  if (!isOpen) {
    return null;
  }

  const isDrawerMode = mode === 'drawer';
  const drawerBackdropClass = isDrawerMode
    ? ` ds-wallet-modal-backdrop--drawer${drawerSide === 'left' ? ' ds-wallet-modal-backdrop--drawer-left' : ''}`
    : '';
  const drawerModalClass = isDrawerMode
    ? ` ds-wallet-modal--drawer${drawerSide === 'left' ? ' ds-wallet-modal--drawer-left' : ''}`
    : '';

  const modalMarkup = (
    <div
      className={`ds-wallet-modal-backdrop${drawerBackdropClass}${isLight ? ' ds-light' : ''}`}
      onClick={isDrawerMode ? undefined : onClose}
    >
      <div className={`ds-wallet-modal${drawerModalClass}`} onClick={(e) => e.stopPropagation()}>
        <div className="ds-wallet-modal__hero">
          <div>
            <h2 className="text-xl font-bold leading-tight tracking-tight text-[color:var(--ds-text)] sm:text-2xl">
              {t('wallet.connectionModal.title')}
            </h2>
            <p className="sr-only">{t('wallet.connectionModal.eyebrow')}</p>
            <p className="sr-only">{t('wallet.connectionModal.subtitle')}</p>
          </div>
          <button
            onClick={onClose}
            className="ds-wallet-modal__close"
            aria-label={t('wallet.connectionModal.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <WalletConnectChooser
          onSelectBrowser={() => setShowBrowserWallet(true)}
          onConnected={onClose}
        />
      </div>
    </div>
  );

  return (
    <>
      {showBrowserWallet && (
        <DojakwebWalletModal
          isOpen={showBrowserWallet}
          onClose={handleBrowserWalletClose}
          isDark={!isLight}
          mode={mode}
          drawerSide={drawerSide}
          initialStep="entry"
        />
      )}
      {!showBrowserWallet &&
        (typeof document !== 'undefined' ? createPortal(modalMarkup, document.body) : null)}
    </>
  );
}
