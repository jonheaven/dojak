import { BiometricAdapter, BiometricAuthResult, BiometricAvailability, BiometricMethod } from '../../types';

function mapNativeTypeToMethod(type: number): BiometricMethod {
  // Expo LocalAuthentication enums vary by platform version; keep this resilient.
  if (type === 1) return 'touch-id';
  if (type === 2) return 'face-id';
  return 'android-biometric';
}

export class ExpoLocalAuthAdapter implements BiometricAdapter {
  getMethod() {
    return 'unknown' as const;
  }

  async isBiometricAvailable(): Promise<BiometricAvailability> {
    try {
      const LocalAuthentication = await import('expo-local-authentication');
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) return { available: false, method: 'unknown', reason: 'No biometric hardware' };

      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) return { available: false, method: 'unknown', reason: 'No biometric enrollment found' };

      const supported = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const method = mapNativeTypeToMethod(supported[0] ?? 0);
      return { available: true, method };
    } catch (error) {
      return {
        available: false,
        method: 'unknown',
        reason: error instanceof Error ? error.message : 'Unable to query biometric availability'
      };
    }
  }

  async authenticateWithBiometric(reason = 'Authenticate to unlock wallet'): Promise<BiometricAuthResult> {
    const availability = await this.isBiometricAvailable();
    if (!availability.available) {
      return { ok: false, method: availability.method, errorCode: 'biometric/not-available', errorMessage: availability.reason };
    }

    try {
      const LocalAuthentication = await import('expo-local-authentication');
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        cancelLabel: 'Use password',
        disableDeviceFallback: false
      });
      return {
        ok: result.success,
        method: availability.method,
        errorCode: result.success ? undefined : 'biometric/auth-failed',
        errorMessage: result.success ? undefined : result.error ?? 'Biometric authentication failed'
      };
    } catch (error) {
      return {
        ok: false,
        method: availability.method,
        errorCode: 'biometric/auth-failed',
        errorMessage: error instanceof Error ? error.message : 'Biometric authentication failed'
      };
    }
  }
}
