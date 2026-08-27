/** Helpers for rendering text / JSON Doginals in the wallet UI. */

export function normalizeContentType(contentType?: string | null): string {
  return String(contentType || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
}

/**
 * InuBits (and some proxies) sometimes return UTF-8 bodies decoded as Latin-1, so
 * on-chain `Ð:LOTTO` (U+00D0 / bytes C3 90) shows up as `Ã:LOTTO`. Chain data is fine —
 * only repair for wallet display / protocol detection.
 */
export function repairInubitsUtf8Mojibake(text: string): string {
  if (!text) return text;
  const markerOnly = text
    .replace(/\u00c3\u00d0:LOTTO/g, '\u00d0:LOTTO')
    .replace(/\u00c3\u0090:LOTTO/g, '\u00d0:LOTTO')
    .replace(/\u00c3\u00d0:MP/g, '\u00d0:MP')
    .replace(/\u00c3\u0090:MP/g, '\u00d0:MP');

  // Broader Latin-1→UTF-8 round-trip when the whole body looks mojibaked.
  if (!/\u00c3[\u0080-\u00ff]/.test(text)) return markerOnly;
  if (![...text].every((c) => c.charCodeAt(0) <= 0xff)) return markerOnly;
  try {
    const bytes = Uint8Array.from([...text], (c) => c.charCodeAt(0));
    const fixed = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (fixed.includes('\u00d0:') || (fixed.includes(':LOTTO') && !fixed.includes('\u00c3'))) {
      return fixed;
    }
  } catch {
    /* keep marker-only repair */
  }
  return markerOnly;
}

/** text/* (except html) or application/json — suitable for in-wallet text preview. */
export function isTextishInscription(contentType?: string | null): boolean {
  const ct = normalizeContentType(contentType);
  if (!ct) return false;
  if (ct === 'application/json' || ct.endsWith('+json')) return true;
  if (isHtmlInscription(contentType)) return false;
  return ct.startsWith('text/');
}

/** HTML Doginals — render in sandboxed iframe, not as plain text. */
export function isHtmlInscription(contentType?: string | null): boolean {
  const ct = normalizeContentType(contentType);
  if (!ct) return false;
  return (
    ct === 'text/html' ||
    ct === 'application/xhtml+xml' ||
    ct === 'application/html' ||
    ct.endsWith('+html') ||
    ct.includes('html')
  );
}

/** Ðalkanes / WASM bytecode inscriptions (application/wasm, alkane/*). */
export function isWasmInscription(contentType?: string | null): boolean {
  const ct = normalizeContentType(contentType);
  if (!ct) return false;
  return ct === 'application/wasm' || ct.includes('wasm') || ct.includes('alkane');
}

export function isJsonInscription(contentType?: string | null, body?: string | null): boolean {
  const ct = normalizeContentType(contentType);
  if (ct === 'application/json' || ct.endsWith('+json')) return true;
  if (!body) return false;
  const t = repairInubitsUtf8Mojibake(body).trim();
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'));
}

export type ParsedInscriptionText = {
  raw: string;
  json: unknown | null;
  /** Protocol hint from JSON `p` field when present */
  protocol?: string;
  op?: string;
  title: string;
  subtitle?: string;
  chips?: string[];
};

export function parseInscriptionText(raw: string): ParsedInscriptionText {
  const text = repairInubitsUtf8Mojibake(raw).trim();
  let json: unknown | null = null;
  try {
    if (
      (text.startsWith('{') && text.endsWith('}')) ||
      (text.startsWith('[') && text.endsWith(']'))
    ) {
      json = JSON.parse(text);
    }
  } catch {
    json = null;
  }

  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const o = json as Record<string, unknown>;
    const protocol = typeof o.p === 'string' ? o.p : undefined;
    const op = typeof o.op === 'string' ? o.op : undefined;
    const picks = Array.isArray(o.picks)
      ? o.picks.filter((n) => typeof n === 'number' || typeof n === 'string').map(String)
      : undefined;
    const game = typeof o.game === 'string' ? o.game : undefined;
    const tick = typeof o.tick === 'string' ? o.tick : typeof o.ticker === 'string' ? o.ticker : undefined;
    const round =
      typeof o.round === 'string' || typeof o.round === 'number' ? String(o.round) : undefined;

    if (protocol && /lotto/i.test(protocol)) {
      const kind =
        op === 'ticket' ? 'Ticket' : op === 'launch' ? 'Launch' : op || 'Event';
      const subtitleParts = [
        game ? `game · ${game}` : null,
        round ? `round · ${round}` : null,
        !game && !round ? protocol : null,
      ].filter(Boolean);
      return {
        raw: text,
        json,
        protocol,
        op,
        title: `ÐLotto ${kind}`,
        subtitle: subtitleParts.join(' · ') || protocol,
        chips: picks?.length ? picks : undefined,
      };
    }

    if (protocol && (/drc-20/i.test(protocol) || protocol === 'dt' || /treat/i.test(protocol))) {
      return {
        raw: text,
        json,
        protocol,
        op,
        title: `${protocol}${op ? ` · ${op}` : ''}`,
        subtitle: tick ? `tick · ${tick}` : undefined,
      };
    }

    if (protocol || op) {
      return {
        raw: text,
        json,
        protocol,
        op,
        title: [protocol, op].filter(Boolean).join(' · ') || 'JSON',
        subtitle: tick || game,
        chips: picks,
      };
    }

    const keys = Object.keys(o).slice(0, 6);
    return {
      raw: text,
      json,
      title: 'JSON inscription',
      subtitle: keys.length ? keys.join(' · ') : undefined,
    };
  }

  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) || text;
  return {
    raw: text,
    json: null,
    title: 'Text inscription',
    subtitle: firstLine.slice(0, 80) + (firstLine.length > 80 ? '…' : ''),
  };
}

/** True when body is ÐLotto protocol JSON (`p` contains LOTTO). */
export function isDlottoInscriptionText(body?: string | null): boolean {
  if (!body) return false;
  const parsed = parseInscriptionText(body);
  return Boolean(parsed.protocol && /lotto/i.test(parsed.protocol));
}

async function fetchTextUrl(url: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const r = await fetch(url, { signal, mode: 'cors' });
    if (!r.ok) return null;
    const text = await r.text();
    return repairInubitsUtf8Mojibake(text);
  } catch {
    return null;
  }
}

/**
 * Load inscription body for text/JSON preview.
 * Do not import `./api` here — that creates a circular dependency and can break
 * InuBits merge (tickets disappear from the wallet grid).
 */
export async function loadInscriptionTextBody(opts: {
  contentBody?: string | null;
  contentUrl?: string | null;
  inscriptionId?: string | null;
  /** Fallback content URL when content/preview fail (e.g. dogex CDN). */
  fallbackContentUrl?: string | null;
  /** Additional same-origin / CDN candidates after primary + fallback. */
  extraFallbackUrls?: string[] | null;
  signal?: AbortSignal;
}): Promise<string | null> {
  const inline = (opts.contentBody || '').trim();
  if (inline) return repairInubitsUtf8Mojibake(inline);

  const url = (opts.contentUrl || '').trim();
  if (url.startsWith('data:')) {
    if (url.startsWith('data:text') || url.startsWith('data:application/json')) {
      const comma = url.indexOf(',');
      if (comma >= 0) {
        const meta = url.slice(0, comma);
        const data = url.slice(comma + 1);
        try {
          const decoded = meta.includes(';base64') ? atob(data) : decodeURIComponent(data);
          return repairInubitsUtf8Mojibake(decoded);
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  const tried = new Set<string>();
  const tryUrl = async (u: string) => {
    const s = u.trim();
    if (!s || tried.has(s)) return null;
    tried.add(s);
    return fetchTextUrl(s, opts.signal);
  };

  if (url) {
    const fromUrl = await tryUrl(url);
    if (fromUrl != null) return fromUrl;
  }

  const fallback = (opts.fallbackContentUrl || '').trim();
  if (fallback) {
    const fromFallback = await tryUrl(fallback);
    if (fromFallback != null) return fromFallback;
  }

  for (const extra of opts.extraFallbackUrls || []) {
    const fromExtra = await tryUrl(extra);
    if (fromExtra != null) return fromExtra;
  }

  return null;
}
