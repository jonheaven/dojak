import React, { useCallback, useState } from 'react';

const SIZE_PX: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export type DogeCurrencyIconSize = keyof typeof SIZE_PX;

export interface DogeCurrencyIconProps {
  size?: DogeCurrencyIconSize;
  className?: string;
}

/**
 * Dogecoin unit mark for UI amounts: `public/doge.svg`, with **Ð** if the image fails to load.
 */
export function DogeCurrencyIcon({ size = 'sm', className = '' }: DogeCurrencyIconProps) {
  const [failed, setFailed] = useState(false);
  const onError = useCallback(() => setFailed(true), []);

  if (failed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center self-center text-[0.95em] font-bold leading-none ${className}`}
        title="Ð"
        aria-label="Ð"
      >
        Ð
      </span>
    );
  }

  return (
    <img
      src="/doge.svg"
      alt=""
      role="img"
      aria-hidden
      className={`inline-block shrink-0 object-contain align-[-0.15em] ${SIZE_PX[size]} ${className}`}
      onError={onError}
    />
  );
}
