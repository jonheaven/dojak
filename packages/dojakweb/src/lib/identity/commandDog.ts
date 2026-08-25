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

export async function requestDxCardArt(params: {
  userAddress: string;
  xHandle: string;
  stylePack?: string;
}): Promise<{ ok: boolean; badgeImageUrl?: string | null; error?: string }> {
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
    const j = (await res.json()) as {
      ok?: boolean;
      badge_image_url?: string | null;
      error?: string;
      visual_data?: { badge_image_url?: string };
    };
    if (!res.ok) return { ok: false, error: j.error || `HTTP ${res.status}` };
    return {
      ok: true,
      badgeImageUrl: j.badge_image_url || j.visual_data?.badge_image_url || null,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Card art failed' };
  }
}
