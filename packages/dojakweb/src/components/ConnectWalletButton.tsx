'use client';

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { WalletIcon } from '@heroicons/react/24/solid';
import DojakwebWalletModal from './DojakwebWalletModal';
import WalletDrawer from './WalletDrawer';
import {
  WalletQuickPicker,
  type WalletDrawerOpenStep,
} from './wallet/WalletQuickPicker';
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openNonce, setOpenNonce] = useState(0);
  const [openFocus, setOpenFocus] = useState<WalletOpenFocus | null>(null);
  const [drawerStep, setDrawerStep] = useState<WalletDrawerOpenStep>('dashboard');
  const buttonRef = useRef<HTMLButtonElement>(null);
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

  const openDrawer = useCallback((step: WalletDrawerOpenStep, focus?: WalletOpenFocus | null) => {
    setPickerOpen(false);
    if (focus !== undefined) setOpenFocus(focus);
    setDrawerStep(step);
    setOpenNonce((n) => n + 1);
    setDrawerOpen(true);
  }, []);

  useEffect(() => {
    if (dxOpenSignal > 0) {
      const focus = useDxHostStore.getState().consumeOpenFocus();
      openDrawer(connected ? 'dashboard' : 'chooser', focus);
    }
  }, [connected, dxOpenSignal, openDrawer]);

  useEffect(() => {
    if (dxCloseSignal > 0) {
      setDrawerOpen(false);
      setPickerOpen(false);
    }
  }, [dxCloseSignal]);

  // Host signing requests always force the drawer open (extension popup pattern).
  useEffect(() => {
    if (approvalPending) {
      setPickerOpen(false);
      setDrawerOpen(true);
      setDrawerStep('dashboard');
      setOpenNonce((n) => n + 1);
    }
  }, [approvalPending?.id]);

  const handleCloseDrawer = useCallback(() => {
    if (walletApprovalStore.getSnapshot()) {
      rejectWalletApproval('User closed the wallet');
    }
    setDrawerOpen(false);
  }, []);

  const buttonAriaLabel =
    connected && address
      ? `${t('wallet.openConnectedAria')} ${address}`
      : t('wallet.quickPicker.openAria');

  const focusProps = {
    openNonce,
    initialNftFilter: openFocus?.nftFilter ?? 'all',
    initialDashboardTab: openFocus?.tab,
    initialAssetType: openFocus?.assetType,
  } as const;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (drawerOpen) {
            setDrawerOpen(false);
          }
          setPickerOpen((open) => !open);
        }}
        aria-label={buttonAriaLabel}
        title={buttonAriaLabel}
        aria-expanded={pickerOpen}
        aria-haspopup="dialog"
        className={[
          'ds-connect-button ds-connect-button--icon relative inline-flex h-10 w-10 min-h-10 min-w-10 shrink-0 appearance-none items-center justify-center rounded-full p-0 font-semibold transition hover:brightness-105',
          'border border-[color:var(--ds-accent-border)]',
          'bg-[linear-gradient(180deg,var(--ds-accent-solid)_0%,var(--ds-accent-solid-hover)_100%)]',
          'text-[color:var(--ds-accent-foreground)]',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className="relative inline-flex h-[1.7rem] w-[1.7rem] shrink-0 items-center justify-center">
          <WalletIcon className="h-full w-full" aria-hidden="true" />
          {connected && address ? (
            <span
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[color:var(--ds-accent-solid)]"
              aria-hidden="true"
            />
          ) : null}
          {approvalPending ? (
            <span
              className="absolute -left-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-[color:var(--ds-accent-solid)] animate-pulse"
              aria-hidden="true"
            />
          ) : null}
        </span>
      </button>

      <WalletQuickPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        variant={isMobile ? 'sheet' : 'flyout'}
        anchorRef={buttonRef}
        onRequestOpenDrawer={(step) => openDrawer(step)}
      />

      {mode === 'drawer' ? (
        <WalletDrawer
          isOpen={drawerOpen}
          onClose={handleCloseDrawer}
          initialStep={drawerStep}
          isDark={isDark}
          {...focusProps}
        />
      ) : (
        <DojakwebWalletModal
          isOpen={drawerOpen}
          onClose={handleCloseDrawer}
          isDark={isDark}
          initialStep={drawerStep}
          mode="modal"
          {...focusProps}
        />
      )}
    </>
  );
}

export default ConnectWalletButton;
