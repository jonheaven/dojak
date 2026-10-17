'use client';

import React, { lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/solid';
import { Wallet } from 'lucide-react';
import WalletDrawer from './WalletDrawer';

const DojakwebWalletModal = lazy(() => import('./DojakwebWalletModal'));
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
  isWalletApprovalWorking,
  getWalletApprovalPending,
  walletApprovalStore,
} from '../stores/walletApprovalStore';
import {
  claimWalletDrawerHost,
  dismissWalletDrawer,
  getWalletDrawerServerSnapshot,
  getWalletDrawerSnapshot,
  isWalletDrawerHost,
  presentWalletDrawer,
  releaseWalletDrawerHost,
  subscribeWalletDrawer,
  type WalletDrawerStep,
} from '../stores/walletDrawerStore';
import { BrowserWallet } from '../lib/browser-wallet';

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
  const [savedLocal, setSavedLocal] = useState(() => BrowserWallet.peekSaved());
  const drawer = useSyncExternalStore(
    subscribeWalletDrawer,
    getWalletDrawerSnapshot,
    getWalletDrawerServerSnapshot,
  );
  const drawerOpen = drawer.open;
  const hostIdRef = useRef(0);
  if (hostIdRef.current === 0) hostIdRef.current = claimWalletDrawerHost();
  const isDrawerHost = isWalletDrawerHost(hostIdRef.current);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { connected, address } = useUnifiedWallet();
  const connectedRef = useRef(connected);
  connectedRef.current = connected;
  const { t } = useDojakwebI18n();
  const dxOpenSignal = useDxHostStore((s) => s.openWalletSignal);
  const dxCloseSignal = useDxHostStore((s) => s.closeWalletSignal);
  const seenOpenSignal = useRef(dxOpenSignal);
  const seenCloseSignal = useRef(dxCloseSignal);
  const approvalPending = useSyncExternalStore(
    walletApprovalStore.subscribe,
    walletApprovalStore.getSnapshot,
    walletApprovalStore.getServerSnapshot,
  );
  const isMobile = useIsMobileWallet();

  useEffect(() => {
    const id = hostIdRef.current;
    return () => releaseWalletDrawerHost(id);
  }, []);

  const openDrawer = useCallback((step: WalletDrawerStep, focus?: WalletOpenFocus | null) => {
    setPickerOpen(false);
    presentWalletDrawer({
      step,
      focus: focus === undefined ? undefined : focus,
      isDark,
      mode,
    });
  }, [isDark, mode]);

  useEffect(() => {
    setSavedLocal(BrowserWallet.peekSaved());
  }, [connected, drawerOpen]);

  // Open from hosts (Buy, Ð𝕏, `openWalletDrawer`). Only react to a new signal —
  // a connect/unlock must not slide a second phone in over the one already open.
  useEffect(() => {
    if (!isDrawerHost || dxOpenSignal === 0 || dxOpenSignal === seenOpenSignal.current) return;
    seenOpenSignal.current = dxOpenSignal;
    const focus = useDxHostStore.getState().consumeOpenFocus();
    const approval = getWalletApprovalPending();
    const step: WalletDrawerOpenStep =
      approval || connectedRef.current ? 'dashboard' : savedLocal ? 'unlock' : 'chooser';
    openDrawer(step, focus);
  }, [dxOpenSignal, isDrawerHost, openDrawer, savedLocal]);

  useEffect(() => {
    if (!isDrawerHost || dxCloseSignal === 0 || dxCloseSignal === seenCloseSignal.current) return;
    seenCloseSignal.current = dxCloseSignal;
    dismissWalletDrawer();
  }, [dxCloseSignal, isDrawerHost]);

  const handleCloseDrawer = useCallback(() => {
    const pending = getWalletApprovalPending();
    if (pending) {
      // Signing already in flight — closing would orphan a possibly-broadcast tx.
      if (isWalletApprovalWorking() || pending.status === 'working') {
        return;
      }
      rejectWalletApproval('User closed the wallet');
    }
    dismissWalletDrawer();
  }, []);

  const toggleDrawer = useCallback(() => {
    setPickerOpen(false);
    if (drawerOpen) {
      handleCloseDrawer();
      return;
    }
    openDrawer('dashboard');
  }, [drawerOpen, handleCloseDrawer, openDrawer]);

  const togglePicker = useCallback(() => {
    setPickerOpen((open) => !open);
  }, []);

  const buttonAriaLabel =
    connected && address
      ? drawerOpen
        ? t('wallet.closeConnectedAria')
        : t('wallet.openConnectedAria')
      : savedLocal
        ? drawerOpen
          ? t('wallet.closeConnectedAria')
          : t('wallet.unlockSavedAria')
        : t('wallet.quickPicker.openAria');

  const switchAriaLabel = t('wallet.quickPicker.switchAria');

  const focusProps = {
    openNonce: drawer.nonce,
    initialNftFilter: drawer.focus?.nftFilter ?? 'all',
    initialDashboardTab: drawer.focus?.tab,
    initialAssetType: drawer.focus?.assetType,
  } as const;

  return (
    <>
      <span className="relative inline-flex shrink-0">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => {
            if (connected) {
              toggleDrawer();
              return;
            }
            // Saved local wallet: PIN. The connector list is the switch only.
            if (savedLocal) {
              if (drawerOpen) {
                handleCloseDrawer();
                return;
              }
              openDrawer('unlock');
              return;
            }
            if (drawerOpen) {
              handleCloseDrawer();
            }
            togglePicker();
          }}
          aria-label={buttonAriaLabel}
          title={buttonAriaLabel}
          aria-expanded={connected || savedLocal ? drawerOpen : pickerOpen}
          aria-haspopup={connected || savedLocal ? 'dialog' : 'menu'}
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
            <Wallet className="h-full w-full" strokeWidth={1.75} aria-hidden="true" />
            {connected && address && !approvalPending ? (
              <span
                className="absolute -left-0.5 -bottom-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-[color:var(--ds-accent-solid)]"
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

        {(connected && address) || savedLocal ? (
          <button
            type="button"
            className="ds-connect-button__switch absolute -right-1 -top-1 z-[1] inline-flex h-4 w-4 items-center justify-center rounded-full border border-[color:var(--ds-accent-border)] bg-[color:var(--ds-bg-elevated,#121212)] text-[color:var(--ds-accent-solid)] shadow-md transition hover:brightness-110"
            aria-label={switchAriaLabel}
            title={switchAriaLabel}
            aria-expanded={pickerOpen}
            aria-haspopup="menu"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              togglePicker();
            }}
          >
            <ArrowsRightLeftIcon className="h-2.5 w-2.5" aria-hidden="true" />
          </button>
        ) : null}
      </span>

      <WalletQuickPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        variant={isMobile ? 'sheet' : 'flyout'}
        anchorRef={buttonRef}
        onRequestOpenDrawer={(step) => openDrawer(step)}
        isDark={isDark}
      />

      {isDrawerHost && drawer.mode === 'modal' && drawerOpen ? (
        <Suspense fallback={null}>
          <DojakwebWalletModal
            isOpen={drawerOpen}
            onClose={handleCloseDrawer}
            isDark={drawer.isDark ?? isDark}
            initialStep={drawer.step}
            mode="modal"
            {...focusProps}
          />
        </Suspense>
      ) : isDrawerHost ? (
        <WalletDrawer
          isOpen={drawerOpen}
          onClose={handleCloseDrawer}
          initialStep={drawer.step}
          isDark={drawer.isDark ?? isDark}
          {...focusProps}
        />
      ) : null}
    </>
  );
}

export default ConnectWalletButton;
