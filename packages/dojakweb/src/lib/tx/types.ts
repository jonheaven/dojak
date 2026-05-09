/**
 * Shared types for planned Dogecoin transactions (payments + optional OP_RETURN metadata).
 */

export interface DogetagTip {
  /** Recipient Dogecoin address. */
  address: string;
  /** Amount in satoshis (minimum 100_000 = 0.001 DOGE to avoid dust rejection). */
  satoshis: number;
}
