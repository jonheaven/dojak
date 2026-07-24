/** Helpers for rendering text / JSON Doginals in the wallet UI. */

export function normalizeContentType(contentType?: string | null): string {
  return String(contentType || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
}

/** text/* (except html) or application/json — suitable for in-wallet text preview. */
export function isTextishInscription(contentType?: string | null): boolean {
  const ct = normalizeContentType(contentType);
  if (!ct) return false;
  if (ct === 'application/json' || ct.endsWith('+json')) return true;
  if (ct.startsWith('text/html')) return false;
  return ct.startsWith('text/');
}

export function isJsonInscription(contentType?: string | null, body?: string | null): boolean {
  const ct = normalizeContentType(contentType);
  if (ct === 'application/json' || ct.endsWith('+json')) return true;
  if (!body) return false;
  const t = body.trim();
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
  const text = raw.trim();
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

async function fetchTextUrl(url: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const r = await fetch(url, { signal, mode: 'cors' });
    if (!r.ok) return null;
    return await r.text();
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
  signal?: AbortSignal;
}): Promise<string | null> {
  const inline = (opts.contentBody || '').trim();
  if (inline) return inline;

  const url = (opts.contentUrl || '').trim();
  if (url.startsWith('data:')) {
    if (url.startsWith('data:text') || url.startsWith('data:application/json')) {
      const comma = url.indexOf(',');
      if (comma >= 0) {
        const meta = url.slice(0, comma);
        const data = url.slice(comma + 1);
        try {
          return meta.includes(';base64') ? atob(data) : decodeURIComponent(data);
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  if (url) {
    const fromUrl = await fetchTextUrl(url, opts.signal);
    if (fromUrl != null) return fromUrl;
  }

  const fallback = (opts.fallbackContentUrl || '').trim();
  if (fallback && fallback !== url) {
    const fromFallback = await fetchTextUrl(fallback, opts.signal);
    if (fromFallback != null) return fromFallback;
  }

  return null;
}
