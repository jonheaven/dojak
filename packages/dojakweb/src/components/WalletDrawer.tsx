'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { useDojakwebTheme } from '../contexts/DojakwebThemeContext';
import DojakwebWalletModal from './DojakwebWalletModal';
/** Bundled Shiba paw — part of the web wallet; hosts do not supply this. */
import bundledPawSrc from '../assets/paw.png';

export interface WalletDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialStep?: 'entry' | 'dashboard' | 'settings';
  /** Host override (e.g. ConnectWalletButton isDark). Falls back to DojakwebThemeProvider. */
  isDark?: boolean;
}

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
 * Dojakweb wallet drawer with built-in Shiba Inu paw grip.
 * This is the only implementation — open it from hosts via WalletDrawer / ConnectWalletButton.
 */
export default function WalletDrawer({
  isOpen,
  onClose,
  initialStep,
  isDark: isDarkProp,
}: WalletDrawerProps) {
  const { theme } = useDojakwebTheme();
  const isDark = isDarkProp ?? theme === 'dark';

  useEffect(() => {
    document.body.classList.toggle('wallet-drawer-paw-open', isOpen);
    return () => document.body.classList.remove('wallet-drawer-paw-open');
  }, [isOpen]);

  const paw =
    typeof document !== 'undefined'
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

  // Render paw first (under), then drawer — stacking + CSS z-index keep grip beneath panel
  return (
    <>
      {paw}
      <DojakwebWalletModal
        isOpen={isOpen}
        onClose={onClose}
        isDark={isDark}
        initialStep={initialStep}
        mode="drawer"
      />
    </>
  );
}
