'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { useDojakwebTheme } from '../contexts/DojakwebThemeContext';
import { useIsMobileWallet } from '../hooks/useMediaQuery';
import { useWalletDrawerLayout } from '../hooks/useWalletDrawerLayout';
import { readWalletTheme } from '../lib/wallet-theme-pref';
import DojakwebWalletModal from './DojakwebWalletModal';
/** Bundled Shiba paw — desktop phone-chassis only; never shown on mobile. */
import bundledPawSrc from '../assets/paw.png';

export interface WalletDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialStep?: 'chooser' | 'entry' | 'dashboard' | 'settings' | 'unlock' | 'verification';
  /** Host override (e.g. ConnectWalletButton isDark). Falls back to DojakwebThemeProvider. */
  isDark?: boolean;
  openNonce?: number;
  initialNftFilter?: 'all' | 'media' | 'dlotto';
  initialDashboardTab?: 'assets' | 'transactions' | 'listings';
  initialAssetType?: 'nft' | 'drc20' | 'treats' | 'dunes' | 'charms' | 'alkanes';
}

const POS_STORAGE_KEY = 'dojakweb.walletDrawer.pos.v6';
const DEFAULT_RIGHT = 14;
/** Phone sits in the lower-right. Vertical is locked — only X is draggable. */
const DEFAULT_BOTTOM = 28;
const EDGE_PAD = 8;
const CLICK_DRAG_THRESHOLD_PX = 6;

type DrawerPos = { right: number; bottom: number };

const gripVariants: Variants = {
  hidden: {
    opacity: 0,
    x: 56,
    y: 48,
    rotate: -38,
    scale: 0.86,
  },
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    rotate: -21,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 340,
      damping: 26,
      mass: 0.85,
      delay: 0.1,
    },
  },
  exit: {
    opacity: 0,
    x: 40,
    y: 32,
    rotate: -30,
    scale: 0.9,
    transition: { duration: 0.24, ease: [0.4, 0, 0.85, 1] },
  },
};

const pawImgVariants: Variants = {
  hidden: { scale: 1.08, y: 6 },
  visible: {
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 420,
      damping: 28,
      delay: 0.18,
    },
  },
  exit: { scale: 0.96, y: 4, transition: { duration: 0.18 } },
};

function readStoredPos(): DrawerPos | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(POS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DrawerPos>;
    if (typeof parsed.right !== 'number' || !Number.isFinite(parsed.right)) return null;
    return clampPos(parsed.right);
  } catch {
    return null;
  }
}

function applyPosVars(pos: DrawerPos | null) {
  const body = document.body;
  if (!pos) {
    body.style.removeProperty('--wallet-drawer-right');
    body.style.removeProperty('--wallet-drawer-bottom');
    return;
  }
  body.style.setProperty('--wallet-drawer-right', `${Math.round(pos.right)}px`);
  body.style.setProperty('--wallet-drawer-bottom', `${Math.round(pos.bottom)}px`);
}

function drawerWidth(): number {
  const drawer =
    document.querySelector<HTMLElement>('.ds-wallet-modal--drawer') ||
    document.querySelector<HTMLElement>('[data-headlessui-portal] .ds-wallet-dashboard');
  const fallbackW = Math.min(390, window.innerWidth * 0.94);
  return drawer?.offsetWidth || fallbackW;
}

function defaultPos(): DrawerPos {
  if (typeof window === 'undefined') {
    return { right: DEFAULT_RIGHT, bottom: DEFAULT_BOTTOM };
  }
  return clampPos(DEFAULT_RIGHT);
}

function clampPos(right: number): DrawerPos {
  if (typeof window === 'undefined') {
    return { right: Math.max(EDGE_PAD, right), bottom: DEFAULT_BOTTOM };
  }
  const drawerW = drawerWidth();
  const maxRight = Math.max(EDGE_PAD, window.innerWidth - drawerW - EDGE_PAD);
  return {
    right: Math.min(maxRight, Math.max(EDGE_PAD, right)),
    bottom: DEFAULT_BOTTOM,
  };
}

/**
 * Dojakweb wallet drawer.
 * Desktop: floating phone chassis + Shiba paw grip (draggable).
 * Mobile (≤768px): full-screen app sheet — no paw, no floating panel.
 */
export default function WalletDrawer({
  isOpen,
  onClose,
  initialStep,
  isDark: isDarkProp,
  openNonce,
  initialNftFilter,
  initialDashboardTab,
  initialAssetType,
}: WalletDrawerProps) {
  const { theme } = useDojakwebTheme();
  // User Dark/Light in Settings wins. Host `isDark` is only the live default
  // before the user has picked a wallet chrome theme.
  const isDark =
    readWalletTheme() != null || isDarkProp === undefined
      ? theme === 'dark'
      : Boolean(isDarkProp);
  const isMobile = useIsMobileWallet();
  const [layout] = useWalletDrawerLayout();
  const isModal = !isMobile && layout === 'modal';
  const isDock = !isMobile && layout === 'dock';
  const isPawLayout = !isMobile && layout === 'paw';
  const [pos, setPos] = useState<DrawerPos | null>(() => readStoredPos() ?? defaultPos());
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originRight: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Same as pressing X — dismiss drawer / cancel pending approval.
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, onClose]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const body = document.body;
    const html = document.documentElement;
    body.classList.remove(
      'wallet-drawer-paw-open',
      'wallet-drawer-mobile-open',
      'wallet-drawer-dock-open',
      'wallet-drawer-has-paw',
    );
    html.classList.remove('wallet-drawer-dock-open');
    if (isMobile) {
      body.classList.add('wallet-drawer-mobile-open');
    } else if (isModal) {
      /* centered dialog — no chassis / dock shift */
    } else if (isDock) {
      body.classList.add('wallet-drawer-dock-open', 'wallet-drawer-has-paw');
      html.classList.add('wallet-drawer-dock-open');
    } else {
      body.classList.add('wallet-drawer-paw-open', 'wallet-drawer-has-paw');
    }
    return () => {
      body.classList.remove(
        'wallet-drawer-paw-open',
        'wallet-drawer-mobile-open',
        'wallet-drawer-dock-open',
        'wallet-drawer-has-paw',
      );
      html.classList.remove('wallet-drawer-dock-open');
    };
  }, [isOpen, isMobile, isDock, isModal]);

  useEffect(() => {
    if (!isOpen || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen, isMobile]);

  useEffect(() => {
    document.body.classList.toggle('wallet-drawer-dragging', dragging);
    return () => document.body.classList.remove('wallet-drawer-dragging');
  }, [dragging]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    if (isMobile || isDock || isModal) {
      applyPosVars(null);
      return;
    }
    applyPosVars(pos);
    return () => {
      applyPosVars(null);
    };
  }, [isOpen, isMobile, isDock, isModal, pos]);

  useEffect(() => {
    return () => {
      applyPosVars(null);
      document.body.classList.remove('wallet-drawer-dragging');
    };
  }, []);

  useEffect(() => {
    if (!isOpen || isMobile || isDock || isModal) return;
    // Re-clamp on open so old localStorage positions that lifted the paw get fixed.
    const reclamp = () => {
      setPos((prev) => {
        const next = clampPos((prev ?? defaultPos()).right);
        applyPosVars(next);
        try {
          window.localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    };
    reclamp();
    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(reclamp);
    });
    const drawer =
      document.querySelector<HTMLElement>('.ds-wallet-modal--drawer') ||
      document.querySelector<HTMLElement>('[data-headlessui-portal] .ds-wallet-dashboard');
    let ro: ResizeObserver | null = null;
    if (drawer && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => reclamp());
      ro.observe(drawer);
    }
    return () => {
      window.cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [isOpen, isMobile, isDock, isModal]);

  useEffect(() => {
    if (!isOpen || isMobile || isDock || isModal || !pos) return;
    const onResize = () => {
      setPos((prev) => {
        if (!prev) return prev;
        const next = clampPos(prev.right);
        try {
          window.localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore quota */
        }
        applyPosVars(next);
        return next;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isOpen, isMobile, isDock, isModal, pos]);

  const persistPos = useCallback((next: DrawerPos) => {
    setPos(next);
    try {
      window.localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || !isPawLayout) return;
      e.preventDefault();
      e.stopPropagation();
      const origin = pos ?? defaultPos();
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originRight: origin.right,
        moved: false,
      };
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [pos, isPawLayout],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.preventDefault();
    const deltaX = e.clientX - drag.startX;
    const deltaY = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) > CLICK_DRAG_THRESHOLD_PX) {
      drag.moved = true;
    }
    const next = clampPos(drag.originRight - deltaX);
    applyPosVars(next);
    setPos(next);
  }, []);

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      dragRef.current = null;
      setDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      const wasClick =
        !drag.moved &&
        Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) <= CLICK_DRAG_THRESHOLD_PX;
      if (wasClick) {
        onClose();
        return;
      }
      const next = clampPos(drag.originRight - (e.clientX - drag.startX));
      persistPos(next);
    },
    [onClose, persistPos],
  );

  const showPaw = isOpen && !isMobile && !isModal;

  const paw =
    typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            {showPaw ? (
              <motion.div
                key="wallet-paw"
                className={`wallet-paw-grip${isDock ? ' wallet-paw-grip--docked' : ''}`}
                role="button"
                tabIndex={-1}
                aria-label={
                  isDock
                    ? 'Close wallet'
                    : 'Close wallet or drag sideways to reposition'
                }
                title={isDock ? 'Click to close' : 'Click to close. Drag left or right to move.'}
                variants={gripVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onPointerDown={isPawLayout ? onPointerDown : undefined}
                onPointerMove={isPawLayout ? onPointerMove : undefined}
                onPointerUp={isPawLayout ? endDrag : undefined}
                onPointerCancel={isPawLayout ? endDrag : undefined}
                onClick={
                  isDock
                    ? (e) => {
                        e.preventDefault();
                        onClose();
                      }
                    : undefined
                }
              >
                <motion.img
                  src={bundledPawSrc}
                  alt=""
                  draggable={false}
                  variants={pawImgVariants}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <>
      {paw}
      <DojakwebWalletModal
        isOpen={isOpen}
        onClose={onClose}
        isDark={isDark}
        initialStep={initialStep}
        mode={isModal ? 'modal' : 'drawer'}
        openNonce={openNonce}
        initialNftFilter={initialNftFilter}
        initialDashboardTab={initialDashboardTab}
        initialAssetType={initialAssetType}
      />
    </>
  );
}
