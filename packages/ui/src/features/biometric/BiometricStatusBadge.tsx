import React from 'react';

import { Text } from '@dojak/ui/components/Text';

export function BiometricStatusBadge({ enabled, method }: { enabled: boolean; method?: string }) {
  if (!enabled) return <Text text="Biometric unlock disabled" color="textDim" />;
  return <Text text={`Biometric unlock enabled (${method || 'configured'})`} color="success" />;
}
