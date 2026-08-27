/** Optional command.dog helpers for tweet check + souvenir art. */
import { getCommandDogApiBaseUrl } from '../../utils/api';

function cmdRoot(): string {
  return getCommandDogApiBaseUrl().replace(/\/+$/, '');
}

export async function verifyDxTweet(params: {
  tweetUrl: string;
  xHandle: string;
  dogeAddress: string;
}): Promise<{ ok: boolean; tweetId?: string; error?: string }> {
  try {
    const res = await fetch(`${cmdRoot()}/v1/dx/verify-tweet`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tweet_url: params.tweetUrl,
        x_handle: params.xHandle,
        doge_address: params.dogeAddress,
      }),
    });
    const j = (await res.json()) as { ok?: boolean; tweetId?: string; tweet_id?: string; error?: string };
    if (!res.ok) return { ok: false, error: j.error || `HTTP ${res.status}` };
    return { ok: !!j.ok, tweetId: j.tweetId || j.tweet_id, error: j.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Tweet check failed' };
  }
}

export type DxCardArtResult = {
  ok: boolean;
  badgeImageUrl?: string | null;
  error?: string;
  /** Set when xAI is not configured on command.dog. */
  grokSkipped?: string;
  /** Set when Grok was attempted but failed. */
  grokError?: string;
};

function parseDxCardArtJson(j: Record<string, unknown>): DxCardArtResult {
  const visual = (j.visual_data && typeof j.visual_data === 'object'
    ? j.visual_data
    : {}) as Record<string, unknown>;
  const url =
    (typeof j.badge_image_url === 'string' ? j.badge_image_url : null) ||
    (typeof visual.badge_image_url === 'string' ? visual.badge_image_url : null);
  const grokSkipped =
    typeof visual.image_generation_skipped === 'string' ? visual.image_generation_skipped : undefined;
  const grokErrorRaw = visual.image_generation_error;
  const grokError =
    typeof grokErrorRaw === 'string'
      ? grokErrorRaw
      : grokErrorRaw != null
        ? JSON.stringify(grokErrorRaw)
        : undefined;
  return { ok: true, badgeImageUrl: url, grokSkipped, grokError };
}

export async function requestDxCardArt(params: {
  userAddress: string;
  xHandle: string;
  stylePack?: string;
}): Promise<DxCardArtResult> {
  try {
    const res = await fetch(`${cmdRoot()}/v1/dx/card-art`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_address: params.userAddress,
        x_handle: params.xHandle,
        style_pack: params.stylePack ?? 'trading_card',
      }),
    });
    const j = (await res.json()) as Record<string, unknown> & { error?: string };
    if (!res.ok) return { ok: false, error: j.error || `HTTP ${res.status}` };
    return parseDxCardArtJson(j);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Card art failed' };
  }
}

/** Human message when Grok was requested but no image URL came back. */
export function dxCardArtFailureMessage(art: DxCardArtResult): string {
  return (
    art.error ||
    art.grokSkipped ||
    art.grokError ||
    'Grok Imagine did not return art — configure XAI_API_KEY on command.dog or mint a text-only card'
  );
}
