import { BalanceCard } from './BalanceCard';
import { DogeCurrencyIcon } from '@/components/DogeCurrencyIcon';

export function DogecoinL1BalanceCard({ balanceDisplay }: { balanceDisplay: string }) {
  return (
    <BalanceCard
      variant="l1"
      title="Dogecoin L1"
      subtitle="Native DOGE"
      amountDisplay={balanceDisplay}
      icon={<DogeCurrencyIcon size="sm" className="opacity-95" />}
    />
  );
}
