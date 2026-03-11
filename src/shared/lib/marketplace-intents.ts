import { sha256 } from '@noble/hashes/sha2';

import {
  IntentPayload,
  MarketplaceIntentSummary,
  MarketplaceIntentSummaryOutput,
  MarketplaceIntentType,
  SignedIntent
} from '@/shared/types';

const INTENT_TITLES: Record<MarketplaceIntentType, string> = {
  listing_buy: 'Listing Purchase',
  offer_create: 'Create Offer',
  offer_cancel: 'Cancel Offer',
  bid_place: 'Place Bid',
  bid_cancel: 'Cancel Bid',
  auction_settle: 'Settle Auction'
};

const CHAIN_IDS = {
  mainnet: 'doge-mainnet',
  testnet: 'doge-testnet',
  regtest: 'doge-regtest'
} as const;

const NETWORK_ALIASES: Record<string, IntentPayload['network']> = {
  livenet: 'mainnet',
  mainnet: 'mainnet',
  testnet: 'testnet',
  regtest: 'regtest'
};

export const MARKETPLACE_INTENT_TYPES: MarketplaceIntentType[] = [
  'listing_buy',
  'offer_create',
  'offer_cancel',
  'bid_place',
  'bid_cancel',
  'auction_settle'
];

type PrepareMarketplaceIntentOptions = {
  expectedAddress?: string;
  expectedNetwork?: IntentPayload['network'] | 'livenet';
  now?: number;
};

type PreparedMarketplaceIntent = {
  canonicalPayload: Record<string, unknown>;
  canonicalJson: string;
  payloadHash: string;
  summary: MarketplaceIntentSummary;
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readOutput(value: unknown): MarketplaceIntentSummaryOutput | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const address = readNonEmptyString(value.address);
  if (!address) {
    return undefined;
  }

  return {
    address,
    valueKoinu: readNonEmptyString(value.valueKoinu ?? value.amountKoinu ?? value.koinu),
    role: readNonEmptyString(value.role)
  };
}

export function normalizeMarketplaceNetwork(network: string): IntentPayload['network'] {
  const normalized = NETWORK_ALIASES[String(network || '').toLowerCase()];
  if (!normalized) {
    throw new Error(`Unsupported intent network: ${network}`);
  }
  return normalized;
}

export function canonicalizeMarketplaceValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeMarketplaceValue(item));
  }

  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalizeMarketplaceValue(value[key]);
        return acc;
      }, {});
  }

  return value;
}

export function canonicalizeMarketplaceIntent(payload: IntentPayload): Record<string, unknown> {
  return canonicalizeMarketplaceValue(payload) as Record<string, unknown>;
}

export function stringifyMarketplaceIntent(payload: IntentPayload): string {
  return JSON.stringify(canonicalizeMarketplaceIntent(payload));
}

export function hashMarketplaceIntentPayload(payload: IntentPayload): string {
  const encoded = new TextEncoder().encode(stringifyMarketplaceIntent(payload));
  return bytesToHex(sha256(sha256(encoded)));
}

export function buildMarketplaceIntentSummary(payload: IntentPayload): MarketplaceIntentSummary {
  const outputs = Array.isArray(payload.outputs)
    ? payload.outputs
        .map((value) => readOutput(value))
        .filter((value): value is MarketplaceIntentSummaryOutput => !!value)
    : undefined;

  return {
    title: INTENT_TITLES[payload.intentType],
    intentType: payload.intentType,
    address: payload.address,
    nonce: payload.nonce,
    network: payload.network,
    chainId: payload.chainId,
    expiresAt: payload.expiresAt,
    inscriptionId: readNonEmptyString(payload.inscriptionId),
    listingId: readNonEmptyString(payload.listingId),
    offerId: readNonEmptyString(payload.offerId),
    auctionId: readNonEmptyString(payload.auctionId),
    collectionId: readNonEmptyString(payload.collectionId),
    recipientAddress: readNonEmptyString(
      payload.recipientAddress ?? payload.toAddress ?? payload.sellerAddress ?? payload.targetSellerAddress
    ),
    priceKoinu: readNonEmptyString(
      payload.priceKoinu ??
        payload.askingPriceKoinu ??
        payload.offerPriceKoinu ??
        payload.bidAmountKoinu ??
        payload.startPriceKoinu ??
        payload.reservePriceKoinu
    ),
    marketplaceFeeKoinu: readNonEmptyString(payload.marketplaceFeeKoinu),
    feePolicy: readNonEmptyString(payload.feePolicy),
    outputs: outputs && outputs.length ? outputs : undefined
  };
}

export function prepareMarketplaceIntent(
  payload: IntentPayload,
  options: PrepareMarketplaceIntentOptions = {}
): PreparedMarketplaceIntent {
  if (!isRecord(payload)) {
    throw new Error('Intent payload is required');
  }

  if (!MARKETPLACE_INTENT_TYPES.includes(payload.intentType)) {
    throw new Error(`Unsupported intentType: ${payload.intentType}`);
  }

  const nonce = readNonEmptyString(payload.nonce);
  if (!nonce) {
    throw new Error('Intent nonce is required');
  }

  const address = readNonEmptyString(payload.address);
  if (!address) {
    throw new Error('Intent address is required');
  }

  const normalizedNetwork = normalizeMarketplaceNetwork(payload.network);
  if (payload.network !== normalizedNetwork) {
    throw new Error(`Intent network must be '${normalizedNetwork}'`);
  }

  const expectedChainId = CHAIN_IDS[normalizedNetwork];
  if (payload.chainId !== expectedChainId) {
    throw new Error(`Intent chainId mismatch: expected ${expectedChainId}, got ${payload.chainId}`);
  }

  const expiresAtMs = Date.parse(payload.expiresAt);
  const now = options.now ?? Date.now();
  if (Number.isNaN(expiresAtMs) || expiresAtMs <= now) {
    throw new Error('Intent has expired');
  }

  if (options.expectedNetwork) {
    const expectedNetwork = normalizeMarketplaceNetwork(options.expectedNetwork);
    if (normalizedNetwork !== expectedNetwork) {
      throw new Error(`Intent network mismatch: expected ${expectedNetwork}, got ${normalizedNetwork}`);
    }
  }

  if (options.expectedAddress && address !== options.expectedAddress) {
    throw new Error('Intent address does not match the active wallet');
  }

  const canonicalPayload = canonicalizeMarketplaceIntent(payload);
  const canonicalJson = JSON.stringify(canonicalPayload);
  const payloadHash = bytesToHex(sha256(sha256(new TextEncoder().encode(canonicalJson))));

  return {
    canonicalPayload,
    canonicalJson,
    payloadHash,
    summary: buildMarketplaceIntentSummary(payload)
  };
}

export function createSignedMarketplaceIntent(
  payload: IntentPayload,
  signature: string,
  signingAddress: string,
  options: PrepareMarketplaceIntentOptions = {}
): SignedIntent {
  const prepared = prepareMarketplaceIntent(payload, {
    ...options,
    expectedAddress: signingAddress
  });

  return {
    signature,
    signingAddress,
    signedAt: new Date().toISOString(),
    payloadHash: prepared.payloadHash
  };
}
