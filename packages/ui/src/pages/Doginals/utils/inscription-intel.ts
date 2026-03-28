import {
  Doginal,
  DoginalInsights,
  DoginalMediaType,
  DoginalProtocolTag,
  DoginalViewModel,
  VepeMetadata
} from '../types';

const isJsonLike = (contentType?: string) => contentType?.includes('json') || contentType?.includes('javascript');
const isTextLike = (contentType?: string) => contentType?.startsWith('text/') || contentType === 'application/text';

const normalizeHashtags = (hashtags?: string[] | string): string[] => {
  if (!hashtags) return [];
  if (Array.isArray(hashtags)) return hashtags.map((tag) => tag.replace(/^#/, '')).filter(Boolean);
  return hashtags
    .split(/[\s,]+/)
    .map((tag) => tag.replace(/^#/, ''))
    .filter(Boolean);
};

export function detectMediaType(doginal: Doginal): DoginalMediaType {
  const contentType = doginal.contentType?.toLowerCase() || '';

  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType.includes('html')) return 'html';
  if (contentType.includes('model')) return 'model';
  if (isJsonLike(contentType) || isTextLike(contentType)) return 'text';
  return 'unknown';
}

export function parseVepeMetadata(doginal: Doginal): VepeMetadata | undefined {
  const vepeMeta = doginal.meta?.vepe as VepeMetadata | undefined;
  if (vepeMeta) {
    return {
      ...vepeMeta,
      hashtags: normalizeHashtags(vepeMeta.hashtags)
    };
  }

  if (isJsonLike(doginal.contentType) || isTextLike(doginal.contentType)) {
    try {
      const parsed = JSON.parse(doginal.content);
      if (parsed?.vepe) {
        return {
          caption: parsed.vepe.caption || parsed.caption,
          hashtags: normalizeHashtags(parsed.vepe.hashtags || parsed.hashtags),
          location: parsed.vepe.location || parsed.location,
          videoInscriptionId: parsed.vepe.videoInscriptionId || parsed.video || parsed.videoInscription,
          createdAt: parsed.vepe.createdAt || parsed.createdAt
        };
      }
    } catch (error) {
      // Text-only Vepe metadata: look for hashtags or caption markers
      const hashtags = normalizeHashtags(
        doginal.content
          ?.split(/\s+/)
          .filter((token) => token.startsWith('#'))
          .join(' ')
      );

      if (hashtags.length > 0) {
        return {
          caption: doginal.content,
          hashtags
        };
      }
    }
  }

  return undefined;
}

export function detectProtocolTags(
  doginal: Doginal,
  mediaType: DoginalMediaType
): { tags: DoginalProtocolTag[]; collectionName?: string; vepe?: VepeMetadata } {
  const tags: DoginalProtocolTag[] = ['doginal'];
  let collectionName: string | undefined;
  let vepe: VepeMetadata | undefined;

  const protocol = doginal.protocol?.toLowerCase() || (doginal.meta?.protocol as string | undefined)?.toLowerCase();
  const contentType = doginal.contentType?.toLowerCase() || '';
  const meta = doginal.meta || {};

  if (protocol === 'dogemap' || contentType.includes('dogemap')) {
    tags.push('dogemap');
  }

  if (protocol === 'dns' || doginal.id.endsWith('.doge') || meta.domain?.endsWith('.doge')) {
    tags.push('dns');
  }

  if (protocol === 'charms' || contentType.includes('charms') || meta.charms?.type === 'token') {
    tags.push('charms-token');
  }

  if (meta.charms?.type === 'nft' || meta.charms?.nft === true) {
    tags.push('charms-nft');
  }

  collectionName =
    meta.collection?.name || meta.collectionName || doginal.collection?.name || doginal.attributes?.collection;
  if (collectionName) {
    tags.push('collection');
  }

  vepe = parseVepeMetadata(doginal);
  if (vepe || mediaType === 'video') {
    tags.push('vepe');
  }

  return { tags, collectionName, vepe };
}

export function buildDoginalViewModel(doginal: Doginal): DoginalViewModel {
  const mediaType = detectMediaType(doginal);
  const { tags, collectionName, vepe } = detectProtocolTags(doginal, mediaType);

  const insights: DoginalInsights = {
    mediaType,
    protocolTags: tags,
    collectionName,
    vepe
  };

  return { doginal, insights };
}
