import React from 'react';

import { Column } from '@dojak/ui/components';
import { Button } from '@dojak/ui/components/Button';
import { Text } from '@dojak/ui/components/Text';

export function BiometricSetupPrompt({
  onEnable,
  onSkip
}: {
  onEnable: () => void;
  onSkip: () => void;
}) {
  return (
    <Column gap="md">
      <Text text="Enable biometric unlock?" preset="sub-title" />
      <Text text="This is convenience unlock only. Your password and seed phrase remain the fallback and recovery path." />
      <Button preset="primary" text="Enable biometrics" onClick={onEnable} />
      <Button preset="default" text="Skip for now" onClick={onSkip} />
    </Column>
  );
}
