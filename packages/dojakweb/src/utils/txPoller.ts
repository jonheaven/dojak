// Real-Time Transaction Polling for Dogecoin Network
// Tracks transaction confirmations and provides live updates

export interface TxStatus {
  txId: string;
  confirmations: number;
  status: 'pending' | 'confirming' | 'confirmed' | 'error';
  link: string;
  lastUpdated: Date;
  error?: string;
}

export interface PollingOptions {
  pollInterval?: number;
  maxConfirmations?: number;
  explorerBase?: string;
  onUpdate?: (statuses: TxStatus[]) => void;
  onComplete?: (statuses: TxStatus[]) => void;
  onProgress?: (progress: number) => void;
}

export class TxPoller {
  private txIds: string[];
  private statuses: Map<string, TxStatus> = new Map();
  private pollInterval: number;
  private maxConfirmations: number;
  private explorerBase: string;
  private intervalId: NodeJS.Timeout | null = null;
  private isPolling = false;

  // Callbacks
  private onUpdate?: (statuses: TxStatus[]) => void;
  private onComplete?: (statuses: TxStatus[]) => void;
  private onProgress?: (progress: number) => void;

  constructor(txIds: string | string[], options: PollingOptions = {}) {
    this.txIds = Array.isArray(txIds) ? txIds : [txIds];
    this.pollInterval = options.pollInterval || 10000; // 10 seconds
    this.maxConfirmations = options.maxConfirmations || 6; // Dogecoin standard
    this.explorerBase = options.explorerBase || 'https://dogechain.info/tx/';
    this.onUpdate = options.onUpdate;
    this.onComplete = options.onComplete;
    this.onProgress = options.onProgress;

    this.initializeStatuses();
  }

  private initializeStatuses(): void {
    this.txIds.forEach(txId => {
      const status: TxStatus = {
        txId,
        confirmations: 0,
        status: 'pending',
        link: `${this.explorerBase}${txId}`,
        lastUpdated: new Date()
      };
      this.statuses.set(txId, status);
    });
  }

  /**
   * Poll a single transaction for confirmation status
   */
  private async pollTransaction(txId: string): Promise<void> {
    try {
      const response = await fetch(`https://dogechain.info/api/v1/transaction/${txId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        // Timeout after 5 seconds
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      const confirmations = data.confirmations || 0;

      const currentStatus = this.statuses.get(txId)!;
      const previousConfirmations = currentStatus.confirmations;

      // Update status
      currentStatus.confirmations = confirmations;
      currentStatus.lastUpdated = new Date();

      // Determine status based on confirmations
      if (confirmations >= this.maxConfirmations) {
        currentStatus.status = 'confirmed';
      } else if (confirmations > 0) {
        currentStatus.status = 'confirming';
      } else {
        currentStatus.status = 'pending';
      }

      // Notify about confirmation progress (only for increases)
      if (confirmations > previousConfirmations && confirmations > 0) {
        console.log(`🐕 Tx ${txId.slice(0, 8)}...: ${confirmations}/${this.maxConfirmations} confirmations`);

        // Could trigger browser notification here if permission granted
        // new Notification(`Transaction confirmed! ${confirmations}/${this.maxConfirmations} confs`, {
        //   body: `Tx: ${txId.slice(0, 8)}...`,
        //   icon: '/favicon.svg'
        // });
      }

    } catch (error) {
      console.warn(`🐕 Poll failed for ${txId}:`, error);
      const currentStatus = this.statuses.get(txId)!;
      currentStatus.status = 'error';
      currentStatus.error = error instanceof Error ? error.message : 'Unknown error';
      currentStatus.lastUpdated = new Date();
    }
  }

  /**
   * Start polling all transactions
   */
  public startPolling(): void {
    if (this.isPolling) return;

    this.isPolling = true;
    console.log(`🐕 Starting transaction polling for ${this.txIds.length} transactions`);

    // Initial poll
    this.pollAllTransactions();

    // Set up interval polling
    this.intervalId = setInterval(() => {
      this.pollAllTransactions();
    }, this.pollInterval);
  }

  /**
   * Stop polling
   */
  public stopPolling(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isPolling = false;
    console.log('🐕 Transaction polling stopped');
  }

  /**
   * Poll all transactions and check completion
   */
  private async pollAllTransactions(): Promise<void> {
    // Poll all transactions in parallel
    const pollPromises = this.txIds.map(txId => this.pollTransaction(txId));
    await Promise.allSettled(pollPromises);

    // Get current statuses
    const statuses = Array.from(this.statuses.values());

    // Calculate overall progress
    const confirmedCount = statuses.filter(s => s.status === 'confirmed').length;
    const totalCount = statuses.length;
    const progress = (confirmedCount / totalCount) * 100;

    // Notify progress
    if (this.onProgress) {
      this.onProgress(progress);
    }

    // Notify status update
    if (this.onUpdate) {
      this.onUpdate(statuses);
    }

    // Check if all transactions are confirmed
    const allConfirmed = statuses.every(s => s.status === 'confirmed');

    if (allConfirmed) {
      console.log('🐕 All transactions confirmed! Polling complete.');
      this.stopPolling();

      if (this.onComplete) {
        this.onComplete(statuses);
      }
    }
  }

  /**
   * Get current statuses
   */
  public getStatuses(): TxStatus[] {
    return Array.from(this.statuses.values());
  }

  /**
   * Get overall progress percentage
   */
  public getProgress(): number {
    const statuses = this.getStatuses();
    const confirmedCount = statuses.filter(s => s.status === 'confirmed').length;
    return (confirmedCount / statuses.length) * 100;
  }

  /**
   * Check if polling is active
   */
  public isActive(): boolean {
    return this.isPolling;
  }

  /**
   * Force a manual poll update
   */
  public async forceUpdate(): Promise<void> {
    await this.pollAllTransactions();
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.stopPolling();
    this.statuses.clear();
  }
}

// Export singleton factory function
export function createTxPoller(txIds: string | string[], options?: PollingOptions): TxPoller {
  return new TxPoller(txIds, options);
}
