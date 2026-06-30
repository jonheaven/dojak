'use client';

import { useDojakwebTheme } from '../contexts/DojakwebThemeContext';
import DojakwebWalletModal from './DojakwebWalletModal';

interface WalletDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialStep?: 'entry' | 'dashboard' | 'settings';
  /** Host override (e.g. ConnectWalletButton isDark). Falls back to DojakwebThemeProvider. */
  isDark?: boolean;
}

export default function WalletDrawer({ isOpen, onClose, initialStep, isDark: isDarkProp }: WalletDrawerProps) {
  const { theme } = useDojakwebTheme();
  const isDark = isDarkProp ?? theme === 'dark';

  return (
    <DojakwebWalletModal
      isOpen={isOpen}
      onClose={onClose}
      isDark={isDark}
      initialStep={initialStep}
      mode="drawer"
    />
  );
}
