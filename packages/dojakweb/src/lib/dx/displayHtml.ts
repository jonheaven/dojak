/**
 * Minimal HTML inscription that loads a shared badge image from a content API (recursive-style)
 * and overlays Ð𝕏 identity text — keeps per-user on-chain payload small vs re-inscribing the image.
 *
 * Collectible cards use a fixed 512×512 canvas so marketplaces (doggy.market, etc.) render
 * square thumbnails without iframe scrollbars.
 */

import { getEnv } from '../../utils/env';

/** Square side length — keep 512 for crisp marketplace thumbs. */
export const DX_COLLECTIBLE_SIZE_PX = 512;

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
  const fromEnv = getEnv('VITE_DX_CONTENT_API_BASE', '').trim();
  return (fromEnv && fromEnv.replace(/\/+$/, '')) || 'https://api.mydoge.com';
}

/** Once the team inscribes `dogexcheck-400.webp`, set this in `.env` for wallet-card mode. */
export function dxBadgeInscriptionIdFromEnv(): string | null {
  const id = getEnv('VITE_DX_BADGE_INSCRIPTION_ID', '').trim();
  return id ? normalizeDxInscriptionIdForUrl(id) : null;
}

export function shortDxTxidForCard(txid: string): string {
  const t = txid.trim();
  if (t.length <= 18) return t;
  return `${t.slice(0, 8)}…${t.slice(-6)}`;
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

/** True when an HTML body is a Ð𝕏 souvenir card (product collectible, not the bind). */
export function isDxSouvenirHtml(body: string | null | undefined): boolean {
  if (!body) return false;
  const lower = body.toLowerCase();
  if (!lower.includes('dogex.dog/dx')) return false;
  return (
    lower.includes('souvenir') ||
    lower.includes('op_return dx') ||
    body.includes('Ð𝕏') ||
    /dx\s+[0-9a-f]{6}/i.test(body)
  );
}

/** Shareable HTML NFT after an OP_RETURN `dx` bind. Fixed square — not the identity record. */
export function buildDxCollectibleHtml(params: {
  xHandle: string;
  dogeAddress: string;
  dxTxid: string;
  tweetId?: string | null;
  artUrl?: string | null;
}): string {
  const size = DX_COLLECTIBLE_SIZE_PX;
  const handle = escapeHtmlForDxCard(params.xHandle.trim());
  const addr = escapeHtmlForDxCard(params.dogeAddress.trim());
  const txShort = escapeHtmlForDxCard(shortDxTxidForCard(params.dxTxid.trim()));
  const tweet = params.tweetId?.trim()
    ? escapeHtmlForDxCard(params.tweetId.trim())
    : '';
  const art = params.artUrl?.trim() ?? '';
  const safeArt =
    art.startsWith('https://') || art.startsWith('http://') || art.startsWith('data:image')
      ? art.replace(/"/g, '')
      : '';
  const artBlock = safeArt
    ? `<img src="${safeArt}" alt="" decoding=async>`
    : `<div class=ph>Ð𝕏</div>`;
  return `<!DOCTYPE html><html><head><meta charset=utf-8><title>Ð𝕏 ${handle}</title><style>html,body{width:${size}px;height:${size}px;margin:0;padding:0;overflow:hidden;background:#050505;color:#fafafa;font-family:system-ui,sans-serif}*{box-sizing:border-box}.card{position:relative;width:${size}px;height:${size}px;border:3px solid #fbbf24;overflow:hidden;background:#111}.art{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 30% 20%,#3f2a0a 0%,#050505 70%)}.art img{width:100%;height:100%;object-fit:cover;display:block}.ph{font:800 ${Math.round(size * 0.22)}px/1 system-ui;color:#fbbf24;text-shadow:0 2px 24px rgba(251,191,36,.35)}.overlay{position:absolute;left:0;right:0;bottom:0;padding:10px 12px 12px;background:linear-gradient(180deg,transparent 0%,rgba(0,0,0,.88) 38%,#000 100%)}.h{font-weight:800;font-size:20px;line-height:1.05;letter-spacing:.01em}.m{font:9px/1.3 ui-monospace,monospace;opacity:.82;margin-top:3px;word-break:break-all}.cta{margin-top:5px;font-size:8px;color:#fbbf24;opacity:.92;letter-spacing:.02em}a{color:#fbbf24;text-decoration:none}</style></head><body><div class=card><div class=art>${artBlock}</div><div class=overlay><div class=h>${handle}</div><div class=m>${addr}</div><div class=m>dx ${txShort}</div>${tweet ? `<div class=m>tweet ${tweet}</div>` : ''}<div class=cta>dogex.dog/dx · souvenir</div></div></div></body></html>`;
}
