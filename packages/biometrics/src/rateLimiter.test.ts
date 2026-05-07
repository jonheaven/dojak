import { BiometricRateLimiter } from './rateLimiter';

describe('BiometricRateLimiter', () => {
  it('locks after max failures', () => {
    const limiter = new BiometricRateLimiter(2, 10_000);
    limiter.recordFailure('touch-id');
    expect(limiter.isLocked('touch-id')).toBe(false);
    limiter.recordFailure('touch-id');
    expect(limiter.isLocked('touch-id')).toBe(true);
  });

  it('resets after success', () => {
    const limiter = new BiometricRateLimiter(2, 10_000);
    limiter.recordFailure('touch-id');
    limiter.recordSuccess('touch-id');
    expect(limiter.isLocked('touch-id')).toBe(false);
  });

  it('tracks lock state per method key', () => {
    const limiter = new BiometricRateLimiter(1, 10_000);
    limiter.recordFailure('touch-id');
    expect(limiter.isLocked('touch-id')).toBe(true);
    expect(limiter.isLocked('face-id')).toBe(false);
  });
});
