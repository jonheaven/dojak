'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import WalletDrawer from './WalletDrawer';

export type WalletPawDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
  initialStep?: 'entry' | 'dashboard' | 'settings';
  /**
   * Shibe paw image URL. Hosts should serve `paw.png` from public/ (or override).
   * Bundled default path works for doge.cam / drok / any host that copies the asset.
   */
  pawSrc?: string;
  /** Set false to open the drawer without the gripping paw (rare). Default true. */
  showPaw?: boolean;
};

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

/**
 * Wallet drawer with the Shiba Inu paw grip — shared by all @dojak/web hosts
 * (doge.cam, drok.lol, etc.). Toggles `body.wallet-drawer-paw-open` for host CSS.
 */
export function WalletPawDrawer({
  isOpen,
  onClose,
  isDark,
  initialStep,
  pawSrc = '/paw.png',
  showPaw = true,
}: WalletPawDrawerProps) {
  useEffect(() => {
    if (!showPaw) return;
    document.body.classList.toggle('wallet-drawer-paw-open', isOpen);
    return () => document.body.classList.remove('wallet-drawer-paw-open');
  }, [isOpen, showPaw]);

  const paw =
    showPaw && typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            {isOpen ? (
              <motion.div
                key="wallet-paw"
                className="wallet-paw-grip"
                role="presentation"
                variants={gripVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                aria-hidden
              >
                <motion.img
                  src={pawSrc}
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
      <WalletDrawer
        isOpen={isOpen}
        onClose={onClose}
        isDark={isDark}
        initialStep={initialStep}
      />
      {paw}
    </>
  );
}

export default WalletPawDrawer;
