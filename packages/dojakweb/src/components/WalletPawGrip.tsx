'use client';

import type { PointerEvent } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import bundledPawSrc from '../assets/paw.png';

const gripVariants: Variants = {
  hidden: { opacity: 0, x: 56, y: 48, rotate: -38, scale: 0.86 },
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    rotate: -21,
    scale: 1,
    transition: { type: 'spring', stiffness: 340, damping: 26, mass: 0.85, delay: 0.1 },
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
    transition: { type: 'spring', stiffness: 420, damping: 28, delay: 0.18 },
  },
  exit: { scale: 0.96, y: 4, transition: { duration: 0.18 } },
};

export function WalletPawGrip({
  show,
  isDock,
  isPawLayout,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onDockClose,
}: {
  show: boolean;
  isDock: boolean;
  isPawLayout: boolean;
  onPointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel?: (e: PointerEvent<HTMLDivElement>) => void;
  onDockClose?: () => void;
}) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="wallet-paw"
          className={`wallet-paw-grip${isDock ? ' wallet-paw-grip--docked' : ''}`}
          role="button"
          tabIndex={-1}
          aria-label={isDock ? 'Close wallet' : 'Close wallet or drag sideways to reposition'}
          title={isDock ? 'Click to close' : 'Click to close. Drag left or right to move.'}
          variants={gripVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onPointerDown={isPawLayout ? onPointerDown : undefined}
          onPointerMove={isPawLayout ? onPointerMove : undefined}
          onPointerUp={isPawLayout ? onPointerUp : undefined}
          onPointerCancel={isPawLayout ? onPointerCancel : undefined}
          onClick={
            isDock
              ? (e) => {
                  e.preventDefault();
                  onDockClose?.();
                }
              : undefined
          }
        >
          <motion.img src={bundledPawSrc} alt="" draggable={false} variants={pawImgVariants} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
