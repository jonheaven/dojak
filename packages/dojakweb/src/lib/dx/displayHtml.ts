/**
 * Minimal HTML inscription that loads a shared badge image from a content API (recursive-style)
 * and overlays Ð𝕏 identity text — keeps per-user on-chain payload small vs re-inscribing the image.
 */

export function escapeHtmlForDxCard(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Strip accidental scheme/host if operators paste a full URL — indexer APIs expect bare inscription id. */
export function normalizeDxInscriptionIdForUrl(id: string): string {
  const t = id.trim();
  const lower = t.toLowerCase();
  const slashIdx = lower.lastIndexOf('/content/');
  if (slashIdx >= 0) {
    return t.slice(slashIdx + '/content/'.length).replace(/^\/+/, '');
  }
  return t;
}

export function defaultDxContentApiBase(): string {
  const fromEnv = import.meta.env.VITE_DX_CONTENT_API_BASE?.trim();
  return (fromEnv && fromEnv.replace(/\/+$/, '')) || 'https://api.mydoge.com';
}

/** Once the team inscribes `dogexcheck-400.webp`, set this in `.env` for wallet-card mode. */
export function dxBadgeInscriptionIdFromEnv(): string | null {
  const id = import.meta.env.VITE_DX_BADGE_INSCRIPTION_ID?.trim();
  return id ? normalizeDxInscriptionIdForUrl(id) : null;
}

export function buildDxWalletCardHtml(params: {
  badgeInscriptionId: string;
  contentApiBaseUrl: string;
  xHandle: string;
  dogeAddress: string;
  tweetId?: string;
  nonce?: string;
}): string {
  const base = params.contentApiBaseUrl.replace(/\/+$/, '');
  const insId = normalizeDxInscriptionIdForUrl(params.badgeInscriptionId);
  const imgSrc = `${base}/content/${encodeURIComponent(insId)}`;
  const handle = escapeHtmlForDxCard(params.xHandle.trim());
  const addr = escapeHtmlForDxCard(params.dogeAddress.trim());
  const subBits: string[] = [];
  if (params.nonce?.trim()) subBits.push(`nonce ${escapeHtmlForDxCard(params.nonce.trim())}`);
  if (params.tweetId?.trim()) subBits.push(`post ${escapeHtmlForDxCard(params.tweetId.trim())}`);
  const subline = subBits.length ? subBits.join(' · ') : '';

  return `<!DOCTYPE html><meta charset=utf-8><title>Ð𝕏 ${handle}</title><style>*{box-sizing:border-box;margin:0}body{background:#0a0a0a;color:#fafafa;font:13px/1.35 system-ui,sans-serif;padding:12px}.w{position:relative;width:100%;max-width:400px;margin:0 auto;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.12)}.w img{width:100%;height:auto;display:block;vertical-align:top}.o{position:absolute;left:0;right:0;bottom:0;padding:14px 12px 12px;background:linear-gradient(180deg,transparent,rgba(0,0,0,.78))}.h{font-weight:800;font-size:17px;letter-spacing:.02em}.a{font:11px/1.35 ui-monospace,monospace;opacity:.88;margin-top:6px;word-break:break-all}.s{font-size:10px;opacity:.65;margin-top:8px}</style><div class=w><img src="${imgSrc}" alt="" decoding=async><div class=o><div class=h>${handle}</div><div class=a>${addr}</div>${subline ? `<div class=s>${subline}</div>` : ''}</div></div>`;
}
