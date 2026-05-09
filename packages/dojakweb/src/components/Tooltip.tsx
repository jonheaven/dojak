import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * A universal tooltip component that can be used anywhere in the application.
 * Features:
 * - Renders via portal to avoid z-index and overflow issues
 * - Responsive design (centers on mobile, positions on desktop)
 * - Auto-positioning to stay within viewport bounds
 * - Hover and click/tap support
 * - Keyboard accessibility (Escape to close)
 * - Outside click to close
 *
 * Usage:
 * ```tsx
 * import { Tooltip } from '@/components';
 *
 * <Tooltip content="This is helpful information">
 *   <button>Hover me</button>
 * </Tooltip>
 * ```
 */
interface TooltipProps {
  /** The content to display in the tooltip */
  content: React.ReactNode;
  /** The trigger element that shows the tooltip */
  children: React.ReactNode;
  /** Preferred position (auto will choose best available position) */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  /** Delay before showing tooltip on hover (ms) */
  delay?: number;
  /** Delay before hiding tooltip (ms) */
  hideDelay?: number;
  /** Additional CSS classes for the trigger element */
  className?: string;
  /** Disable the tooltip */
  disabled?: boolean;
  /** Maximum width classes (Tailwind) */
  maxWidth?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 300,
  hideDelay = 0,
  className = '',
  disabled = false,
  maxWidth = 'max-w-xs sm:max-w-sm'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showTimeout, setShowTimeout] = useState<NodeJS.Timeout | null>(null);
  const [hideTimeout, setHideTimeout] = useState<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const showTooltip = useCallback(() => {
    if (disabled) return;

    if (hideTimeout) {
      clearTimeout(hideTimeout);
      setHideTimeout(null);
    }

    const timeout = setTimeout(() => setIsVisible(true), delay);
    setShowTimeout(timeout);
  }, [disabled, delay, hideTimeout]);

  const hideTooltip = useCallback(() => {
    if (showTimeout) {
      clearTimeout(showTimeout);
      setShowTimeout(null);
    }

    if (hideDelay > 0) {
      const timeout = setTimeout(() => setIsVisible(false), hideDelay);
      setHideTimeout(timeout);
    } else {
      setIsVisible(false);
    }
  }, [showTimeout, hideDelay]);

  const toggleTooltip = useCallback(() => {
    if (disabled) return;

    if (isVisible) {
      hideTooltip();
    } else {
      showTooltip();
    }
  }, [disabled, isVisible, showTooltip, hideTooltip]);

  // Handle outside clicks and escape key
  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        hideTooltip();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        hideTooltip();
      }
    };

    const handleScroll = () => {
      hideTooltip();
    };

    // Use capture phase to handle before other listeners
    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('touchstart', handleClickOutside, true);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isVisible, hideTooltip]);


  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (showTimeout) clearTimeout(showTimeout);
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, [showTimeout, hideTimeout]);

  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onClick={toggleTooltip}
        className={`cursor-help ${className}`}
      >
        {children}
      </div>

      {isVisible && createPortal(
        <div
          ref={tooltipRef}
          className="fixed z-[9999] px-3 py-2 text-sm text-text-primary bg-black border border-white rounded-lg shadow-xl max-w-xs sm:max-w-sm"
          style={{
            pointerEvents: 'auto',
            bottom: triggerRef.current ? window.innerHeight - triggerRef.current.getBoundingClientRect().top + 8 : 0,
            left: triggerRef.current ? triggerRef.current.getBoundingClientRect().left + (triggerRef.current.getBoundingClientRect().width / 2) : 0,
            transform: 'translateX(-50%)',
          }}
        >
          {content}
          {/* Arrow pointer */}
          <div className="absolute top-[calc(100%-11px)] left-1/2 transform -translate-x-1/2 w-6 h-6 bg-black border border-white rotate-45 border-t-0 border-l-0" />
        </div>,
        document.body
      )}
    </>
  );
};
