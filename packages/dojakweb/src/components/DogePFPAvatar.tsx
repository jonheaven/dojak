import React, { useEffect, useMemo, useState } from 'react';
import { useDogePFP } from '../hooks/useDogePFP';
import { useDoginals } from '../hooks/useDoginals';
import { useConnectedWalletAddress } from '../wallet/getConnectedWalletAddress';
import dogeNobgSrc from '../assets/doge-nobg.svg';

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
  /**
   * Optional override when no ÐPFP is set. When omitted, shows the bundled
   * doge mark on a wallet-hashed gradient (default avatar).
   */
  fallback?: React.ReactNode;
  /** Seed for the default gradient (falls back to connected address). */
  address?: string | null;
}

/** Outer box is square for layout only; clip + SVG stroke hide the square visually. */
const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
};

function hashHue(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic gradient from a Dogecoin address (stable per wallet). */
export function walletAvatarGradient(address: string | null | undefined): string {
  const seed = (address?.trim() || 'dojak').toLowerCase();
  const n = hashHue(seed);
  const h1 = n % 360;
  const h2 = (h1 + 48 + (n % 72)) % 360;
  const s1 = 52 + (n % 28);
  const s2 = 44 + ((n >>> 8) % 32);
  const l1 = 36 + ((n >>> 4) % 16);
  const l2 = 26 + ((n >>> 12) % 14);
  return `linear-gradient(145deg, hsl(${h1} ${s1}% ${l1}%) 0%, hsl(${h2} ${s2}% ${l2}%) 100%)`;
}

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

function DefaultDogeAvatar({
  sizeKey,
  className,
  address,
}: {
  sizeKey: keyof typeof sizeClasses;
  className?: string;
  address: string | null | undefined;
}) {
  const gradient = useMemo(() => walletAvatarGradient(address), [address]);
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] ${sizeClasses[sizeKey]} ${className ?? ''}`}
      style={{ background: gradient }}
      aria-hidden
    >
      <img
        src={dogeNobgSrc}
        alt=""
        draggable={false}
        className="absolute inset-0 m-auto h-[72%] w-[72%] object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
      />
    </div>
  );
}

export const DogePFPAvatar: React.FC<DogePFPAvatarProps> = ({
  size = 'md',
  className = '',
  fallback,
  address: addressProp,
}) => {
  const { pfpInscriptionId, pfpContentUrl, loading: pfpLoading } = useDogePFP();
  const connectedAddress = useConnectedWalletAddress();
  const address = addressProp ?? connectedAddress;
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
      <div
        className={`relative shrink-0 overflow-hidden rounded-full border border-amber-300/30 ${sizeClasses[size]} ${className}`}
        style={{ background: walletAvatarGradient(address) }}
        aria-hidden
      >
        <div className="absolute inset-0 animate-pulse bg-white/10" />
      </div>
    );
  }

  const showPlaceholder = !pfpInscriptionId || !imgSrc || imgError;

  if (showPlaceholder) {
    if (fallback) {
      return <div className={className}>{fallback}</div>;
    }
    return <DefaultDogeAvatar sizeKey={size} className={className} address={address} />;
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
