'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CodeBracketIcon, DocumentTextIcon, XMarkIcon } from '@heroicons/react/24/outline';
import {
  isHtmlInscription,
  isJsonInscription,
  isTextishInscription,
  isWasmInscription,
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

type InspectProps = {
  item: InscriptionLike | null;
  open: boolean;
  onClose: () => void;
};

/** Rewrite inubits.com → same-origin `/__inubits` (CORS). */
function proxiedContentUrl(url?: string | null): string | undefined {
  const raw = (url || '').trim();
  if (!raw || typeof window === 'undefined') return raw || undefined;
  try {
    const u = new URL(raw, window.location.origin);
    if (u.hostname === 'inubits.com' || u.hostname.endsWith('.inubits.com')) {
      return `${window.location.origin}/__inubits${u.pathname}${u.search}`;
    }
  } catch {
    /* keep */
  }
  return raw;
}

/** Same-origin indexer CDN candidates — avoid importing `api.ts` (circular risk). */
function contentFallbackUrls(inscriptionId?: string, primary?: string | null): string[] {
  const id = (inscriptionId || '').trim();
  const out: string[] = [];
  const push = (u?: string) => {
    const s = (u || '').trim();
    if (s && !out.includes(s)) out.push(s);
  };

  push(proxiedContentUrl(primary));
  if (typeof window !== 'undefined' && id) {
    const origin = window.location.origin;
    const host = window.location.hostname;
    // dogecoin.games Vercel rewrite
    push(`${origin}/api/indexer/cdn/content/${encodeURIComponent(id)}`);
    // dojakweb / Next hosts
    push(`${origin}/__indexer/cdn/content/${encodeURIComponent(id)}`);
    if (!host.includes('dogecoin.games')) {
      push(`https://dogex.command.dog/cdn/content/${encodeURIComponent(id)}`);
    }
  }
  return out;
}

async function loadBodyForItem(
  item: InscriptionLike,
  signal?: AbortSignal,
): Promise<string | null> {
  const urls = contentFallbackUrls(item.inscriptionId, item.content || item.preview);
  return loadInscriptionTextBody({
    contentBody: item.contentBody,
    contentUrl: urls[0],
    inscriptionId: item.inscriptionId,
    fallbackContentUrl: urls[1],
    extraFallbackUrls: urls.slice(2),
    signal,
  });
}

/** Scale fixed-size HTML (e.g. 512×512 Ð𝕏 cards) into a square thumb without scrollbars. */
export function HtmlInscriptionIframe({
  html,
  src,
  className = '',
  title,
}: {
  html?: string | null;
  /** Used when CORS blocks fetching the body for srcDoc. */
  src?: string | null;
  className?: string;
  title?: string;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth || 1;
      setScale(w / 512);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const body = (html || '').trim();
  const frameSrc = (src || '').trim();
  if (!body && !frameSrc) {
    return <div className={`relative aspect-square w-full overflow-hidden bg-black ${className}`} />;
  }

  return (
    <div ref={hostRef} className={`relative aspect-square w-full overflow-hidden bg-black ${className}`}>
      <iframe
        title={title || 'HTML inscription'}
        {...(body ? { srcDoc: body } : { src: frameSrc })}
        sandbox=""
        className="pointer-events-none absolute left-0 top-0 border-0"
        style={{
          width: 512,
          height: 512,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      />
    </div>
  );
}

function useHtmlInscriptionBody(item: InscriptionLike): {
  html: string | null;
  loading: boolean;
} {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setHtml(null);
    void (async () => {
      const body = await loadBodyForItem(item, ac.signal);
      if (ac.signal.aborted) return;
      if (body && /<\s*(!doctype|html|div|body)/i.test(body.trim())) {
        setHtml(body);
      }
      setLoading(false);
    })();
    return () => ac.abort();
  }, [item.contentBody, item.content, item.preview, item.inscriptionId]);

  return { html, loading };
}

/** Compact media tile for HTML Doginals (Ð𝕏 souvenir cards, recursive HTML, etc.). */
export function HtmlInscriptionCardMedia({ item, onInspect, className = '' }: CardProps) {
  const { html, loading } = useHtmlInscriptionBody(item);
  const src = contentFallbackUrls(item.inscriptionId, item.content || item.preview)[0];
  const isDx = Boolean((html || '') && /dogex\.dog\/dx|Ð𝕏|44580101/i.test(html || ''));

  return (
    <button
      type="button"
      onClick={onInspect}
      className={`relative flex aspect-square w-full flex-col overflow-hidden bg-black text-left transition hover:brightness-110 ${className}`}
      title="HTML inscription"
    >
      <div className="absolute right-1.5 top-1.5 z-10 inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-black/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200">
        {isDx ? 'Ð𝕏' : 'HTML'}
      </div>
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-[11px] text-white/40">Loading…</div>
      ) : html || src ? (
        <HtmlInscriptionIframe html={html} src={src} title={`#${item.inscriptionNumber ?? ''}`} />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 p-3 text-center">
          <span className="text-[10px] text-white/45">HTML</span>
          <span className="line-clamp-2 font-mono text-[9px] text-white/30">
            {item.contentType || 'text/html'}
          </span>
        </div>
      )}
    </button>
  );
}

/** Small square thumb for send / list flows. */
export function HtmlInscriptionThumb({
  item,
  onClick,
  className = 'h-14 w-14 rounded-lg',
}: {
  item: InscriptionLike;
  onClick?: () => void;
  className?: string;
}) {
  const { html, loading } = useHtmlInscriptionBody(item);
  const src = contentFallbackUrls(item.inscriptionId, item.content || item.preview)[0];
  const inner = loading ? (
    <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-[8px] text-white/40">…</div>
  ) : html || src ? (
    <HtmlInscriptionIframe html={html} src={src} className="h-full w-full" title={`#${item.inscriptionNumber ?? ''}`} />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-[9px] font-bold uppercase text-amber-200/80">
      HTML
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`overflow-hidden border border-amber-400/20 bg-black transition hover:brightness-110 ${className}`}
        title="HTML inscription"
      >
        {inner}
      </button>
    );
  }
  return <div className={`overflow-hidden ${className}`}>{inner}</div>;
}

/** Full inspect sheet for HTML inscription bodies. */
export function InscriptionHtmlInspectModal({ item, open, onClose }: InspectProps) {
  const { html, loading } = useHtmlInscriptionBody(item ?? { inscriptionId: '' });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const openUrl = item ? proxiedContentUrl(item.content || item.preview) || item.content : undefined;

  if (!open || !item || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10120] flex items-center justify-center overflow-y-auto bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Inspect HTML inscription"
      onClick={onClose}
    >
      <div
        className="my-auto flex max-h-[min(90dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/15 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">
              HTML inscription
              {item.inscriptionNumber != null ? (
                <span className="ml-2 font-mono text-xs text-white/45">#{item.inscriptionNumber}</span>
              ) : null}
            </div>
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
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {loading ? (
            <div className="py-12 text-center text-sm text-white/45">Loading HTML…</div>
          ) : html || openUrl ? (
            <div className="mx-auto w-full max-w-[min(100%,512px)] overflow-hidden rounded-xl border border-amber-400/30">
              <HtmlInscriptionIframe html={html} src={openUrl} title={item.inscriptionId} />
            </div>
          ) : (
            <div className="space-y-2 py-8 text-center text-sm text-white/55">
              <p>Could not load HTML body.</p>
              {openUrl ? (
                <a href={openUrl} target="_blank" rel="noopener noreferrer" className="text-[#FCD34D] underline">
                  Open content URL
                </a>
              ) : null}
            </div>
          )}
        </div>
        <div className="shrink-0 border-t border-white/10 px-4 py-2 text-[10px] text-white/35">
          {item.contentType || 'text/html'} · sandboxed preview
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Compact media tile for Ðalkanes / WASM bytecode inscriptions. */
export function WasmInscriptionCardMedia({ item, onInspect, className = '' }: CardProps) {
  const idShort = (item.inscriptionId || '').slice(0, 8);
  return (
    <button
      type="button"
      onClick={onInspect}
      className={`relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden bg-[#0a0f0c] p-3 text-left transition hover:brightness-110 ${className}`}
      title="Ðalkanes WASM contract"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse at 30% 20%, rgba(52,211,153,0.22), transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(16,185,129,0.12), transparent 50%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(52,211,153,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.35) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      />
      <div className="relative z-[1] mb-2 inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-200">
        <span aria-hidden className="font-mono text-[10px] leading-none">
          {'{ }'}
        </span>
        WASM
      </div>
      {/* Hex-chip mark — reads as bytecode without dumping MIME */}
      <svg
        viewBox="0 0 64 64"
        className="relative z-[1] h-14 w-14 text-emerald-300/95 drop-shadow-[0_0_12px_rgba(52,211,153,0.35)]"
        aria-hidden
      >
        <polygon
          points="32,4 56,18 56,46 32,60 8,46 8,18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        />
        <polygon
          points="32,14 48,23 48,41 32,50 16,41 16,23"
          fill="rgba(52,211,153,0.12)"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M24 28h16M24 32h12M24 36h14"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.85"
        />
      </svg>
      <div className="relative z-[1] mt-2 max-w-full truncate font-mono text-[10px] text-emerald-100/70">
        Ðalkanes · {idShort || 'contract'}
      </div>
    </button>
  );
}

/** Compact media tile for text/JSON Doginals in the wallet NFT grid. */
export function TextInscriptionCardMedia({ item, onInspect, className = '' }: CardProps) {
  const [parsed, setParsed] = useState<ParsedInscriptionText | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setParsed(null);
    void (async () => {
      const body = await loadBodyForItem(item, ac.signal);
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

/** Full inspect sheet for text/JSON inscription bodies (portaled above wallet z-index). */
export function InscriptionTextInspectModal({ item, open, onClose }: InspectProps) {
  const [raw, setRaw] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      const body = await loadBodyForItem(item, ac.signal);
      if (ac.signal.aborted) return;
      if (body) setRaw(body);
      else setError(true);
      setLoading(false);
    })();
    return () => ac.abort();
  }, [open, item]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const parsed = useMemo(() => (raw ? parseInscriptionText(raw) : null), [raw]);
  const pretty = useMemo(() => {
    if (!parsed?.json) return raw;
    try {
      return JSON.stringify(parsed.json, null, 2);
    } catch {
      return raw;
    }
  }, [parsed, raw]);

  const openUrl = item ? proxiedContentUrl(item.content || item.preview) || item.content : undefined;

  if (!open || !item || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10120] flex items-center justify-center overflow-y-auto bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Inspect inscription"
      onClick={onClose}
    >
      <div
        className="my-auto flex max-h-[min(90dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/15 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
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
          <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-white/10 px-4 py-3">
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

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {loading ? (
            <div className="py-8 text-center text-sm text-white/45">Loading content…</div>
          ) : error || !pretty ? (
            <div className="space-y-2 py-6 text-center text-sm text-white/55">
              <p>Could not load inscription body (CORS or empty).</p>
              {openUrl ? (
                <a
                  href={openUrl}
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

        <div className="shrink-0 border-t border-white/10 px-4 py-2 text-[10px] text-white/35">
          {item.contentType || 'text'} · tap outside to close
        </div>
      </div>
    </div>,
    document.body,
  );
}

export { isHtmlInscription, isTextishInscription, isWasmInscription };
