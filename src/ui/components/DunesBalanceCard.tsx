// Dunes Balance Card wrapper for DunesPreviewCard
import { DuneBalance, TickPriceItem } from '@/shared/types';
import DunesPreviewCard from './DunesPreviewCard';

interface DunesBalanceCardProps {
  tokenBalance: DuneBalance;
  showPrice?: boolean;
  price?: TickPriceItem;
  onClick?: () => void;
}

export default function DunesBalanceCard({
  tokenBalance,
  showPrice = true,
  price,
  onClick
}: DunesBalanceCardProps) {
  return (
    <DunesPreviewCard
      balance={tokenBalance}
      price={showPrice ? price : undefined}
      onClick={onClick}
    />
  );
}


