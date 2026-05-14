import React, { useEffect, useMemo, useState } from 'react';
import { useDogePFP } from '../hooks/useDogePFP';
import { useDoginals } from '../hooks/useDoginals';
import { useConnectedWalletAddress } from '../wallet/getConnectedWalletAddress';

/** Pointy-top hexagon, square box — works with `object-cover` for images. */
const HEX_CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';

const DOGE_GRADIENT_SWATCHES = [
  '#facc15',
  '#eab308',
  '#fde047',
  '#fdba74',
  '#fbbf24',
  '#f59e0b',
  '#fef3c7',
  '#fcd34d',
  '#ca8a04',
  '#fb923c',
  '#fed7aa',
] as const;

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function dogeGradientStyle(seed: string): React.CSSProperties {
  const h = hashString(seed || 'doge');
  const pick = (shift: number) => DOGE_GRADIENT_SWATCHES[(h >> shift) % DOGE_GRADIENT_SWATCHES.length];
  const a = pick(0);
  const b = pick(4);
  const c = pick(8);
  const angle = h % 360;
  return {
    background: `linear-gradient(${angle}deg, ${a} 0%, ${b} 48%, ${c} 100%)`,
  };
}

interface DogePFPAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  fallback?: React.ReactNode;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
};

function HexFrame({
  sizeKey,
  className,
  children,
  borderClass,
}: {
  sizeKey: keyof typeof sizeClasses;
  className?: string;
  children: React.ReactNode;
  borderClass?: string;
}) {
  return (
    <div
      className={`relative shrink-0 ${sizeClasses[sizeKey]} ${borderClass ?? ''} ${className ?? ''}`}
      style={{ clipPath: HEX_CLIP }}
    >
      {children}
    </div>
  );
}

export const DogePFPAvatar: React.FC<DogePFPAvatarProps> = ({
  size = 'md',
  className = '',
  fallback,
}) => {
  const { pfpInscriptionId, pfpContentUrl, loading: pfpLoading } = useDogePFP();
  const connectedAddress = useConnectedWalletAddress();
  const { doginals, loading: doginalsLoading } = useDoginals(connectedAddress || '');
  const [imgError, setImgError] = useState(false);

  const gradientSeed = connectedAddress || 'doge-wallet';

  const pfpDoginal = pfpInscriptionId ? doginals.find((d) => d.inscriptionId === pfpInscriptionId) : undefined;
  const imgSrc =
    (pfpContentUrl && pfpContentUrl.length > 0 ? pfpContentUrl : null) ?? pfpDoginal?.previewUrl ?? null;

  useEffect(() => {
    setImgError(false);
  }, [pfpInscriptionId, imgSrc]);

  const gradientStyle = useMemo(() => dogeGradientStyle(gradientSeed), [gradientSeed]);

  const hasDirectImage = Boolean(pfpContentUrl && pfpContentUrl.length > 0);
  const waitingOnDoginals = Boolean(pfpInscriptionId && !hasDirectImage && doginalsLoading);

  if (pfpLoading || waitingOnDoginals) {
    return (
      <HexFrame sizeKey={size} className={className} borderClass="animate-pulse ring-1 ring-yellow-400/25">
        <div className="h-full w-full" style={gradientStyle} />
      </HexFrame>
    );
  }

  const showPlaceholderGradient =
    !pfpInscriptionId || !imgSrc || imgError;

  if (showPlaceholderGradient) {
    if (fallback) {
      return <div className={className}>{fallback}</div>;
    }
    return (
      <HexFrame sizeKey={size} className={className} borderClass="ring-1 ring-yellow-400/30">
        <div className="h-full w-full opacity-95" style={gradientStyle} aria-hidden />
      </HexFrame>
    );
  }

  return (
    <HexFrame sizeKey={size} className={className} borderClass="ring-1 ring-yellow-400/45">
      <img
        src={imgSrc}
        alt="ÐPFP"
        className="h-full w-full object-cover"
        onError={() => setImgError(true)}
      />
    </HexFrame>
  );
};
