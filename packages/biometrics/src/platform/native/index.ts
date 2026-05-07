import { BiometricAdapter } from '../../types';
import { ExpoLocalAuthAdapter } from './expoLocalAuthAdapter';

export function createNativeAdapters(): BiometricAdapter[] {
  return [new ExpoLocalAuthAdapter()];
}

export { ExpoLocalAuthAdapter };
