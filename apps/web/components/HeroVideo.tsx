'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  /** Prefer smoke loop for atmosphere; wallet mp4 for product demo. */
  src?: string;
  poster?: string;
  className?: string;
};

/**
 * Muted autoplay hero loop. Respects reduced-motion; lazy-loads when near viewport.
 */
export function HeroVideo({
  src = '/brand/dojaksmoke.mp4',
  poster = '/brand/dojak.png',
  className = ''
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      el.removeAttribute('autoplay');
      el.pause();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void el.play().catch(() => {});
            setReady(true);
          } else {
            el.pause();
          }
        }
      },
      { rootMargin: '120px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className={`relative overflow-hidden bg-zinc-950 ${className}`}>
      <video
        ref={ref}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
          ready ? 'opacity-100' : 'opacity-70'
        }`}
        src={src}
        poster={poster}
        muted
        playsInline
        loop
        preload="metadata"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/25" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
    </div>
  );
}
