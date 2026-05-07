import React from 'react';

import { Button } from '@dojak/ui/components/Button';

export function BiometricUnlockButton({
  loading,
  onClick,
  text = 'Unlock with biometrics'
}: {
  loading?: boolean;
  onClick: () => void;
  text?: string;
}) {
  return <Button disabled={loading} text={loading ? 'Checking...' : text} preset="default" onClick={onClick} />;
}
