import React, { useState, useEffect } from 'react';
import { LiveActivityToast } from './LiveActivityToast';

export interface LiveActivityToastData {
  id: string;
  message: string;
  type: 'network' | 'marketplace' | 'mint' | 'transfer';
  duration?: number;
}

interface LiveActivityToastContainerProps {
  toasts: LiveActivityToastData[];
  onRemove: (id: string) => void;
}

export const LiveActivityToastContainer: React.FC<LiveActivityToastContainerProps> = ({
  toasts,
  onRemove
}) => {
  return (
    <div className="fixed bottom-4 left-4 z-[9999] max-w-md">
      {toasts.slice(0, 3).map((toast, index) => ( // Only show up to 3 at a time
        <div
          key={toast.id}
          className="animate-slide-up mb-2 isolate"
          style={{
            transform: `translateY(-${index * 8}px)`,
            zIndex: 9999 - index
          }}
        >
          <LiveActivityToast
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => onRemove(toast.id)}
          />
        </div>
      ))}
    </div>
  );
};
