'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  doggyMarketInscriptionPageUrl,
  fetchDoggyMarketInscription,
  type DoggyMarketInscriptionMeta,
} from '../../lib/doggy-market-inscription';
import { inscriptionContentCandidates, inscriptionContentPrimary } from '../../lib/inscription-media';
import { InscriptionMediaImg } from './InscriptionMediaImg';
import {
  isHtmlInscription,
  isTextishInscription,
  isWasmInscription,
  loadInscriptionTextBody,
  parseInscriptionText,
} from '../../utils/inscription-text';
import { HtmlInscriptionIframe } from './TextInscriptionPreview';

type InscriptionLike = {
  inscriptionId: string;
  inscriptionNumber?: number;
  contentType?: string;
  content?: string;
  contentBody?: string;
  preview?: string;
  output?: string;
  location?: string;
  address?: string;
};

function mediaUrl(item: InscriptionLike, doggy?: DoggyMarketInscriptionMeta | null): string {
  return inscriptionContentPrimary({
    inscriptionId: item.inscriptionId,
    content: doggy?.content || item.content,
    preview: doggy?.preview || item.preview,
  });
}

export function InscriptionInspectModal({
  item,
  open,
  onClose,
}: {
  item: InscriptionLike | null;
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [doggy, setDoggy] = useState<DoggyMarketInscriptionMeta | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [textBody, setTextBody] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !item) {
      setDoggy(null);
      setHtml(null);
      setTextBody(null);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    void (async () => {
      const [meta, body] = await Promise.all([
        fetchDoggyMarketInscription(item.inscriptionId, ac.signal),
        isHtmlInscription(item.contentType) || isTextishInscription(item.contentType) || isWasmInscription(item.contentType)
          ? loadInscriptionTextBody({
              contentBody: item.contentBody,
              contentUrl: item.content || item.preview,
              inscriptionId: item.inscriptionId,
              extraFallbackUrls: inscriptionContentCandidates({
                inscriptionId: item.inscriptionId,
                content: item.content,
                preview: item.preview,
              }).slice(1),
              signal: ac.signal,
            })
          : Promise.resolve(null),
      ]);
      if (ac.signal.aborted) return;
      setDoggy(meta);
      if (body && isHtmlInscription(item.contentType)) setHtml(body);
      else if (body) setTextBody(body);
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

  const parsed = useMemo(() => (textBody ? parseInscriptionText(textBody) : null), [textBody]);
  const pretty = useMemo(() => {
    if (!parsed?.json) return textBody;
    try {
      return JSON.stringify(parsed.json, null, 2);
    } catch {
      return textBody;
    }
  }, [parsed, textBody]);

  if (!open || !item || !mounted) return null;

  const ct = item.contentType || doggy?.contentType || '';
  const src = mediaUrl(item, doggy);
  const number = item.inscriptionNumber ?? doggy?.inscriptionNumber;
  const owner = doggy?.owner || item.address;
  const utxo = doggy?.output || item.output || item.location;
  const collection = doggy?.collectionName || doggy?.itemName;

  return createPortal(
    <div
      className="fixed inset-0 z-[10120] flex items-center justify-center overflow-y-auto bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Inscription details"
      onClick={onClose}
    >
      <div
        className="my-auto flex max-h-[min(92dvh,820px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/15 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">
              {collection || parsed?.title || 'Inscription'}
              {number != null ? (
                <span className="ml-2 font-mono text-xs text-white/45">#{number}</span>
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

        <div className="min-h-0 flex-1 overflow-auto p-3 space-y-3">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
            {isHtmlInscription(ct) ? (
              <HtmlInscriptionIframe html={html} src={src} title={item.inscriptionId} />
            ) : isWasmInscription(ct) ? (
              <div className="flex aspect-square items-center justify-center bg-[#0a0f0c] font-mono text-sm text-emerald-200">
                {'{ WASM }'}
              </div>
            ) : ct.startsWith('image/') || (!isTextishInscription(ct) && src) ? (
              <InscriptionMediaImg
                inscriptionId={item.inscriptionId}
                content={doggy?.content || item.content}
                preview={doggy?.preview || item.preview}
                className="aspect-square w-full object-contain bg-black"
              />
            ) : loading ? (
              <div className="py-12 text-center text-sm text-white/45">Loading…</div>
            ) : pretty ? (
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[11px] text-emerald-100/90">
                {pretty}
              </pre>
            ) : (
              <div className="py-10 text-center text-sm text-white/45">{ct || 'No preview'}</div>
            )}
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11px]">
            <dt className="text-white/40">Type</dt>
            <dd className="truncate font-mono text-white/80">{ct || '—'}</dd>
            {owner ? (
              <>
                <dt className="text-white/40">Owner</dt>
                <dd className="truncate font-mono text-white/80">{owner}</dd>
              </>
            ) : null}
            {utxo ? (
              <>
                <dt className="text-white/40">UTXO</dt>
                <dd className="truncate font-mono text-white/80">{utxo}</dd>
              </>
            ) : null}
            {doggy?.blockHeight ? (
              <>
                <dt className="text-white/40">Block</dt>
                <dd className="font-mono text-white/80">{doggy.blockHeight}</dd>
              </>
            ) : null}
            {doggy?.contentLength != null ? (
              <>
                <dt className="text-white/40">Size</dt>
                <dd className="font-mono text-white/80">{doggy.contentLength.toLocaleString()} B</dd>
              </>
            ) : null}
          </dl>

          {doggy?.traits?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {doggy.traits.slice(0, 12).map((trait) => (
                <span
                  key={`${trait.key}:${trait.value}`}
                  className="rounded-md bg-white/8 px-2 py-0.5 text-[10px] text-white/70"
                >
                  {trait.key}: {trait.value}
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 text-[11px]">
            <a
              href={doggyMarketInscriptionPageUrl(item.inscriptionId)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-amber-400/35 px-3 py-1 font-semibold text-amber-200 hover:bg-amber-400/10"
            >
              doggy.market
            </a>
            {src ? (
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/15 px-3 py-1 text-white/70 hover:bg-white/5"
              >
                Content
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
