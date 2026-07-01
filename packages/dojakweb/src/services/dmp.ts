import type {
  DmpIntentParams,
  DmpIntentType,
  SignedDmpIntent,
} from '../types/wallet';

export const DMP_PROTOCOL = 'DMP';
export const DMP_VERSION = '1.0';

const ALLOWED_SIGNING_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  'dogex.store',
  'www.dogex.store',
  'dogecoin.games',
  'www.dogecoin.games',
  'dogenals.org',
  'www.dogenals.org',
]);
const ALLOWED_SIGNING_HOSTNAME_SUFFIXES = ['.dogeco.sh', '.jonheaven.com'];
const warnedUnexpectedSigningHostnames = new Set<string>();

type SignMessageFn = (message: string) => Promise<string>;

type DmpSigningParams<T extends DmpIntentType> = DmpIntentParams<T> & {
  activeAddress: string;
  signMessage: SignMessageFn;
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const nextValue = (value as Record<string, unknown>)[key];
      if (nextValue !== undefined) {
        output[key] = canonicalize(nextValue);
      }
    }
    return output;
  }
  return value;
}

function validateAddress(address: string): string {
  const normalized = address.trim();
  if (normalized.length < 24 || normalized.length > 128) {
    throw new Error('ÐMP address must be between 24 and 128 characters');
  }
  if (/[^\S\r\n]/.test(normalized)) {
    throw new Error('ÐMP address cannot contain whitespace');
  }
  return normalized;
}

function validateInscriptionId(value: string, field: 'listing_id' | 'bid_id'): string {
  const normalized = value.trim();
  if (normalized.length < 64 || normalized.length > 128 || /\s/.test(normalized)) {
    throw new Error(`ÐMP ${field} must be a valid inscription id`);
  }
  return normalized;
}

function validatePositiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`ÐMP ${field} must be a positive integer`);
  }
  return value;
}

function validateCid(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 7 || normalized.length > 256) {
    throw new Error('ÐMP psbt_cid must be between 7 and 256 characters');
  }
  if (!normalized.startsWith('ipfs://') && !normalized.startsWith('ar://')) {
    throw new Error('ÐMP psbt_cid must start with ipfs:// or ar://');
  }
  return normalized;
}

function resolveAddress(requestedAddress: string | undefined, activeAddress: string): string {
  const normalizedActiveAddress = validateAddress(activeAddress);
  if (!requestedAddress) {
    return normalizedActiveAddress;
  }
  const normalizedRequestedAddress = validateAddress(requestedAddress);
  if (normalizedRequestedAddress !== normalizedActiveAddress) {
    throw new Error('ÐMP address does not match the active wallet');
  }
  return normalizedRequestedAddress;
}

function generateNonce(): number {
  return Date.now();
}

function decodeBase64(value: string): Uint8Array | null {
  try {
    if (typeof atob === 'function') {
      const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      const decoded = atob(padded);
      return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
    }
  } catch {
    return null;
  }

  try {
    const bufferCtor = (globalThis as {
      Buffer?: { from(input: string, encoding: string): Uint8Array };
    }).Buffer;
    if (bufferCtor) {
      return new Uint8Array(bufferCtor.from(value, 'base64'));
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeSignatureToHex(signature: string): string {
  const normalized = signature.trim();
  if (!normalized) {
    throw new Error('ÐMP signature cannot be empty');
  }
  if (/^[0-9a-f]+$/i.test(normalized)) {
    return normalized.toLowerCase();
  }
  const decoded = decodeBase64(normalized);
  if (decoded && decoded.length > 0) {
    return bytesToHex(decoded);
  }
  return bytesToHex(new TextEncoder().encode(normalized));
}

function isAllowedSigningHostname(hostname: string): boolean {
  return (
    ALLOWED_SIGNING_HOSTNAMES.has(hostname) ||
    ALLOWED_SIGNING_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  );
}

export function warnIfUnexpectedSigningHostname(signingFlow: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const hostname = window.location.hostname.toLowerCase();
  if (!hostname || isAllowedSigningHostname(hostname)) {
    return;
  }

  if (warnedUnexpectedSigningHostnames.has(hostname)) {
    return;
  }

  warnedUnexpectedSigningHostnames.add(hostname);
  console.warn(
    `[DOJAKWEB] ${signingFlow} requested from unexpected hostname "${hostname}". Verify the site origin before approving wallet signatures.`
  );
}

function buildUnsignedIntent<T extends DmpIntentType>(
  intentType: T,
  params: DmpSigningParams<T>
): Omit<SignedDmpIntent<T>, 'signature'> {
  const seller = resolveAddress(params.address, params.activeAddress);
  const nonce = validatePositiveInteger(params.nonce ?? generateNonce(), 'nonce');

  switch (intentType) {
    case 'listing': {
      const listingParams = params as DmpSigningParams<'listing'>;
      return {
        protocol: DMP_PROTOCOL,
        version: DMP_VERSION,
        op: 'listing',
        seller,
        price_koinu: validatePositiveInteger(listingParams.price_koinu, 'price_koinu'),
        psbt_cid: validateCid(listingParams.psbt_cid),
        expiry_height: validatePositiveInteger(listingParams.expiry_height, 'expiry_height'),
        nonce,
      } as unknown as Omit<SignedDmpIntent<T>, 'signature'>;
    }
    case 'bid': {
      const bidParams = params as DmpSigningParams<'bid'>;
      return {
        protocol: DMP_PROTOCOL,
        version: DMP_VERSION,
        op: 'bid',
        seller,
        listing_id: validateInscriptionId(bidParams.listing_id, 'listing_id'),
        price_koinu: validatePositiveInteger(bidParams.price_koinu, 'price_koinu'),
        psbt_cid: validateCid(bidParams.psbt_cid),
        expiry_height: validatePositiveInteger(bidParams.expiry_height, 'expiry_height'),
        nonce,
      } as unknown as Omit<SignedDmpIntent<T>, 'signature'>;
    }
    case 'settle': {
      const settleParams = params as DmpSigningParams<'settle'>;
      return {
        protocol: DMP_PROTOCOL,
        version: DMP_VERSION,
        op: 'settle',
        seller,
        listing_id: validateInscriptionId(settleParams.listing_id, 'listing_id'),
        bid_id: settleParams.bid_id ? validateInscriptionId(settleParams.bid_id, 'bid_id') : undefined,
        psbt_cid: validateCid(settleParams.psbt_cid),
        nonce,
      } as unknown as Omit<SignedDmpIntent<T>, 'signature'>;
    }
    case 'cancel': {
      const cancelParams = params as DmpSigningParams<'cancel'>;
      return {
        protocol: DMP_PROTOCOL,
        version: DMP_VERSION,
        op: 'cancel',
        seller,
        listing_id: validateInscriptionId(cancelParams.listing_id, 'listing_id'),
        nonce,
      } as unknown as Omit<SignedDmpIntent<T>, 'signature'>;
    }
    default:
      throw new Error(`Unsupported ÐMP intent type: ${String(intentType)}`);
  }
}

export async function signDMPIntent<T extends DmpIntentType>(
  intentType: T,
  params: DmpSigningParams<T>
): Promise<SignedDmpIntent<T>> {
  const unsignedIntent = buildUnsignedIntent(intentType, params);
  const canonicalJson = JSON.stringify(canonicalize(unsignedIntent));
  warnIfUnexpectedSigningHostname('ÐMP signing');
  const rawSignature = await params.signMessage(canonicalJson);
  return {
    ...unsignedIntent,
    signature: normalizeSignatureToHex(rawSignature),
  } as SignedDmpIntent<T>;
}
