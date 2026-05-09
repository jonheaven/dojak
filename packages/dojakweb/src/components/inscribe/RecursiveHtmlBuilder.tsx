/**
 * RecursiveHtmlBuilder — generates HTML that references existing on-chain inscriptions
 * via /content/<inscriptionId> — the standard Doginals/Ordinals recursive pattern.
 *
 * Produces a self-contained HTML file ready to be inscribed via InscribePage.
 */
import React, { useState, useMemo, useRef } from 'react';
import { PlusIcon, TrashIcon, ArrowDownTrayIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';

export type RecursiveTemplate = 'image-gallery' | 'script-canvas' | 'collection-variant' | 'custom';

const TEMPLATE_LABELS: Record<RecursiveTemplate, string> = {
  'image-gallery': 'Image gallery',
  'script-canvas': 'Script + canvas',
  'collection-variant': 'Collection variant (trait index)',
  'custom': 'Custom HTML',
};

const INSCRIPTION_ID_RE = /^[0-9a-f]{64}i\d+$/i;

function isValidInscriptionId(id: string): boolean {
  return INSCRIPTION_ID_RE.test(id.trim());
}

function buildImageGalleryHtml(ids: string[]): string {
  const imgs = ids
    .filter(isValidInscriptionId)
    .map((id) => `  <img src="/content/${id.trim().toLowerCase()}" alt="${id.slice(0, 8)}…">`)
    .join('\n');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin: 0; background: #000; display: flex; flex-wrap: wrap; justify-content: center; align-items: center; min-height: 100vh; gap: 8px; padding: 8px; box-sizing: border-box; }
  img  { max-width: 100%; max-height: 90vh; object-fit: contain; }
</style>
</head>
<body>
${imgs}
</body>
</html>`;
}

function buildScriptCanvasHtml(engineId: string, initCode: string, canvasSize: string): string {
  const [w, h] = canvasSize.split('x').map((n) => n.trim() || '500');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; }
  body { background: #000; overflow: hidden; }
  canvas { display: block; width: 100vw; height: 100vh; }
</style>
</head>
<body>
<canvas id="c" width="${w}" height="${h}"></canvas>
<script src="/content/${engineId.trim().toLowerCase()}"></script>
<script>
${initCode || '// Add your initialisation code here.\n// The engine loaded above should expose its API globally.'}
</script>
</body>
</html>`;
}

function buildCollectionVariantHtml(
  baseId: string,
  collectionName: string,
  index: number,
  traitIndex: string,
  canvasSize: string,
): string {
  const [w, h] = canvasSize.split('x').map((n) => n.trim() || '500');
  const paddedIndex = String(index).padStart(4, '0');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${collectionName} #${paddedIndex}</title>
<style>
  * { margin: 0; padding: 0; }
  body { background: #000; overflow: hidden; }
  canvas { display: block; width: 100vw; height: 100vh; }
  #ti { display: none; }
</style>
</head>
<body>
<div id="ti">${traitIndex}</div>
<canvas id="c" width="${w}" height="${h}"></canvas>
<script src="/content/${baseId.trim().toLowerCase()}"></script>
</body>
</html>`;
}

interface RecursiveHtmlBuilderProps {
  /** Called when the user wants to load the generated HTML into the file inscriber. */
  onLoadHtml: (html: string, filename: string) => void;
}

export const RecursiveHtmlBuilder: React.FC<RecursiveHtmlBuilderProps> = ({ onLoadHtml }) => {
  const [template, setTemplate] = useState<RecursiveTemplate>('image-gallery');

  // Image gallery
  const [galleryIds, setGalleryIds] = useState<string[]>(['']);

  // Script + canvas
  const [engineId, setEngineId] = useState('');
  const [canvasSize, setCanvasSize] = useState('500x500');
  const [initCode, setInitCode] = useState('');

  // Collection variant
  const [baseId, setBaseId] = useState('');
  const [collectionName, setCollectionName] = useState('MyCollection');
  const [variantIndex, setVariantIndex] = useState(1);
  const [traitIndex, setTraitIndex] = useState('010101');
  const [collectionCanvas, setCollectionCanvas] = useState('500x500');

  // Custom
  const [customHtml, setCustomHtml] = useState(
    `<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"></head>\n<body>\n<script src="/content/INSERT_INSCRIPTION_ID_HERE_i0"></script>\n</body>\n</html>`,
  );

  const generatedHtml = useMemo<string>(() => {
    switch (template) {
      case 'image-gallery':
        return buildImageGalleryHtml(galleryIds);
      case 'script-canvas':
        return buildScriptCanvasHtml(engineId, initCode, canvasSize);
      case 'collection-variant':
        return buildCollectionVariantHtml(baseId, collectionName, variantIndex, traitIndex, collectionCanvas);
      case 'custom':
        return customHtml;
    }
  }, [template, galleryIds, engineId, initCode, canvasSize, baseId, collectionName, variantIndex, traitIndex, collectionCanvas, customHtml]);

  const previewRef = useRef<HTMLIFrameElement>(null);

  const handleCopy = () => {
    void navigator.clipboard.writeText(generatedHtml).then(() => toast.success('HTML copied to clipboard.'));
  };

  const handleLoad = () => {
    const filename =
      template === 'collection-variant'
        ? `${collectionName.replace(/\s+/g, '_')}_${String(variantIndex).padStart(4, '0')}.html`
        : template === 'custom'
          ? 'recursive.html'
          : `${template}.html`;
    onLoadHtml(generatedHtml, filename);
    toast.success(`Loaded "${filename}" into the file inscriber — sign & broadcast above.`);
  };

  const previewSrcDoc = useMemo(() => {
    // Strip /content/ src attributes so the iframe preview doesn't 404
    return generatedHtml.replace(/ src="\/content\/[^"]*"/g, ' src="" data-recursive="true"');
  }, [generatedHtml]);

  return (
    <div className="space-y-6">
      {/* Template selector */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-white/80">Template</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TEMPLATE_LABELS) as RecursiveTemplate[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTemplate(t)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                template === t
                  ? 'border-[#FCD34D]/60 bg-[#FCD34D]/20 text-[#FCD34D]'
                  : 'border-white/15 text-white/60 hover:bg-white/10'
              }`}
            >
              {TEMPLATE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Template-specific inputs */}
      {template === 'image-gallery' && (
        <div className="space-y-3">
          <p className="text-xs text-white/50">
            Each inscription ID is loaded as an{' '}
            <code className="text-[#FCD34D]/80">&lt;img src="/content/..."/&gt;</code>. Works for{' '}
            <code className="text-[#FCD34D]/80">image/*</code> inscriptions.
          </p>
          <div className="space-y-2">
            {galleryIds.map((id, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  value={id}
                  onChange={(e) => {
                    const next = [...galleryIds];
                    next[idx] = e.target.value;
                    setGalleryIds(next);
                  }}
                  placeholder={`Inscription ID (e.g. ${'a'.repeat(64)}i0)`}
                  spellCheck={false}
                  className={`flex-1 rounded-lg border bg-bg-secondary px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-muted ${
                    id && !isValidInscriptionId(id) ? 'border-rose-500/60' : 'border-border-primary'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setGalleryIds((prev) => prev.filter((_, j) => j !== idx))}
                  disabled={galleryIds.length === 1}
                  className="rounded-lg border border-white/15 px-2 py-1 text-white/50 hover:bg-white/10 disabled:opacity-30"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setGalleryIds((prev) => [...prev, ''])}
            className="flex items-center gap-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
          >
            <PlusIcon className="h-4 w-4" /> Add inscription
          </button>
        </div>
      )}

      {template === 'script-canvas' && (
        <div className="space-y-3">
          <p className="text-xs text-white/50">
            Load a rendering engine from an existing inscription via{' '}
            <code className="text-[#FCD34D]/80">&lt;script src="/content/..."/&gt;</code>, then run your init code.
          </p>
          <label className="block text-sm text-white/80">
            Engine inscription ID
            <input
              value={engineId}
              onChange={(e) => setEngineId(e.target.value)}
              placeholder={`${'a'.repeat(64)}i0`}
              spellCheck={false}
              className={`mt-1 w-full rounded-lg border bg-bg-secondary px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-muted ${
                engineId && !isValidInscriptionId(engineId) ? 'border-rose-500/60' : 'border-border-primary'
              }`}
            />
          </label>
          <label className="block text-sm text-white/80">
            Canvas size (WxH px)
            <input
              value={canvasSize}
              onChange={(e) => setCanvasSize(e.target.value)}
              placeholder="500x500"
              className="mt-1 w-36 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-xs text-text-primary"
            />
          </label>
          <label className="block text-sm text-white/80">
            Init script
            <textarea
              value={initCode}
              onChange={(e) => setInitCode(e.target.value)}
              rows={5}
              spellCheck={false}
              placeholder="// Call the engine's API here&#10;// e.g. draw({ canvas: document.getElementById('c'), seed: 42 })"
              className="mt-1 w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-muted"
            />
          </label>
        </div>
      )}

      {template === 'collection-variant' && (
        <div className="space-y-3">
          <p className="text-xs text-white/50">
            Mirrors the <code className="text-[#FCD34D]/80">DoginalsRecursiveCollectionCreator</code> pattern: a hidden{' '}
            <code className="text-[#FCD34D]/80">#ti</code> div carries the trait index string; the base inscription
            engine reads it and renders the correct combination.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm text-white/80">
              Collection name
              <input
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="MyCollection"
                className="mt-1 w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-xs text-text-primary"
              />
            </label>
            <label className="block text-sm text-white/80">
              Edition #
              <input
                type="number"
                min={1}
                value={variantIndex}
                onChange={(e) => setVariantIndex(Number(e.target.value) || 1)}
                className="mt-1 w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-xs text-text-primary"
              />
            </label>
          </div>
          <label className="block text-sm text-white/80">
            Base engine inscription ID (must be already on-chain)
            <input
              value={baseId}
              onChange={(e) => setBaseId(e.target.value)}
              placeholder={`${'a'.repeat(64)}i0`}
              spellCheck={false}
              className={`mt-1 w-full rounded-lg border bg-bg-secondary px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-muted ${
                baseId && !isValidInscriptionId(baseId) ? 'border-rose-500/60' : 'border-border-primary'
              }`}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm text-white/80">
              Trait index string{' '}
              <span className="text-white/40">(e.g. "010203" = layer1→trait1, layer2→trait2 …)</span>
              <input
                value={traitIndex}
                onChange={(e) => setTraitIndex(e.target.value)}
                placeholder="010101"
                spellCheck={false}
                className="mt-1 w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 font-mono text-xs text-text-primary"
              />
            </label>
            <label className="block text-sm text-white/80">
              Canvas size (WxH)
              <input
                value={collectionCanvas}
                onChange={(e) => setCollectionCanvas(e.target.value)}
                placeholder="500x500"
                className="mt-1 w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-xs text-text-primary"
              />
            </label>
          </div>
        </div>
      )}

      {template === 'custom' && (
        <div className="space-y-2">
          <p className="text-xs text-white/50">
            Write any HTML. Reference inscriptions as{' '}
            <code className="text-[#FCD34D]/80">/content/&lt;txid&gt;i0</code> in{' '}
            <code className="text-[#FCD34D]/80">src</code> or <code className="text-[#FCD34D]/80">href</code> attributes.
          </p>
          <textarea
            value={customHtml}
            onChange={(e) => setCustomHtml(e.target.value)}
            rows={12}
            spellCheck={false}
            className="w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 font-mono text-xs text-text-primary"
          />
        </div>
      )}

      {/* Generated HTML preview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white/60">Generated HTML</span>
          <span className="text-xs text-white/30">{new Blob([generatedHtml]).size} bytes</span>
        </div>
        <pre className="max-h-48 overflow-auto rounded-lg border border-white/10 bg-black/50 p-3 font-mono text-[10px] leading-relaxed text-white/60 whitespace-pre-wrap break-all">
          {generatedHtml}
        </pre>
      </div>

      {/* Sandbox preview */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-white/60">
          Sandbox preview{' '}
          <span className="font-normal text-white/30">(/content/ src attrs removed — layout only)</span>
        </span>
        <iframe
          ref={previewRef}
          srcDoc={previewSrcDoc}
          sandbox="allow-scripts"
          title="Recursive inscription preview"
          className="h-64 w-full rounded-lg border border-white/10 bg-black"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
        >
          <DocumentDuplicateIcon className="h-4 w-4" /> Copy HTML
        </button>
        <button
          type="button"
          onClick={handleLoad}
          className="flex items-center gap-2 rounded-xl bg-[#FCD34D] px-5 py-2 text-sm font-bold text-black hover:bg-[#fde68a]"
        >
          <ArrowDownTrayIcon className="h-4 w-4" /> Load into file inscriber
        </button>
      </div>
      <p className="text-xs text-white/35 leading-relaxed">
        After clicking <strong className="text-white/55">Load into file inscriber</strong>, the app switches to the{' '}
        <strong className="text-white/55">File inscriber</strong> tab automatically. The HTML is pre-loaded with MIME
        type <code className="text-[#FCD34D]/70">text/html</code>. Sign and broadcast as normal. The inscription will
        load referenced content from chain at render time via <code className="text-[#FCD34D]/70">/content/…</code>.
      </p>
    </div>
  );
};
