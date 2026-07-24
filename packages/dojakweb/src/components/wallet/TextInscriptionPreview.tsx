'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CodeBracketIcon, DocumentTextIcon, XMarkIcon } from '@heroicons/react/24/outline';
import {
  isJsonInscription,
  isTextishInscription,
  loadInscriptionTextBody,
  parseInscriptionText,
  type ParsedInscriptionText,
} from '../../utils/inscription-text';

type InscriptionLike = {
  inscriptionId: string;
  inscriptionNumber?: number;
  contentType?: string;
  content?: string;
  contentBody?: string;
  preview?: string;
};

type CardProps = {
  item: InscriptionLike;
  onInspect?: () => void;
  className?: string;
};

/** Compact media tile for text/JSON Doginals in the wallet NFT grid. */
export function TextInscriptionCardMedia({ item, onInspect, className = '' }: CardProps) {
  const [parsed, setParsed] = useState<ParsedInscriptionText | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setParsed(null);
    void (async () => {
      const body = await loadInscriptionTextBody({
        contentBody: item.contentBody,
        contentUrl: item.content || item.preview,
        inscriptionId: item.inscriptionId,
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;
      if (body) setParsed(parseInscriptionText(body));
      setLoading(false);
    })();
    return () => ac.abort();
  }, [item.contentBody, item.content, item.preview, item.inscriptionId]);

  const isJson = isJsonInscription(item.contentType, parsed?.raw);
  const lotto = Boolean(parsed?.protocol && /lotto/i.test(parsed.protocol));

  return (
    <button
      type="button"
      onClick={onInspect}
      className={`relative flex aspect-square w-full flex-col overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-3 text-left transition hover:brightness-110 ${className}`}
      title="Inspect text / JSON"
    >
      <div
        className={`mb-2 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
          lotto
            ? 'bg-amber-500/20 text-amber-200'
            : isJson
              ? 'bg-violet-500/20 text-violet-200'
              : 'bg-sky-500/15 text-sky-200'
        }`}
      >
        {isJson ? (
          <CodeBracketIcon className="h-3 w-3" aria-hidden />
        ) : (
          <DocumentTextIcon className="h-3 w-3" aria-hidden />
        )}
        {lotto ? 'ÐLotto' : isJson ? 'JSON' : 'Text'}
      </div>

      {loading ? (
        <div className="flex flex-1 items-center text-[11px] text-white/40">Loading…</div>
      ) : parsed ? (
        <>
          <div className="line-clamp-2 text-xs font-semibold leading-snug text-white/95">
            {parsed.title}
          </div>
          {parsed.subtitle ? (
            <div className="mt-1 line-clamp-2 text-[10px] leading-snug text-white/50">
              {parsed.subtitle}
            </div>
          ) : null}
          {parsed.chips?.length ? (
            <div className="mt-auto flex flex-wrap gap-1 pt-2">
              {parsed.chips.slice(0, 8).map((c) => (
                <span
                  key={c}
                  className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-amber-100/90"
                >
                  {c}
                </span>
              ))}
              {parsed.chips.length > 8 ? (
                <span className="text-[10px] text-white/40">+{parsed.chips.length - 8}</span>
              ) : null}
            </div>
          ) : (
            <pre className="mt-auto max-h-[42%] overflow-hidden whitespace-pre-wrap break-all font-mono text-[9px] leading-relaxed text-white/45">
              {(parsed.raw || '').slice(0, 180)}
              {(parsed.raw || '').length > 180 ? '…' : ''}
            </pre>
          )}
        </>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-1">
          <DocumentTextIcon className="h-8 w-8 text-white/25" aria-hidden />
          <span className="text-[10px] text-white/40">{item.contentType || 'text'}</span>
        </div>
      )}
    </button>
  );
}

type InspectProps = {
  item: InscriptionLike | null;
  open: boolean;
  onClose: () => void;
};

/** Full inspect sheet for text/JSON inscription bodies. */
export function InscriptionTextInspectModal({ item, open, onClose }: InspectProps) {
  const [raw, setRaw] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open || !item) {
      setRaw(null);
      setError(false);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    setError(false);
    void (async () => {
      const body = await loadInscriptionTextBody({
        contentBody: item.contentBody,
        contentUrl: item.content || item.preview,
        inscriptionId: item.inscriptionId,
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;
      if (body) setRaw(body);
      else setError(true);
      setLoading(false);
    })();
    return () => ac.abort();
  }, [open, item]);

  const parsed = useMemo(() => (raw ? parseInscriptionText(raw) : null), [raw]);
  const pretty = useMemo(() => {
    if (!parsed?.json) return raw;
    try {
      return JSON.stringify(parsed.json, null, 2);
    } catch {
      return raw;
    }
  }, [parsed, raw]);

  if (!open || !item) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Inspect inscription"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">
              {parsed?.title || 'Inscription'}
              {item.inscriptionNumber != null ? (
                <span className="ml-2 font-mono text-xs text-white/45">#{item.inscriptionNumber}</span>
              ) : null}
            </div>
            {parsed?.subtitle ? (
              <div className="mt-0.5 text-xs text-white/50">{parsed.subtitle}</div>
            ) : null}
            <div className="mt-1 truncate font-mono text-[10px] text-white/35">{item.inscriptionId}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {parsed?.chips?.length ? (
          <div className="flex flex-wrap gap-1.5 border-b border-white/10 px-4 py-3">
            {parsed.chips.map((c) => (
              <span
                key={c}
                className="rounded-lg bg-amber-500/15 px-2.5 py-1 font-mono text-sm tabular-nums text-amber-100"
              >
                {c}
              </span>
            ))}
          </div>
        ) : null}

        <div className="max-h-[55vh] overflow-auto px-4 py-3">
          {loading ? (
            <div className="py-8 text-center text-sm text-white/45">Loading content…</div>
          ) : error || !pretty ? (
            <div className="space-y-2 py-6 text-center text-sm text-white/55">
              <p>Could not load inscription body (CORS or empty).</p>
              {item.content ? (
                <a
                  href={item.content}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#FCD34D] underline"
                >
                  Open content URL
                </a>
              ) : null}
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-emerald-100/90">
              {pretty}
            </pre>
          )}
        </div>

        <div className="border-t border-white/10 px-4 py-2 text-[10px] text-white/35">
          {item.contentType || 'text'} · tap outside to close
        </div>
      </div>
    </div>
  );
}

export { isTextishInscription };
