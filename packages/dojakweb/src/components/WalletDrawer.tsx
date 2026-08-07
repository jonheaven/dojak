'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { useDojakwebTheme } from '../contexts/DojakwebThemeContext';
import { useIsMobileWallet } from '../hooks/useMediaQuery';
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
  initialAssetType?: 'nft' | 'drc20' | 'treats' | 'charms' | 'alkanes';
}

const POS_STORAGE_KEY = 'dojakweb.walletDrawer.pos.v4';
const DEFAULT_RIGHT = 14;
/** Fallback before the browser has measured the drawer. Runtime default is top-safe. */
const DEFAULT_BOTTOM = 28;
const EDGE_PAD = 8;
/** Never let the chassis top closer than this to the viewport top (header / clip). */
const TOP_SAFE = 56;
/** Allow sinking until the chassis bottom touches the viewport bottom. */
const MIN_BOTTOM = 0;
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
    if (
      typeof parsed.right !== 'number' ||
      typeof parsed.bottom !== 'number' ||
      !Number.isFinite(parsed.right) ||
      !Number.isFinite(parsed.bottom)
    ) {
      return null;
    }
    return clampPos(parsed.right, parsed.bottom);
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

function measureDrawerSize(): { w: number; h: number } {
  const drawer =
    document.querySelector<HTMLElement>('.ds-wallet-modal--drawer') ||
    document.querySelector<HTMLElement>('[data-headlessui-portal] .ds-wallet-dashboard');
  const fallbackW = Math.min(390, window.innerWidth * 0.94);
  const vh = window.innerHeight;
  // Preferred chassis height matches CSS: min(78vh, 760px), capped by top-safe.
  const preferredH = Math.min(vh * 0.78, 760, Math.max(120, vh - TOP_SAFE - EDGE_PAD));
  const w = drawer?.offsetWidth || fallbackW;
  const liveH = drawer?.offsetHeight && drawer.offsetHeight > 40 ? drawer.offsetHeight : 0;
  // Prefer preferred height for clamp math so early/late measure don't invert the range.
  const h = liveH > 0 ? Math.min(liveH, preferredH) || preferredH : preferredH;
  return { w, h };
}

function defaultBottom(): number {
  const { h: drawerH } = measureDrawerSize();
  // Highest allowed: chassis top sits at TOP_SAFE.
  return Math.max(MIN_BOTTOM, window.innerHeight - drawerH - TOP_SAFE);
}

function defaultPos(): DrawerPos {
  // Rest near the floor (CSS default); user can drag up toward top-safe.
  return { right: DEFAULT_RIGHT, bottom: DEFAULT_BOTTOM };
}

function clampPos(right: number, bottom: number): DrawerPos {
  const { w: drawerW, h: drawerH } = measureDrawerSize();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxRight = Math.max(EDGE_PAD, vw - drawerW - EDGE_PAD);
  // CSS `bottom` — larger moves the chassis up. Cap so top never goes above TOP_SAFE.
  const maxBottom = Math.max(MIN_BOTTOM, vh - drawerH - TOP_SAFE);
  return {
    right: Math.min(maxRight, Math.max(EDGE_PAD, right)),
    bottom: Math.min(maxBottom, Math.max(MIN_BOTTOM, bottom)),
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
  const isDark = isDarkProp ?? theme === 'dark';
  const isMobile = useIsMobileWallet();
  const [pos, setPos] = useState<DrawerPos | null>(() => readStoredPos() ?? defaultPos());
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originRight: number;
    originBottom: number;
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

  useEffect(() => {
    const body = document.body;
    body.classList.remove('wallet-drawer-paw-open', 'wallet-drawer-mobile-open');
    if (!isOpen) return;
    if (isMobile) {
      body.classList.add('wallet-drawer-mobile-open');
    } else {
      body.classList.add('wallet-drawer-paw-open');
    }
    return () => {
      body.classList.remove('wallet-drawer-paw-open', 'wallet-drawer-mobile-open');
    };
  }, [isOpen, isMobile]);

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

  useEffect(() => {
    if (!isOpen || isMobile) return;
    applyPosVars(pos);
  }, [isOpen, isMobile, pos]);

  useEffect(() => {
    return () => {
      applyPosVars(null);
      document.body.classList.remove('wallet-drawer-dragging');
    };
  }, []);

  useEffect(() => {
    if (!isOpen || isMobile) return;
    // Re-clamp on open so old localStorage positions that lifted the paw get fixed.
    const reclamp = () => {
      setPos((prev) => {
        const base = prev ?? defaultPos();
        const next = clampPos(base.right, base.bottom);
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
  }, [isOpen, isMobile]);

  useEffect(() => {
    if (!isOpen || isMobile || !pos) return;
    const onResize = () => {
      setPos((prev) => {
        if (!prev) return prev;
        const next = clampPos(prev.right, prev.bottom);
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
  }, [isOpen, isMobile, pos]);

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
      if (e.button !== 0 || isMobile) return;
      e.preventDefault();
      e.stopPropagation();
      const origin = pos ?? defaultPos();
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originRight: origin.right,
        originBottom: origin.bottom,
        moved: false,
      };
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [pos, isMobile],
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
    const next = clampPos(
      drag.originRight - deltaX,
      drag.originBottom - deltaY,
    );
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
      const next = clampPos(
        drag.originRight - (e.clientX - drag.startX),
        drag.originBottom - (e.clientY - drag.startY),
      );
      persistPos(next);
    },
    [onClose, persistPos],
  );

  const showPaw = isOpen && !isMobile;

  const paw =
    typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            {showPaw ? (
              <motion.div
                key="wallet-paw"
                className="wallet-paw-grip"
                role="button"
                tabIndex={-1}
                aria-label="Close wallet drawer or drag to reposition"
                title="Click to close. Drag to move."
                variants={gripVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
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
        mode="drawer"
        openNonce={openNonce}
        initialNftFilter={initialNftFilter}
        initialDashboardTab={initialDashboardTab}
        initialAssetType={initialAssetType}
      />
    </>
  );
}
