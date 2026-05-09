import React from 'react';
import { useDogePFP } from '../hooks/useDogePFP';
import { useDoginals } from '../hooks/useDoginals';
import { useConnectedWalletAddress } from '../wallet/getConnectedWalletAddress';

interface DogePFPAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  fallback?: React.ReactNode;
}

export const DogePFPAvatar: React.FC<DogePFPAvatarProps> = ({
  size = 'md',
  className = '',
  fallback
}) => {
  const { pfpInscriptionId, loading: pfpLoading } = useDogePFP();
  const connectedAddress = useConnectedWalletAddress();
  const { doginals, loading: doginalsLoading } = useDoginals(connectedAddress || '');

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  if (pfpLoading || doginalsLoading) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-bg-secondary animate-pulse ${className}`}>
        <div className="w-full h-full rounded-full bg-yellow-400/20 flex items-center justify-center">
          <span className="text-xs">🐕</span>
        </div>
      </div>
    );
  }

  if (!pfpInscriptionId) {
    return fallback ? (
      <div className={className}>{fallback}</div>
    ) : (
      <div className={`${sizeClasses[size]} rounded-full bg-bg-secondary border border-border-primary flex items-center justify-center ${className}`}>
        <span className="text-sm">🐕</span>
      </div>
    );
  }

  const pfpDoginal = doginals.find(d => d.inscriptionId === pfpInscriptionId);

  if (!pfpDoginal || !pfpDoginal.previewUrl) {
    return fallback ? (
      <div className={className}>{fallback}</div>
    ) : (
      <div className={`${sizeClasses[size]} rounded-full bg-bg-secondary border border-border-primary flex items-center justify-center ${className}`}>
        <span className="text-sm">🖼️</span>
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full overflow-hidden border-2 border-yellow-400/50 ${className}`}>
      <img
        src={pfpDoginal.previewUrl}
        alt="DogePFP"
        className="w-full h-full object-cover"
        onError={(e) => {
          // Fallback if image fails to load
          const target = e.target as HTMLElement;
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML = '<span class="text-sm">🖼️</span>';
            parent.className = `${sizeClasses[size]} rounded-full bg-bg-secondary border border-border-primary flex items-center justify-center ${className}`;
          }
        }}
      />
    </div>
  );
};