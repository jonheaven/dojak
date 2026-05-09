import axios from 'axios';

export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY';

export interface PriceData {
  doge: number;
  [key: string]: number;
}

// Fetch DOGE price from Aster Dex API (referencing dogex.store implementation)
export async function fetchDogePrice(): Promise<PriceData> {
  try {
    // Assuming Aster Dex API endpoint - adjust based on actual API
    const response = await axios.get('https://api.asterdex.com/v1/ticker/doge');
    const data = response.data;

    // Assuming response format like { usd: 0.12, eur: 0.11, etc. }
    return {
      doge: 1, // Base
      usd: data.usd || 0.12, // Fallback
      eur: data.eur || 0.11,
      gbp: data.gbp || 0.095,
      jpy: data.jpy || 15.5,
    };
  } catch (error) {
    console.error('Failed to fetch DOGE price:', error);
    // Fallback prices
    return {
      doge: 1,
      usd: 0.12,
      eur: 0.11,
      gbp: 0.095,
      jpy: 15.5,
    };
  }
}

// Convert DOGE amount to fiat currency
export function convertDogeToFiat(dogeAmount: number, priceData: PriceData, currency: Currency): number {
  const rate = priceData[currency.toLowerCase()] || priceData.usd;
  return dogeAmount * rate;
}

// Format currency display
export function formatCurrency(amount: number, currency: Currency): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  });
  return formatter.format(amount);
}

// Get default currency if not set
export function getDefaultCurrency(): Currency {
  return 'USD';
}