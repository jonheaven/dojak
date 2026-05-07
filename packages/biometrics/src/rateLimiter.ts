type AttemptState = {
  failures: number;
  lockedUntil: number;
};

export class BiometricRateLimiter {
  private readonly maxFailures: number;
  private readonly lockMs: number;
  private readonly stateByKey = new Map<string, AttemptState>();

  constructor(maxFailures = 5, lockMs = 30_000) {
    this.maxFailures = maxFailures;
    this.lockMs = lockMs;
  }

  private getState(key: string) {
    const existing = this.stateByKey.get(key);
    if (existing) return existing;
    const initial: AttemptState = { failures: 0, lockedUntil: 0 };
    this.stateByKey.set(key, initial);
    return initial;
  }

  isLocked(key = 'global') {
    const state = this.getState(key);
    const now = Date.now();
    return state.lockedUntil > now;
  }

  recordSuccess(key = 'global') {
    const state = this.getState(key);
    state.failures = 0;
    state.lockedUntil = 0;
  }

  recordFailure(key = 'global') {
    const state = this.getState(key);
    state.failures += 1;
    if (state.failures >= this.maxFailures) {
      state.lockedUntil = Date.now() + this.lockMs;
      state.failures = 0;
    }
  }

  getRemainingLockMs(key = 'global') {
    const state = this.getState(key);
    return Math.max(0, state.lockedUntil - Date.now());
  }
}
