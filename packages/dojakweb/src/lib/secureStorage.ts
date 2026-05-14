const CURRENT_SECURE_STORAGE_VERSION = 2;
// New envelopes use a stronger PBKDF2 work factor to slow offline password guessing while
// remaining responsive in modern browsers during normal wallet unlock flows.
const CURRENT_PBKDF2_ITERATIONS = 310_000;
// Legacy payloads were derived with 100,000 PBKDF2 rounds. We preserve that exact count so
// existing wallets can still be decrypted and migrated without any data loss on first unlock.
const LEGACY_PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

export interface SecureStorageEnvelope {
  version: 2;
  kdf: 'PBKDF2';
  hash: 'SHA-256';
  cipher: 'AES-GCM';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export interface SecureStorageDecryptResult<T> {
  value: T;
  migrated: boolean;
  version: number;
}

function requireSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API is unavailable in this environment');
  }
  return subtle;
}

function isCryptoAvailable(): boolean {
  return !!globalThis.crypto?.subtle;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function isSecureStorageEnvelope(value: unknown): value is SecureStorageEnvelope {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SecureStorageEnvelope>;
  return (
    candidate.version === CURRENT_SECURE_STORAGE_VERSION &&
    candidate.kdf === 'PBKDF2' &&
    candidate.hash === 'SHA-256' &&
    candidate.cipher === 'AES-GCM' &&
    typeof candidate.iterations === 'number' &&
    typeof candidate.salt === 'string' &&
    typeof candidate.iv === 'string' &&
    typeof candidate.ciphertext === 'string'
  );
}

async function deriveAesKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
  usages: KeyUsage[]
): Promise<CryptoKey> {
  const subtle = requireSubtleCrypto();
  const encoder = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: asBufferSource(salt),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    usages
  );
}

function asBufferSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

export type SecureEncryptOptions = {
  /** PBKDF2 iteration count; defaults to `CURRENT_PBKDF2_ITERATIONS`. */
  pbkdf2Iterations?: number;
};

export function pbkdf2IterationsForSecretStrength(strength: 'standard' | 'high' | 'maximum'): number {
  switch (strength) {
    case 'high':
      return 500_000;
    case 'maximum':
      return 750_000;
    default:
      return CURRENT_PBKDF2_ITERATIONS;
  }
}

async function encryptBytes(
  bytes: Uint8Array,
  password: string,
  options?: SecureEncryptOptions
): Promise<SecureStorageEnvelope> {
  const subtle = requireSubtleCrypto();
  const iterations = options?.pbkdf2Iterations ?? CURRENT_PBKDF2_ITERATIONS;
  if (!Number.isFinite(iterations) || iterations < 50_000 || iterations > 2_000_000) {
    throw new Error('Invalid PBKDF2 iteration count');
  }
  // `crypto.getRandomValues` uses the browser's CSPRNG so each wallet gets a unique salt.
  // That prevents identical passwords from deriving identical AES keys across stored wallets.
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  // AES-GCM also requires a fresh IV per encryption so nonce reuse cannot undermine integrity.
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveAesKey(password, salt, iterations, ['encrypt']);
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv: asBufferSource(iv) },
    key,
    asBufferSource(bytes),
  );

  return {
    version: CURRENT_SECURE_STORAGE_VERSION,
    kdf: 'PBKDF2',
    hash: 'SHA-256',
    cipher: 'AES-GCM',
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

async function decryptEnvelopeBytes(
  envelope: SecureStorageEnvelope,
  password: string
): Promise<Uint8Array> {
  const subtle = requireSubtleCrypto();
  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  const key = await deriveAesKey(password, salt, envelope.iterations, ['decrypt']);
  const plaintext = await subtle.decrypt(
    { name: 'AES-GCM', iv: asBufferSource(iv) },
    key,
    asBufferSource(ciphertext),
  );
  return new Uint8Array(plaintext);
}

async function decryptLegacyCombinedBytes(payload: string, password: string): Promise<Uint8Array> {
  const subtle = requireSubtleCrypto();
  const combined = base64ToBytes(payload);
  if (combined.length <= SALT_LENGTH + IV_LENGTH) {
    throw new Error('Legacy encrypted payload is malformed');
  }

  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);
  const key = await deriveAesKey(password, salt, LEGACY_PBKDF2_ITERATIONS, ['decrypt']);
  const plaintext = await subtle.decrypt(
    { name: 'AES-GCM', iv: asBufferSource(iv) },
    key,
    asBufferSource(ciphertext),
  );
  return new Uint8Array(plaintext);
}

export async function encryptText(
  plaintext: string,
  password: string,
  options?: SecureEncryptOptions
): Promise<string> {
  const envelope = await encryptBytes(new TextEncoder().encode(plaintext), password, options);
  return JSON.stringify(envelope);
}

export async function decryptText(
  payload: string,
  password: string
): Promise<SecureStorageDecryptResult<string>> {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (isSecureStorageEnvelope(parsed)) {
      const plaintext = await decryptEnvelopeBytes(parsed, password);
      return {
        value: new TextDecoder().decode(plaintext),
        migrated: false,
        version: parsed.version,
      };
    }
  } catch {
    // Fall back to the legacy combined payload format.
  }

  const plaintext = await decryptLegacyCombinedBytes(payload, password);
  return {
    value: new TextDecoder().decode(plaintext),
    migrated: true,
    version: 1,
  };
}

export async function encryptJSON<T>(
  value: T,
  password: string,
  options?: SecureEncryptOptions
): Promise<string> {
  return encryptText(JSON.stringify(value), password, options);
}

export async function decryptJSON<T>(
  payload: string,
  password: string
): Promise<SecureStorageDecryptResult<T>> {
  const decrypted = await decryptText(payload, password);
  return {
    ...decrypted,
    value: JSON.parse(decrypted.value) as T,
  };
}

export function looksLikeSecureStorageEnvelope(payload: string): boolean {
  try {
    return isSecureStorageEnvelope(JSON.parse(payload));
  } catch {
    return false;
  }
}
