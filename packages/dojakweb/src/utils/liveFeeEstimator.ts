// Live Fee Estimator for Dogecoin network fees
// Fetches real-time fee estimates from Dogecoin APIs

export interface FeeEstimate {
  liveFee: number;        // DOGE per transaction
  networkTotal: number;   // Total network fees
  serviceTotal: number;   // Total service fees (0.025 DOGE per wallet)
  grandTotal: number;     // Total cost
  numTxns: number;        // Number of transactions needed
  lastUpdated: Date;      // When fees were last fetched
}

export class LiveFeeEstimator {
  private apiUrl: string;
  private defaultFallback: number;
  private cache: { fees: FeeEstimate | null; timestamp: number } = { fees: null, timestamp: 0 };
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor(apiUrl?: string) {
    // Try multiple Dogecoin API endpoints for reliability
    this.apiUrl = apiUrl || 'https://dogechain.info/api/v1/estimatesmartfee';
    this.defaultFallback = 0.05; // DOGE per transaction fallback
  }

  /**
   * Get current Dogecoin network fee estimate
   * @param targetBlocks - Target confirmation blocks (default: 6)
   * @returns Fee in DOGE per transaction
   */
  async getCurrentFee(targetBlocks: number = 6): Promise<number> {
    try {
      // Check cache first
      const now = Date.now();
      if (this.cache.fees && (now - this.cache.timestamp) < this.CACHE_DURATION) {
        return this.cache.fees.liveFee;
      }

      const response = await fetch(`${this.apiUrl}?blocks=${targetBlocks}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        // Timeout after 10 seconds
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();

      // DogeChain API returns fee in sats/vB
      // Convert to DOGE per transaction (rough estimate: 250 vB per tx)
      const satsPerVB = data.feerate || data.fee || 10; // sats/vB
      const dogePerTx = (satsPerVB * 250) / 100000000; // Convert sats to DOGE

      // Ensure minimum fee (dust protection)
      const liveFee = Math.max(dogePerTx, 0.001);

      console.log(`🐕 Live fee fetched: ${liveFee.toFixed(6)} DOGE/tx (${satsPerVB} sats/vB)`);

      // Update cache
      this.cache = {
        fees: { ...this.cache.fees, liveFee, lastUpdated: new Date() } as FeeEstimate,
        timestamp: now
      };

      return liveFee;

    } catch (error) {
      console.warn('🐕 Fee API woof - using fallback:', error);

      // Try fallback APIs if primary fails
      return this.tryFallbackAPIs(targetBlocks);
    }
  }

  /**
   * Try fallback APIs if primary fails
   */
  private async tryFallbackAPIs(targetBlocks: number): Promise<number> {
    const fallbacks = ['https://api.blockcypher.com/v1/doge/main'];

    for (const url of fallbacks) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(5000)
        });
        const data = await response.json();

        // Parse different API formats
        let fee = this.defaultFallback;

        if (url.includes('blockcypher')) {
          fee = data.high_fee_per_kb ? (data.high_fee_per_kb * 250) / 100000000 : this.defaultFallback;
        }

        console.log(`🐕 Fallback fee (${url}): ${fee.toFixed(6)} DOGE/tx`);
        return fee;

      } catch (e) {
        continue; // Try next fallback
      }
    }

    console.warn('🐕 All APIs failed - using static fallback');
    return this.defaultFallback;
  }

  /**
   * Calculate airdrop costs with live fees
   * @param recipientCount - Number of recipients
   * @param serviceFeePerWallet - Service fee per wallet (default: 0.025 DOGE)
   * @returns Complete fee breakdown
   */
  async calculateAirdropCosts(
    recipientCount: number,
    serviceFeePerWallet: number = 0.025
  ): Promise<FeeEstimate> {
    const liveFee = await this.getCurrentFee();
    const numTxns = Math.ceil(recipientCount / 100); // Batch 100 recipients per tx
    const networkTotal = numTxns * liveFee;
    const serviceTotal = recipientCount * serviceFeePerWallet;
    const grandTotal = networkTotal + serviceTotal;

    const estimate: FeeEstimate = {
      liveFee,
      networkTotal,
      serviceTotal,
      grandTotal,
      numTxns,
      lastUpdated: new Date()
    };

    // Update cache
    this.cache = {
      fees: estimate,
      timestamp: Date.now()
    };

    return estimate;
  }

  /**
   * Get cached fee estimate if available and fresh
   */
  getCachedFees(): FeeEstimate | null {
    if (this.cache.fees && (Date.now() - this.cache.timestamp) < this.CACHE_DURATION) {
      return this.cache.fees;
    }
    return null;
  }

  /**
   * Force refresh of fee cache
   */
  async refreshFees(): Promise<FeeEstimate> {
    this.cache = { fees: null, timestamp: 0 }; // Clear cache
    return this.calculateAirdropCosts(1); // Dummy calculation to refresh
  }

  /**
   * Get fee health status
   */
  getFeeHealth(): 'low' | 'normal' | 'high' | 'unknown' {
    const cached = this.getCachedFees();
    if (!cached) return 'unknown';

    const fee = cached.liveFee;
    if (fee < 0.02) return 'low';
    if (fee < 0.08) return 'normal';
    return 'high';
  }
}

// Export singleton instance
export const feeEstimator = new LiveFeeEstimator();
