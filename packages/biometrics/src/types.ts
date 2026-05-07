export type BiometricMethod =
  | 'windows-hello'
  | 'touch-id'
  | 'face-id'
  | 'android-biometric'
  | 'webauthn-platform'
  | 'digitalpersona-uareu'
  | 'unknown';

export type BiometricAuthResult = {
  ok: boolean;
  method: BiometricMethod;
  errorCode?: string;
  errorMessage?: string;
};

export type BiometricAvailability = {
  available: boolean;
  method: BiometricMethod;
  reason?: string;
};

export interface BiometricAdapter {
  getMethod(): BiometricMethod;
  isBiometricAvailable(): Promise<BiometricAvailability>;
  authenticateWithBiometric(reason?: string): Promise<BiometricAuthResult>;
}

export interface SessionSecretStore {
  saveSecret(secret: string): Promise<void>;
  getSecret(): Promise<string | null>;
  clearSecret(): Promise<void>;
}

export interface BiometricFacade {
  isBiometricAvailable(): Promise<BiometricAvailability>;
  authenticateWithBiometric(reason?: string): Promise<BiometricAuthResult>;
  unlockWalletWithBiometric(
    unlockWithSecret: (secret: string) => Promise<void>,
    reason?: string
  ): Promise<BiometricAuthResult>;
}
