import React, { useEffect, useState } from 'react';
import {
  WifiIcon,
  ShoppingBagIcon,
  SparklesIcon,
  ArrowRightIcon,
  XMarkIcon,
  CubeIcon
} from '@heroicons/react/24/outline';

import { useDoginalDrawer } from '../contexts/DoginalDrawerContext';

interface LiveActivityToastProps {
  message: string;
  type: 'network' | 'marketplace' | 'mint' | 'transfer';
  personal?: boolean;
  drawerData?: any;
  duration?: number;
  onClose: () => void;
}

export const LiveActivityToast: React.FC<LiveActivityToastProps> = ({
  message,
  type,
  personal = false,
  drawerData,
  duration = 6000, // Longer duration for live activity
  onClose
}) => {
  const { openDrawer } = useDoginalDrawer();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let isClosed = false;
    const startTime = Date.now();

    const interval = setInterval(() => {
      if (isClosed) return; // Prevent updates after closing

      const elapsed = Date.now() - startTime;
      const progressPercent = Math.min((elapsed / duration) * 100, 100);
      setProgress(progressPercent);

      if (progressPercent >= 100 && !isClosed) {
        isClosed = true;
        clearInterval(interval);
        // Use setTimeout to ensure state update completes
        setTimeout(() => {
          try {
            onClose();
          } catch (error) {
            console.error('Error in toast onClose:', error);
          }
        }, 200);
      }
    }, 100); // Reduce frequency from 50ms to 100ms

    return () => {
      clearInterval(interval);
      isClosed = true;
    };
  }, [duration]); // Remove onClose from dependencies to prevent re-creation

  const getToastStyles = () => {
    const baseStyles = (() => {
      switch (type) {
        case 'network':
          return {
            bg: 'bg-purple-900/95',
            border: 'border-purple-600/60',
            icon: <WifiIcon className="w-4 h-4 text-purple-300" />,
            progress: 'bg-purple-400',
            glow: 'shadow-purple-500/25'
          };
        case 'marketplace':
          return {
            bg: 'bg-orange-900/95',
            border: 'border-orange-600/60',
            icon: <ShoppingBagIcon className="w-4 h-4 text-orange-300" />,
            progress: 'bg-orange-400',
            glow: 'shadow-orange-500/25'
          };
        case 'mint':
          return {
            bg: 'bg-emerald-900/95',
            border: 'border-emerald-600/60',
            icon: <SparklesIcon className="w-4 h-4 text-emerald-300" />,
            progress: 'bg-emerald-400',
            glow: 'shadow-emerald-500/25'
          };
        case 'transfer':
        default:
          return {
            bg: 'bg-blue-900/95',
            border: 'border-blue-600/60',
            icon: <ArrowRightIcon className="w-4 h-4 text-blue-300" />,
            progress: 'bg-blue-400',
            glow: 'shadow-blue-500/25'
          };
      }
    })();

    // Add personal highlighting
    if (personal) {
      return {
        ...baseStyles,
        border: 'border-emerald-400 ring-2 ring-emerald-400/50',
        glow: 'shadow-emerald-400/50'
      };
    }

    return baseStyles;
  };

  const styles = getToastStyles();

  const handleClick = () => {
    if (drawerData) {
      openDrawer(drawerData);
    }
  };

  const isClickable = !!drawerData;

  return (
    <div
      className={`relative max-w-md w-full ${styles.bg} border ${styles.border} rounded-lg shadow-lg backdrop-blur-sm animate-fade-in ${styles.glow} ${
        isClickable ? 'cursor-pointer hover:scale-105 hover:shadow-xl' : ''
      } transition-all duration-200`}
      onClick={handleClick}
    >
      <div className="flex items-start p-3">
        <div className="flex-shrink-0 mt-0.5">
          {styles.icon}
        </div>
        <div className="ml-2 flex-1 min-w-0">
          <div className="flex items-center space-x-1 mb-1">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              Live Network
            </span>
            {personal && (
              <span className="text-xs font-bold text-emerald-400">
                • YOURS
              </span>
            )}
            <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse"></div>
          </div>
          <p className="text-sm text-text-primary leading-tight">
            {message}
          </p>
          {isClickable && (
            <div className="text-xs text-blue-400 mt-1 opacity-80">
              Click to view details →
            </div>
          )}
        </div>
        <div className="ml-2 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-text-secondary hover:text-text-primary transition-colors duration-200 opacity-60 hover:opacity-100"
          >
            <XMarkIcon className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-bg-secondary/50 rounded-b-lg overflow-hidden">
        <div
          className={`h-full ${styles.progress} relative`}
          style={{
            width: `${progress}%`,
            transition: 'width 50ms linear'
          }}
        />
      </div>
    </div>
  );
};
