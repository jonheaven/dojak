import React, { useEffect, useState } from 'react';
import { useDogePFP } from '../hooks/useDogePFP';
import { useDoginals } from '../hooks/useDoginals';
import { useConnectedWalletAddress } from '../wallet/getConnectedWalletAddress';

/** Pointy-top hexagon — same geometry as `clip-path` (percent coords → SVG user space). */
const HEX_CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
const HEX_POLYGON_POINTS = '50,0 100,25 100,75 50,100 0,75 0,25';

function HexOutline({ className }: { className?: string }) {
  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full ${className ?? ''}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polygon
        points={HEX_POLYGON_POINTS}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

interface DogePFPAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  fallback?: React.ReactNode;
}

/** Outer box is square for layout only; clip + SVG stroke hide the square visually. */
const sizeClasses = {
  sm: 'h-16 w-16',
  md: 'h-20 w-20',
  lg: 'h-24 w-24',
  xl: 'h-32 w-32',
};

function HexFrame({
  sizeKey,
  className,
  children,
  outlineClassName,
}: {
  sizeKey: keyof typeof sizeClasses;
  className?: string;
  children: React.ReactNode;
  outlineClassName?: string;
}) {
  return (
    <div className={`relative shrink-0 ${sizeClasses[sizeKey]} ${className ?? ''}`}>
      <div className="absolute inset-0 overflow-hidden bg-transparent" style={{ clipPath: HEX_CLIP }}>
        {children}
      </div>
      {outlineClassName ? <HexOutline className={outlineClassName} /> : null}
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

  const pfpDoginal = pfpInscriptionId ? doginals.find((d) => d.inscriptionId === pfpInscriptionId) : undefined;
  const imgSrc =
    (pfpContentUrl && pfpContentUrl.length > 0 ? pfpContentUrl : null) ?? pfpDoginal?.previewUrl ?? null;

  useEffect(() => {
    setImgError(false);
  }, [pfpInscriptionId, imgSrc]);

  const hasDirectImage = Boolean(pfpContentUrl && pfpContentUrl.length > 0);
  const waitingOnDoginals = Boolean(pfpInscriptionId && !hasDirectImage && doginalsLoading);

  if (pfpLoading || waitingOnDoginals) {
    return (
      <HexFrame
        sizeKey={size}
        className={className}
        outlineClassName="text-amber-300/55 animate-pulse"
      >
        <div className="h-full w-full bg-transparent" />
      </HexFrame>
    );
  }

  const showPlaceholder = !pfpInscriptionId || !imgSrc || imgError;

  if (showPlaceholder) {
    if (fallback) {
      return <div className={className}>{fallback}</div>;
    }
    return (
      <HexFrame sizeKey={size} className={className} outlineClassName="text-amber-400/65">
        <div className="h-full w-full bg-transparent" aria-hidden />
      </HexFrame>
    );
  }

  return (
    <HexFrame sizeKey={size} className={className} outlineClassName="text-amber-400/35">
      <img
        src={imgSrc}
        alt="ÐPFP"
        className="h-full w-full object-cover"
        onError={() => setImgError(true)}
      />
    </HexFrame>
  );
};
