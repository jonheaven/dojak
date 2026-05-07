import { BiometricAdapter, BiometricAuthResult, BiometricAvailability } from '../../types';

type UareUSdk = {
  authenticate?: () => Promise<boolean>;
};

export class DigitalPersonaAdapter implements BiometricAdapter {
  private readonly endpoints: string[];

  constructor(endpoints = ['ws://127.0.0.1:9001', 'ws://127.0.0.1:15326']) {
    this.endpoints = endpoints;
  }

  private async canReachAgent() {
    for (const endpoint of this.endpoints) {
      try {
        await new Promise<void>((resolve, reject) => {
          const ws = new WebSocket(endpoint);
          const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Timeout'));
          }, 1500);
          ws.onopen = () => {
            clearTimeout(timeout);
            ws.close();
            resolve();
          };
          ws.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('WebSocket unavailable'));
          };
        });
        return true;
      } catch {
        // Try next endpoint.
      }
    }
    return false;
  }

  getMethod() {
    return 'digitalpersona-uareu' as const;
  }

  async isBiometricAvailable(): Promise<BiometricAvailability> {
    const maybeSdk = (globalThis as any).DigitalPersona as UareUSdk | undefined;
    if (maybeSdk?.authenticate) {
      return { available: true, method: this.getMethod() };
    }

    const agentReachable = await this.canReachAgent();
    if (agentReachable) {
      return { available: true, method: this.getMethod() };
    }
    return {
      available: false,
      method: this.getMethod(),
      reason: 'U.are.U agent unavailable. Install and run DigitalPersona Agent locally.'
    };
  }

  async authenticateWithBiometric(): Promise<BiometricAuthResult> {
    const availability = await this.isBiometricAvailable();
    if (!availability.available) {
      return { ok: false, method: this.getMethod(), errorCode: 'biometric/not-available', errorMessage: availability.reason };
    }

    const maybeSdk = (globalThis as any).DigitalPersona as UareUSdk | undefined;
    if (maybeSdk?.authenticate) {
      try {
        const ok = await maybeSdk.authenticate();
        return { ok, method: this.getMethod(), errorCode: ok ? undefined : 'biometric/auth-failed' };
      } catch (error) {
        return {
          ok: false,
          method: this.getMethod(),
          errorCode: 'biometric/auth-failed',
          errorMessage: error instanceof Error ? error.message : 'Digital Persona auth failed'
        };
      }
    }

    // If SDK is not injected but local agent is reachable, keep this explicit.
    return {
      ok: false,
      method: this.getMethod(),
      errorCode: 'biometric/unsupported',
      errorMessage: 'DigitalPersona Agent is reachable, but SDK bridge is not loaded in extension UI context.'
    };
  }
}
