export class BiometricError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export const BIOMETRIC_ERROR_CODES = {
  NOT_AVAILABLE: 'biometric/not-available',
  NOT_ENROLLED: 'biometric/not-enrolled',
  AUTH_CANCELLED: 'biometric/auth-cancelled',
  AUTH_FAILED: 'biometric/auth-failed',
  RATE_LIMITED: 'biometric/rate-limited',
  SECRET_MISSING: 'biometric/secret-missing',
  UNSUPPORTED: 'biometric/unsupported'
} as const;
