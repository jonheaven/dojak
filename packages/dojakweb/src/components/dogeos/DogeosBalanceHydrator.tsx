'use client';

import { useEffect } from 'react';
import { useDogeosNativeBalance } from '@/hooks/useDogeosNativeBalance';
import { useWalletStore } from '@/stores/walletStore';

/** Writes react-query DogeOS native balance into walletStore for dashboard cards. */
export function DogeosBalanceHydrator({ enabled }: { enabled: boolean }) {
  const dogeosAddress = useWalletStore((s) => s.dogeosAddress);
  const setDogeosBalance = useWalletStore((s) => s.setDogeosBalance);
  const { data, isError } = useDogeosNativeBalance(dogeosAddress as `0x${string}` | null, enabled && !!dogeosAddress);

  useEffect(() => {
    if (!enabled || !dogeosAddress) {
      setDogeosBalance('');
      return;
    }
    if (isError) {
      setDogeosBalance('—');
      return;
    }
    const formatted = data?.formatted;
    if (formatted !== undefined) {
      const n = Number.parseFloat(formatted);
      setDogeosBalance(
        Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 6 }) : formatted,
      );
    }
  }, [data?.formatted, dogeosAddress, enabled, isError, setDogeosBalance]);

  return null;
}
