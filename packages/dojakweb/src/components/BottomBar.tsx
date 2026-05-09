import React from 'react';
import {
  BoltIcon,
  WifiIcon,
  SunIcon,
  MoonIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import { EllipsisVerticalIcon } from '@heroicons/react/24/solid';
import { Coins } from 'lucide-react';
import { useLiveActivity } from '../contexts/LiveActivityContext';
import { useDogePriceContext } from '../contexts/DogePriceContext';
import { DogeCurrencyIcon } from './DogeCurrencyIcon';

interface BottomBarProps {
  dogecoinPrice: number | null;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  onSettingsClick?: () => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  dogecoinPrice: _dogecoinPriceProp,
  theme,
  onThemeToggle,
  onSettingsClick
}) => {
  const { sentinelStatus } = useLiveActivity();
  const { dogecoinPrice } = useDogePriceContext();
  const getThemeIcon = () => {
    return theme === 'light' ? <MoonIcon className="w-4 h-4" /> : <SunIcon className="w-4 h-4" />;
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 bg-bg-primary border-t border-border-primary h-10 flex items-center justify-between px-4 text-sm">
      {/* Left Section */}
      <div className="flex items-center space-x-6">
        {/* Live Indicator */}
        <div
          className="flex items-center space-x-2 group cursor-help"
          title={
            sentinelStatus.isConnected
              ? `Connected to Doginals Sentinel\nLast activity: ${sentinelStatus.lastActivity ? new Date(sentinelStatus.lastActivity).toLocaleTimeString() : 'None'}\nConnection attempts: ${sentinelStatus.connectionAttempts}`
              : `Disconnected from Doginals Sentinel\n${sentinelStatus.errorMessage || 'Service may not be running'}\nConnection attempts: ${sentinelStatus.connectionAttempts}`
          }
        >
          <div className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${sentinelStatus.isConnected ? 'bg-green-400 animate-pulse-slow' : 'bg-red-400'}`}></div>
            <span className={`font-medium ${sentinelStatus.isConnected ? 'text-green-400' : 'text-red-400'}`}>
              {sentinelStatus.isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Vertical Divider */}
        <div className="w-px h-4 bg-border-primary"></div>

        {/* Aggregating */}
        <div className="flex items-center space-x-2 text-text-secondary">
          <BoltIcon className="w-4 h-4" />
          <span>Aggregating</span>
        </div>

        {/* Vertical Divider */}
        <div className="w-px h-4 bg-border-primary"></div>

        {/* Wallet stack */}
        <div className="flex items-center space-x-2 text-text-secondary">
          <WifiIcon className="w-4 h-4" />
          <span>Wallet stack</span>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-4">
        {/* DOGE Price - only show when available */}
        {dogecoinPrice && (
          <div className="flex items-center space-x-1 font-mono text-text-primary">
            <DogeCurrencyIcon size="md" />
            <span>${dogecoinPrice.toFixed(4)}</span>
          </div>
        )}

        {/* Theme Toggle */}
        <button
          onClick={onThemeToggle}
          className="p-1 rounded-md hover:bg-bg-secondary transition-colors duration-200"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {getThemeIcon()}
        </button>

        {/* Settings */}
        <button
          onClick={onSettingsClick}
          className="p-1 rounded-md hover:bg-bg-secondary transition-colors duration-200"
          title="Open Dojakweb wallet modal"
        >
          <CogIcon className="w-4 h-4 text-text-secondary" />
        </button>

        {/* More Options */}
        <button className="p-1 rounded-md hover:bg-bg-secondary transition-colors duration-200">
          <EllipsisVerticalIcon className="w-4 h-4 text-text-secondary" />
        </button>
      </div>
    </footer>
  );
};
