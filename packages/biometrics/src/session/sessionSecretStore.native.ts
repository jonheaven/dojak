import * as SecureStore from 'expo-secure-store';

import { SessionSecretStore } from '../types';

const KEY = 'dojak.biometric.session-secret';

export function createNativeSessionSecretStore(): SessionSecretStore {
  return {
    async saveSecret(secret: string) {
      await SecureStore.setItemAsync(KEY, secret);
    },
    async getSecret() {
      return SecureStore.getItemAsync(KEY);
    },
    async clearSecret() {
      await SecureStore.deleteItemAsync(KEY);
    }
  };
}
