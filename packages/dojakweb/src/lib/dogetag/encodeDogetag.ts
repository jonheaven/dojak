// encodeDogetag.ts
// encodeDogetag.ts
// Validates Dogetag message content for a specific inscription mode.

import { INSCRIPTION_MAX_CONTENT_BYTES } from './inscribe';

export function encodeDogetagMessage(message: string): Buffer {
  if (!message.length) throw new Error('Dogetag message cannot be empty');
  const bytes = Buffer.from(message, 'utf8');
  if (bytes.length > INSCRIPTION_MAX_CONTENT_BYTES) {
    throw new Error(
      `Dogetag message too long (${bytes.length} bytes, max ${INSCRIPTION_MAX_CONTENT_BYTES} for a 2-transaction inscription).`,
    );
  }
  return bytes;
}

export function encodeDogetagContentType(): Buffer {
  return Buffer.from('text/plain;charset=utf-8', 'utf8');
}

export function validateDogetagMessage(
  message: string,
  mode: 'op_return' | 'witness' = 'witness',
): { valid: boolean; error?: string } {
  if (!message || !message.trim().length) {
    return { valid: false, error: 'Dogetag message cannot be empty' };
  }
  if (message.includes('\u0000')) {
    return { valid: false, error: 'Dogetag message cannot contain null characters' };
  }

  const bytes = Buffer.from(message, 'utf8');

  if (mode === 'op_return' && bytes.length > 80) {
    return { valid: false, error: 'OP_RETURN message too long (max 80 bytes)' };
  }
  if (mode === 'witness' && bytes.length > INSCRIPTION_MAX_CONTENT_BYTES) {
    return {
      valid: false,
      error: `Dogetag text too long (max ${INSCRIPTION_MAX_CONTENT_BYTES} bytes for a 2-transaction inscription)`,
    };
  }

  return { valid: true };
}

