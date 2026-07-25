'use client';

import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { WalletIcon } from '@heroicons/react/24/solid';
import DojakwebWalletModal from './DojakwebWalletModal';
import WalletDrawer from './WalletDrawer';
import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';
import { useDojakwebI18n } from '../contexts/DojakwebLocaleContext';
import { useDxHostStore, type WalletOpenFocus } from '../stores/dxHostStore';
import { useIsMobileWallet } from '../hooks/useMediaQuery';
import {
  rejectWalletApproval,
  walletApprovalStore,
} from '../stores/walletApprovalStore';

export interface ConnectWalletButtonProps {
  className?: string;
  isDark?: boolean;
  /** drawer (default) or centered modal. */
  mode?: 'drawer' | 'modal';
}

export function ConnectWalletButton({
  className = '',
  isDark = true,
  mode = 'drawer',
}: ConnectWalletButtonProps) {
  const [open, setOpen] = useState(false);
  const [openNonce, setOpenNonce] = useState(0);
  const [openFocus, setOpenFocus] = useState<WalletOpenFocus | null>(null);
  const { connected, address } = useUnifiedWallet();
  const { t } = useDojakwebI18n();
  const dxOpenSignal = useDxHostStore((s) => s.openWalletSignal);
  const dxCloseSignal = useDxHostStore((s) => s.closeWalletSignal);
  const approvalPending = useSyncExternalStore(
    walletApprovalStore.subscribe,
    walletApprovalStore.getSnapshot,
    walletApprovalStore.getServerSnapshot,
  );
  const isMobile = useIsMobileWallet();

  useEffect(() => {
    if (dxOpenSignal > 0) {
      const focus = useDxHostStore.getState().consumeOpenFocus();
      setOpenFocus(focus);
      setOpenNonce((n) => n + 1);
      setOpen(true);
    }
  }, [dxOpenSignal]);

  useEffect(() => {
    if (dxCloseSignal > 0) setOpen(false);
  }, [dxCloseSignal]);

  // Host signing requests always force the drawer open (extension popup pattern).
  useEffect(() => {
    if (approvalPending) setOpen(true);
  }, [approvalPending?.id]);

  const handleClose = useCallback(() => {
    if (walletApprovalStore.getSnapshot()) {
      rejectWalletApproval('User closed the wallet');
    }
    setOpen(false);
  }, []);

  const buttonLabel =
    connected && address ? `${address.slice(0, 6)}...${address.slice(-4)}` : t('wallet.connect');

  const buttonAriaLabel =
    connected && address
      ? `${t('wallet.openConnectedAria')} ${address}`
      : t('wallet.connect');

  const initialStep = connected ? 'dashboard' : 'chooser';

  const focusProps = {
    openNonce,
    initialNftFilter: openFocus?.nftFilter ?? 'all',
    initialDashboardTab: openFocus?.tab,
    initialAssetType: openFocus?.assetType,
  } as const;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpenFocus(null);
          setOpenNonce((n) => n + 1);
          setOpen(true);
        }}
        aria-label={buttonAriaLabel}
        title={buttonAriaLabel}
        className={[
          'ds-connect-button inline-flex appearance-none items-center justify-center font-semibold transition hover:brightness-105',
          'border border-[color:var(--ds-accent-border)]',
          'bg-[linear-gradient(180deg,var(--ds-accent-solid)_0%,var(--ds-accent-solid-hover)_100%)]',
          'text-[color:var(--ds-accent-foreground)]',
          isMobile
            ? 'ds-connect-button--icon relative h-10 w-10 min-h-10 shrink-0 rounded-full p-0'
            : 'min-h-10 gap-3 rounded-lg px-4 py-2 text-sm',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {isMobile ? (
          <>
            <WalletIcon className="h-5 w-5" aria-hidden="true" />
            {connected && address ? (
              <span
                className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-[color:var(--ds-accent-solid)]"
                aria-hidden="true"
              />
            ) : null}
            {approvalPending ? (
              <span
                className="absolute left-1 top-1 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-[color:var(--ds-accent-solid)] animate-pulse"
                aria-hidden="true"
              />
            ) : null}
          </>
        ) : (
          <>
            <span>{buttonLabel}</span>
            {connected && address ? (
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
            ) : null}
            {approvalPending ? (
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
            ) : null}
          </>
        )}
      </button>
      {mode === 'drawer' ? (
        <WalletDrawer
          isOpen={open}
          onClose={handleClose}
          initialStep={initialStep}
          isDark={isDark}
          {...focusProps}
        />
      ) : (
        <DojakwebWalletModal
          isOpen={open}
          onClose={handleClose}
          isDark={isDark}
          initialStep={initialStep}
          mode="modal"
          {...focusProps}
        />
      )}
    </>
  );
}

export default ConnectWalletButton;
