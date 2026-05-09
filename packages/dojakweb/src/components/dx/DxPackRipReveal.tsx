'use client';

import { AnimatePresence, motion } from 'framer-motion';
import React, { useState } from 'react';

export type DxPackRipRevealProps = {
  xHandle: string;
  dogeAddress: string;
  badgeImageUrl: string | null;
  /** Shown when art failed or API key missing (from `visual_data`). */
  statusHint?: string | null;
  ripCta: string;
  packTitle: string;
  cardSubtitle: string;
  verifiedBanner: string;
};

/**
 * Booster-pack style reveal for Ðoge𝕏ID + Grok Imagine trading-card art.
 */
export function DxPackRipReveal({
  xHandle,
  dogeAddress,
  badgeImageUrl,
  statusHint,
  ripCta,
  packTitle,
  cardSubtitle,
  verifiedBanner,
}: DxPackRipRevealProps) {
  const [ripped, setRipped] = useState(false);
  const shortAddr =
    dogeAddress.length > 12
      ? `${dogeAddress.slice(0, 6)}…${dogeAddress.slice(-4)}`
      : dogeAddress;

  return (
    <div className="space-y-3">
      <p className="text-center text-sm font-semibold text-amber-100/90">{packTitle}</p>
      <div className="relative mx-auto max-w-sm">
        <AnimatePresence mode="wait">
          {!ripped ? (
            <motion.button
              key="pack"
              type="button"
              onClick={() => setRipped(true)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative w-full overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-br from-zinc-900 via-amber-950/80 to-zinc-950 p-6 text-left shadow-[0_0_40px_rgba(251,191,36,0.12)]"
            >
              <div
                className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-amber-400/10 blur-2xl"
                aria-hidden
              />
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300/90">Ð𝕏</p>
              <p className="mt-2 text-lg font-black text-white">{verifiedBanner}</p>
              <p className="mt-1 text-xs text-white/55">{xHandle}</p>
              <p className="mt-6 text-center text-sm font-semibold text-amber-200">{ripCta}</p>
              <p className="mt-2 text-center text-[11px] text-white/45">{cardSubtitle}</p>
            </motion.button>
          ) : (
            <motion.div
              key="card"
              initial={{ rotateY: 88, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              style={{ perspective: 1200 }}
              className="w-full"
            >
              <div className="relative overflow-hidden rounded-2xl border-2 border-amber-300/50 bg-gradient-to-b from-zinc-900 to-black shadow-[0_0_48px_rgba(251,191,36,0.18)]">
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.14] mix-blend-screen"
                  style={{
                    background:
                      'linear-gradient(125deg, transparent 40%, rgba(255,255,255,0.9) 48%, transparent 56%)',
                  }}
                  aria-hidden
                />
                <div className="border-b border-amber-400/25 bg-gradient-to-r from-amber-600/25 via-amber-400/10 to-amber-600/25 px-3 py-2 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-200/95">
                    {verifiedBanner}
                  </span>
                </div>
                <div className="aspect-square w-full bg-zinc-950/90">
                  {badgeImageUrl ? (
                    <img
                      src={badgeImageUrl}
                      alt={`Ðoge𝕏ID trading card for ${xHandle}`}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                      <p className="text-xs text-white/55">
                        {statusHint ?? 'Grok trading-card art will appear here when the API key is configured server-side.'}
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-1 border-t border-amber-500/20 bg-black/60 px-3 py-3">
                  <p className="text-center font-mono text-sm font-bold text-white">{xHandle}</p>
                  <p className="text-center font-mono text-[10px] text-white/45">{shortAddr}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
