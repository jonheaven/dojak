import React, { useEffect, useMemo, useState } from 'react';
import { useDogePFP } from '../hooks/useDogePFP';
import { useChainProfile } from '../hooks/useChainProfile';
import { useDoginals } from '../hooks/useDoginals';
import { useConnectedWalletAddress } from '../wallet/getConnectedWalletAddress';
import { getCommandDogApiBaseUrl } from '../utils/api';
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
  /** Seed for the default gradient + chain profile lookup (falls back to connected address). */
  address?: string | null;
  /**
   * Ð𝕏 handle. When there is no ÐPFP, show the cached X photo from command.dog
   * (`GET /v1/dx/avatar/:handle`). Not chain identity — display fallback only.
   */
  xHandle?: string | null;
  /** Show a soft ring when dogex flags bind author no longer holds the media. */
  showNotHoldingHint?: boolean;
}

/** Outer box is square for layout only; clip + SVG stroke hide the square visually. */
const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
};

export function dxAvatarUrl(handle: string): string {
  const inner = handle.trim().replace(/^@+/, '');
  const base = getCommandDogApiBaseUrl().replace(/\/+$/, '');
  return `${base}/v1/dx/avatar/${encodeURIComponent(inner)}`;
}

export function dxAvatarByAddressUrl(address: string): string {
  const base = getCommandDogApiBaseUrl().replace(/\/+$/, '');
  return `${base}/v1/dx/avatar/address/${encodeURIComponent(address.trim())}`;
}

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
  title,
}: {
  sizeKey: keyof typeof sizeClasses;
  className?: string;
  children: React.ReactNode;
  outlineClassName?: string;
  title?: string;
}) {
  return (
    <div
      className={`relative shrink-0 ${sizeClasses[sizeKey]} ${className ?? ''}`}
      title={title}
    >
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

/**
 * Hex ÐPFP avatar.
 *
 * Resolution order:
 * 1. Connected self + local device pref (`useDogePFP`) — instant after "Set as ÐPFP"
 * 2. dogex chain profile for `address` (`useChainProfile`) — eco-wide identity
 * 3. Ð𝕏 handle → command.dog cached X photo (display only)
 * 4. Wallet-hashed default doge mark
 */
export const DogePFPAvatar: React.FC<DogePFPAvatarProps> = ({
  size = 'md',
  className = '',
  fallback,
  address: addressProp,
  xHandle,
  showNotHoldingHint = true,
}) => {
  const {
    pfpInscriptionId: localId,
    pfpContentUrl: localUrl,
    loading: localLoading,
  } = useDogePFP();
  const connectedAddress = useConnectedWalletAddress();
  const address = addressProp ?? connectedAddress;
  const isSelf = Boolean(
    address &&
      connectedAddress &&
      address.trim().toLowerCase() === connectedAddress.trim().toLowerCase(),
  );

  const {
    pfpInscriptionId: chainId,
    pfpContentUrl: chainUrl,
    loading: chainLoading,
    pfpNotHolding,
  } = useChainProfile(address);

  // Self: local first (optimistic). Others: chain only.
  const pfpInscriptionId = isSelf ? localId ?? chainId : chainId;
  const prefersLocal = Boolean(isSelf && localId);
  const pfpContentUrl = prefersLocal
    ? localUrl || (localId && localId === chainId ? chainUrl : null) || null
    : chainUrl;

  // Inventory lookup only when we have an id without a content URL (local self path).
  const needDoginals = Boolean(pfpInscriptionId && !pfpContentUrl && isSelf && connectedAddress);
  const { doginals, loading: doginalsLoading } = useDoginals(
    needDoginals ? connectedAddress || '' : '',
  );
  const [imgError, setImgError] = useState(false);
  const [dxError, setDxError] = useState(false);

  const pfpDoginal = pfpInscriptionId
    ? doginals.find((d) => d.inscriptionId === pfpInscriptionId)
    : undefined;
  const imgSrc =
    (pfpContentUrl && pfpContentUrl.length > 0 ? pfpContentUrl : null) ??
    pfpDoginal?.previewUrl ??
    null;
  const dxSrc = xHandle?.trim() ? dxAvatarUrl(xHandle) : null;

  useEffect(() => {
    setImgError(false);
  }, [pfpInscriptionId, imgSrc]);

  useEffect(() => {
    setDxError(false);
  }, [dxSrc]);

  const hasDirectImage = Boolean(pfpContentUrl && pfpContentUrl.length > 0);
  const waitingOnDoginals = Boolean(needDoginals && pfpInscriptionId && !hasDirectImage && doginalsLoading);
  const loading =
    (isSelf ? localLoading || (!localId && chainLoading) : chainLoading) || waitingOnDoginals;

  if (loading) {
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
    if (dxSrc && !dxError) {
      return (
        <div
          className={`relative shrink-0 overflow-hidden rounded-full border border-white/15 ${sizeClasses[size]} ${className}`}
          title={xHandle ? `X photo for ${xHandle} (not ÐPFP)` : undefined}
        >
          <img
            src={dxSrc}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setDxError(true)}
          />
        </div>
      );
    }
    if (fallback) {
      return <div className={className}>{fallback}</div>;
    }
    return <DefaultDogeAvatar sizeKey={size} className={className} address={address} />;
  }

  const notHolding = showNotHoldingHint && pfpNotHolding === true && !prefersLocal;
  const outline = notHolding ? 'text-rose-400/55' : 'text-amber-400/35';
  const title = notHolding
    ? 'ÐPFP bind recorded, but author may not hold this media (soft flag)'
    : undefined;

  return (
    <HexFrame
      sizeKey={size}
      className={`${className}${notHolding ? ' opacity-90' : ''}`}
      outlineClassName={outline}
      title={title}
    >
      <img
        src={imgSrc}
        alt="ÐPFP"
        className="h-full w-full object-cover"
        onError={() => setImgError(true)}
      />
    </HexFrame>
  );
};
