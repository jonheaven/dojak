import { Doginal, DoginalInsights, DoginalMediaType, DoginalProtocolTag, DoginalViewModel, VepeMetadata } from '../types';

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

export function detectMediaType(pepinal: Doginal): DoginalMediaType {
  const contentType = pepinal.contentType?.toLowerCase() || '';

  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType.includes('html')) return 'html';
  if (contentType.includes('model')) return 'model';
  if (isJsonLike(contentType) || isTextLike(contentType)) return 'text';
  return 'unknown';
}

export function parseVepeMetadata(pepinal: Doginal): VepeMetadata | undefined {
  const vepeMeta = pepinal.meta?.vepe as VepeMetadata | undefined;
  if (vepeMeta) {
    return {
      ...vepeMeta,
      hashtags: normalizeHashtags(vepeMeta.hashtags)
    };
  }

  if (isJsonLike(pepinal.contentType) || isTextLike(pepinal.contentType)) {
    try {
      const parsed = JSON.parse(pepinal.content);
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
        pepinal.content
          ?.split(/\s+/)
          .filter((token) => token.startsWith('#'))
          .join(' ')
      );

      if (hashtags.length > 0) {
        return {
          caption: pepinal.content,
          hashtags
        };
      }
    }
  }

  return undefined;
}

export function detectProtocolTags(pepinal: Doginal, mediaType: DoginalMediaType): { tags: DoginalProtocolTag[]; collectionName?: string; vepe?: VepeMetadata } {
  const tags: DoginalProtocolTag[] = ['pepinal'];
  let collectionName: string | undefined;
  let vepe: VepeMetadata | undefined;

  const protocol = pepinal.protocol?.toLowerCase() || (pepinal.meta?.protocol as string | undefined)?.toLowerCase();
  const contentType = pepinal.contentType?.toLowerCase() || '';
  const meta = pepinal.meta || {};

  if (protocol === 'pepemap' || contentType.includes('pepemap')) {
    tags.push('pepemap');
  }

  if (protocol === 'dns' || pepinal.id.endsWith('.pepe') || meta.domain?.endsWith('.pepe')) {
    tags.push('dns');
  }

  if (protocol === 'charms' || contentType.includes('charms') || meta.charms?.type === 'token') {
    tags.push('charms-token');
  }

  if (meta.charms?.type === 'nft' || meta.charms?.nft === true) {
    tags.push('charms-nft');
  }

  collectionName = meta.collection?.name || meta.collectionName || pepinal.collection?.name || pepinal.attributes?.collection;
  if (collectionName) {
    tags.push('collection');
  }

  vepe = parseVepeMetadata(pepinal);
  if (vepe || mediaType === 'video') {
    tags.push('vepe');
  }

  return { tags, collectionName, vepe };
}

export function buildDoginalViewModel(pepinal: Doginal): DoginalViewModel {
  const mediaType = detectMediaType(pepinal);
  const { tags, collectionName, vepe } = detectProtocolTags(pepinal, mediaType);

  const insights: DoginalInsights = {
    mediaType,
    protocolTags: tags,
    collectionName,
    vepe
  };

  return { pepinal, insights };
}

export function mergeVepePairs(doginals: DoginalViewModel[]): DoginalViewModel[] {
  const videos = new Map<string, DoginalViewModel>();
  const result: DoginalViewModel[] = [];

  doginals.forEach((item) => {
    if (item.insights.mediaType === 'video') {
      videos.set(item.pepinal.inscriptionId, item);
    }
  });

  doginals.forEach((item) => {
    const vepeVideoId = item.insights.vepe?.videoInscriptionId;
    if (vepeVideoId && videos.has(vepeVideoId)) {
      const video = videos.get(vepeVideoId)!;
      result.push({ ...video, insights: { ...video.insights, vepe: item.insights.vepe, protocolTags: Array.from(new Set([...video.insights.protocolTags, 'vepe'])) }, pairedVideo: video.pepinal });
    } else if (item.insights.mediaType !== 'video') {
      result.push(item);
    } else if (!videos.has(item.pepinal.inscriptionId)) {
      result.push(item);
    }
  });

  return result;
}
