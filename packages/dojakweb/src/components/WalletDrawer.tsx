'use client';

import { useDojakwebTheme } from '../contexts/DojakwebThemeContext';
import DojakwebWalletModal from './DojakwebWalletModal';

interface WalletDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialStep?: 'entry' | 'dashboard' | 'settings';
}

export default function WalletDrawer({ isOpen, onClose, initialStep }: WalletDrawerProps) {
  const { theme } = useDojakwebTheme();
  const isLight = theme === 'light';

  return (
    <DojakwebWalletModal
      isOpen={isOpen}
      onClose={onClose}
      isDark={!isLight}
      initialStep={initialStep}
      mode="drawer"
    />
  );
}