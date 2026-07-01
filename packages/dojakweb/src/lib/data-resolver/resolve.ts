/**
 * Layered wallet data resolver — dogex primary, MyDoge/Doggy CDN fallback.
 * See dogex/docs/API_TAXONOMY.md.
 */
import {
  dogexCdnContentUrl,
  getWalletDataProviderConfig,
  walletDataApi,
  type MyDogeInscription,
} from '../../utils/api';
import { doggyMarketInscriptionCdnContentUrl } from '../doggy-market-inscription';

export type InscriptionContentSource = 'dogex-cdn' | 'doggy-cdn' | 'mydoge-preview' | 'none';

/** Prefer dogex CDN, then existing preview, then Doggy CDN for images. */
export function resolveInscriptionPreviewUrl(inscription: MyDogeInscription): {
  url: string;
  source: InscriptionContentSource;
} {
  const id = inscription.inscriptionId?.trim();
  if (id) {
    const cfg = getWalletDataProviderConfig();
    if (cfg.walletDataProvider === 'dogex' || cfg.indexerApiBase) {
      return { url: dogexCdnContentUrl(id), source: 'dogex-cdn' };
    }
  }
  if (inscription.preview?.trim()) {
    return { url: inscription.preview.trim(), source: 'mydoge-preview' };
  }
  if (id && inscription.contentType?.startsWith('image/')) {
    return { url: doggyMarketInscriptionCdnContentUrl(id), source: 'doggy-cdn' };
  }
  return { url: '', source: 'none' };
}

/** Fetch inscriptions: active provider first; optional MyDoge fallback when dogex returns empty. */
export async function resolveInscriptions(address: string): Promise<MyDogeInscription[]> {
  const cfg = getWalletDataProviderConfig();
  const primary = await walletDataApi.fetchInscriptions(address);
  if (primary.length > 0 || cfg.walletDataProvider === 'mydoge') {
    return primary;
  }
  // dogex empty → try MyDoge API as fallback (same MyDoge-shaped paths)
  try {
    const base = 'https://api.mydoge.com';
    const res = await fetch(`${base}/inscriptions/${encodeURIComponent(address)}`);
    if (!res.ok) return primary;
    const data = (await res.json()) as { list?: MyDogeInscription[] };
    return Array.isArray(data.list) ? data.list : primary;
  } catch {
    return primary;
  }
}
