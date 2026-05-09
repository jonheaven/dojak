import { BalanceCard } from './BalanceCard';
import { CpuChipIcon } from '@heroicons/react/24/outline';

export function DogeOSBalanceCard({
  balanceDisplay,
  addressShort,
}: {
  balanceDisplay: string;
  addressShort?: string;
}) {
  return (
    <BalanceCard
      variant="dogeos"
      title="DogeOS"
      subtitle={addressShort ? addressShort : 'EVM'}
      amountDisplay={balanceDisplay}
      icon={<CpuChipIcon className="h-5 w-5" aria-hidden />}
    />
  );
}
