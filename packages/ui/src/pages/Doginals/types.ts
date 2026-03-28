export interface Doginal {
  id: string;
  inscriptionId: string;
  content: string;
  contentType: string;
  timestamp: number;
  block: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  rarityScore: number;
  protocol?: string;
  collection?: {
    id?: string;
    name?: string;
    slug?: string;
  };
  meta?: Record<string, any>;
  attributes?: {
    background?: string;
    body?: string;
    eyes?: string;
    mouth?: string;
    hat?: string;
    accessories?: string[];
    // Some indexers encode collection name inside attributes
    collection?: string;
  };
  owner: string;
  price?: number;
  listed?: boolean;
  collection?: string;
  mediaType?: string;
  contentLength?: number;
  genesisTx?: string;
  output?: string;
  offset?: number;
}

export type DoginalProtocolTag =
  | 'doginal'
  | 'dogemap'
  | 'dns'
  | 'charms-token'
  | 'charms-nft'
  | 'collection'
  | 'vepe'
  | 'unknown';

export type DoginalMediaType = 'image' | 'video' | 'audio' | 'html' | 'text' | 'model' | 'unknown';

export interface VepeMetadata {
  caption?: string;
  hashtags?: string[];
  location?: string;
  videoInscriptionId?: string;
  createdAt?: string;
}

export interface DoginalInsights {
  mediaType: DoginalMediaType;
  protocolTags: DoginalProtocolTag[];
  collectionName?: string;
  vepe?: VepeMetadata;
}

export interface DoginalViewModel {
  doginal: Doginal;
  insights: DoginalInsights;
  pairedVideo?: Doginal;
}

export interface CreateDoginalParams {
  content: string;
  feeRate: number;
  attributes?: Doginal['attributes'];
}

export interface DNSDomain {
  name: string;
  address: string;
  avatar?: string;
  timestamp: number;
  block: number;
  inscriptionId?: string;
}

export interface DNSResolution {
  name: string;
  address: string;
  avatar?: string;
  config?: any;
}
