'use client';

import React, { useEffect, useState } from 'react';
import { ArrowTopRightOnSquareIcon, CubeIcon, PhotoIcon } from '@heroicons/react/24/outline';
import {
  doggyMarketInscriptionCdnContentUrl,
  doggyMarketInscriptionPageUrl,
  doggyOutputMatchesListingUtxo,
  fetchDoggyMarketInscription,
  type DoggyMarketInscriptionMeta,
} from '../../lib/doggy-market-inscription';

type Props = {
  /** Normalized or raw doginal id; null hides the card */
  inscriptionId: string | null;
  /** Listing UTXO from PSBT validation — compared to Doggy `output` when both exist */
  listingUtxo?: string | null;
  /** When Doggy JSON fails but MyDoge gave an image URL during validation */
  fallbackImageUrl?: string | null;
  className?: string;
};

export function DoggyMarketInscriptionPreview({
  inscriptionId,
  listingUtxo,
  fallbackImageUrl,
  className = '',
}: Props) {
  const [meta, setMeta] = useState<DoggyMarketInscriptionMeta | null>(null);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [usedFallbackImage, setUsedFallbackImage] = useState(false);
  const [cdnImageBroken, setCdnImageBroken] = useState(false);

  useEffect(() => {
    if (!inscriptionId?.trim()) {
      setMeta(null);
      setPhase('idle');
      setUsedFallbackImage(false);
      return;
    }

    const ac = new AbortController();
    setPhase('loading');
    setMeta(null);
    setUsedFallbackImage(false);
    setCdnImageBroken(false);

    void (async () => {
      const m = await fetchDoggyMarketInscription(inscriptionId, ac.signal);
      if (ac.signal.aborted) return;
      if (m) {
        setMeta(m);
        setPhase('ok');
      } else if (fallbackImageUrl) {
        setUsedFallbackImage(true);
        setPhase('ok');
      } else {
        setPhase('error');
      }
    })();

    return () => ac.abort();
  }, [inscriptionId, fallbackImageUrl]);

  if (!inscriptionId?.trim()) {
    if (fallbackImageUrl) {
      return (
        <div className={`space-y-2 ${className}`}>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary dark:text-white/45">Inscription preview</div>
          <img
            src={fallbackImageUrl}
            alt=""
            className="max-h-56 max-w-full rounded-lg border border-white/10 object-contain"
          />
        </div>
      );
    }
    return (
      <div
        className={`rounded-xl border border-border-primary bg-bg-secondary dark:border-white/10 dark:bg-black/30 p-3 text-[11px] leading-relaxed text-text-secondary dark:text-white/55 ${className}`}
      >
        <PhotoIcon className="mb-1 inline h-4 w-4 text-text-tertiary dark:text-white/35" aria-hidden />
        <span className="font-semibold text-text-secondary dark:text-white/70"> No inscription id yet. </span>
        Use a share link with <code className="text-[#FCD34D]">?inscription=…</code> so Doggy Market can load metadata and
        CDN content, or parse the listing so we can try the PSBT input as a best-guess id.
      </div>
    );
  }

  const utxoCheck = meta ? doggyOutputMatchesListingUtxo(meta.output, listingUtxo) : null;
  const contentType = (meta?.contentType ?? '').toLowerCase();
  const pageUrl = doggyMarketInscriptionPageUrl(inscriptionId);
  const cdnContentUrl = doggyMarketInscriptionCdnContentUrl(inscriptionId);
  /** CDN artwork while metadata loads, or when JSON fails (unless we already show the rich meta or MyDoge image). */
  const showDoggyCdnImage =
    Boolean(inscriptionId?.trim()) &&
    !(phase === 'ok' && meta && !usedFallbackImage) &&
    !(phase === 'ok' && usedFallbackImage);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary dark:text-white/45">Inscription (Doggy Market)</div>

      {showDoggyCdnImage && !cdnImageBroken ? (
        <div className="relative overflow-hidden rounded-xl border border-border-primary bg-bg-tertiary dark:border-white/10 dark:bg-black/40">
          <img
            src={cdnContentUrl}
            alt=""
            className="max-h-64 w-full object-contain"
            onError={() => setCdnImageBroken(true)}
          />
          {phase === 'loading' ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 px-3 text-center text-xs font-medium text-white/95 backdrop-blur-[1px]">
              Loading inscription metadata from api.doggy.market…
            </div>
          ) : null}
        </div>
      ) : null}

      {phase === 'loading' && cdnImageBroken ? (
        <div className="flex min-h-[140px] items-center justify-center rounded-xl border border-border-primary bg-bg-secondary dark:border-white/10 dark:bg-black/35 p-4 text-xs text-text-secondary dark:text-white/55">
          Loading from api.doggy.market…
        </div>
      ) : null}

      {phase === 'error' ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100/95">
          {cdnImageBroken
            ? 'Could not load inscription metadata from Doggy Market and the CDN preview failed (network, wrong id, or non-image content).'
            : 'Metadata API unavailable — if the image above loaded, it is served from cdn.doggy.market (verify on Doggy Market before buying).'}{' '}
          <a
            href={pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-amber-50 underline"
          >
            Open on Doggy Market
            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      ) : null}

      {phase === 'ok' && usedFallbackImage && fallbackImageUrl ? (
        <div className="space-y-2 rounded-xl border border-border-primary bg-bg-secondary dark:border-white/10 dark:bg-black/35 p-3">
          <p className="text-[11px] text-text-secondary dark:text-white/55">
            Doggy Market API did not return JSON — showing MyDoge preview from validation instead.
          </p>
          <img
            src={fallbackImageUrl}
            alt=""
            className="max-h-56 max-w-full rounded-lg border border-white/10 object-contain"
          />
          <a
            href={pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#FCD34D] underline"
          >
            View on Doggy Market
            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      ) : null}

      {phase === 'ok' && meta && !usedFallbackImage ? (
        <div className="space-y-2 rounded-xl border border-violet-500/25 bg-violet-500/10 p-3">
          {utxoCheck === false ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-2 py-1.5 text-[11px] text-amber-100">
              Doggy indexer location does not match this listing&apos;s UTXO — the id may be wrong or the inscription
              moved. Confirm on Doggy Market before buying.
            </div>
          ) : null}

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-secondary dark:text-white/65">
            {meta.inscriptionNumber != null ? <span>#{meta.inscriptionNumber}</span> : null}
            <span className="break-all font-mono text-text-secondary dark:text-white/80">{meta.inscriptionId}</span>
            {contentType ? <span className="text-text-tertiary dark:text-white/50">{contentType}</span> : null}
          </div>

          <div className="relative overflow-hidden rounded-lg border border-border-primary bg-bg-tertiary dark:border-white/10 dark:bg-black/40">
            {contentType.startsWith('image/') || contentType === 'image/svg+xml' ? (
              <img
                src={meta.content}
                alt=""
                className="max-h-64 w-full object-contain"
                onError={(e) => {
                  if (meta.preview) e.currentTarget.src = meta.preview;
                }}
              />
            ) : contentType.startsWith('audio/') ? (
              <div className="p-4">
                <audio controls className="w-full" src={meta.content} />
              </div>
            ) : contentType.startsWith('video/') ? (
              <div className="p-2">
                <video controls className="max-h-64 w-full rounded-md" src={meta.content} />
              </div>
            ) : contentType.startsWith('text/html') ? (
              <div className="flex min-h-[100px] flex-col items-center justify-center gap-2 p-4 text-center text-xs text-text-secondary dark:text-white/55">
                HTML inscription — open the content URL or Doggy Market to view safely in your browser.
              </div>
            ) : contentType.startsWith('text/') ? (
              <TextSnippetFromUrl url={meta.content} />
            ) : (
              <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 p-4 text-center text-text-secondary dark:text-white/55">
                <CubeIcon className="h-10 w-10 text-text-tertiary dark:text-white/30" aria-hidden />
                <p className="text-xs">Preview not embedded for this type.</p>
                <p className="font-mono text-[10px] text-text-tertiary dark:text-white/40">{contentType || 'unknown type'}</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={meta.content}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-border-primary bg-bg-tertiary px-3 py-1 text-[11px] font-semibold text-text-primary transition hover:bg-bg-secondary dark:border-white/20 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10"
            >
              Open content URL
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden />
            </a>
            <a
              href={pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-[#FCD34D]/35 bg-[#FCD34D]/10 px-3 py-1 text-[11px] font-semibold text-[#FCD34D] hover:bg-[#FCD34D]/20"
            >
              Doggy Market
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TextSnippetFromUrl({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    setText(null);
    setErr(false);
    void (async () => {
      try {
        const r = await fetch(url, { signal: ac.signal, mode: 'cors' });
        if (!r.ok) throw new Error('bad status');
        const t = await r.text();
        if (!ac.signal.aborted) setText(t.slice(0, 8000));
      } catch {
        if (!ac.signal.aborted) setErr(true);
      }
    })();
    return () => ac.abort();
  }, [url]);

  if (err) {
    return (
      <div className="p-4 text-center text-xs text-text-secondary dark:text-white/55">
        Could not load text (CORS).{' '}
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#FCD34D] underline">
          Open content
        </a>
      </div>
    );
  }
  if (text === null) {
    return <div className="p-4 text-center text-xs text-text-tertiary dark:text-white/45">Loading text…</div>;
  }
  return (
    <pre className="max-h-64 overflow-auto p-3 text-left font-mono text-[11px] leading-relaxed text-text-primary dark:text-white/85">
      {text}
      {text.length >= 8000 ? '\n…' : ''}
    </pre>
  );
}
