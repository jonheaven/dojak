import {
  formatEther,
  JsonRpcProvider,
  parseEther,
  type JsonRpcSigner,
  type Signer,
  type TransactionResponse
} from 'ethers';

import { DOGEOS_ACTIVE_CONFIG } from '../constant/dogeos';

export type DogeOsTransaction = {
  txid: string;
  amount: number;
  direction: 'sent' | 'received';
  timestamp?: number;
  to?: string;
  from?: string;
  confirmations?: number;
  status?: 'pending' | 'confirmed' | 'failed';
};

// Mainnet/testnet RPC and chain ID switching is centrally controlled by DOGEOS_ACTIVE_CONFIG.
const DOGEOS_RPC = DOGEOS_ACTIVE_CONFIG.rpcUrl;

export function createDogeOsPublicClient() {
  return new JsonRpcProvider(DOGEOS_RPC, DOGEOS_ACTIVE_CONFIG.chainId);
}

export function createDogeOsWalletClient(signer: Signer | JsonRpcSigner) {
  const provider = createDogeOsPublicClient();
  return signer.provider ? signer.connect(provider) : signer.connect(provider);
}

async function getBlockscoutTransactions(address: string): Promise<DogeOsTransaction[]> {
  try {
    const response = await fetch(`${DOGEOS_ACTIVE_CONFIG.blockExplorerUrl}/api/v2/addresses/${address}/transactions`);
    if (!response.ok) throw new Error(`Explorer transaction lookup failed (${response.status})`);

    const payload = (await response.json()) as {
      items?: Array<{
        hash: string;
        from?: { hash?: string };
        to?: { hash?: string };
        value?: string;
        timestamp?: string;
        status?: 'ok' | 'error';
        confirmations?: number;
      }>;
    };

    return (payload.items ?? []).slice(0, 20).map((item) => {
      const from = item.from?.hash?.toLowerCase();
      const to = item.to?.hash?.toLowerCase();
      const normalized = address.toLowerCase();
      const direction: 'sent' | 'received' = from === normalized ? 'sent' : 'received';

      return {
        txid: item.hash,
        amount: Number(formatEther(item.value ?? '0')),
        direction,
        timestamp: item.timestamp ? new Date(item.timestamp).getTime() : undefined,
        to,
        from,
        confirmations: item.confirmations,
        status: item.status === 'error' ? 'failed' : item.confirmations && item.confirmations > 0 ? 'confirmed' : 'pending'
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown explorer error';
    throw new Error(`DogeOS transactions are temporarily unavailable. Please try again. (${message})`);
  }
}

export async function getDogeOsBalance(address: string) {
  try {
    const provider = createDogeOsPublicClient();
    const balanceWei = await provider.getBalance(address);
    return formatEther(balanceWei);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown RPC error';
    throw new Error(`Unable to fetch DogeOS balance right now. Please retry. (${message})`);
  }
}

export async function getDogeOsTransactions(address: string): Promise<DogeOsTransaction[]> {
  try {
    return await getBlockscoutTransactions(address);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown explorer error';
    throw new Error(`Unable to load DogeOS transaction history. Please retry. (${message})`);
  }
}

export async function sendDogeOsTransaction(
  signer: Signer | JsonRpcSigner,
  request: {
    to: `0x${string}`;
    amount: string;
    data?: `0x${string}`;
  }
): Promise<TransactionResponse> {
  try {
    const wallet = createDogeOsWalletClient(signer);
    const tx: { to: `0x${string}`; value: bigint; data?: `0x${string}` } = {
      to: request.to,
      value: parseEther(request.amount || '0')
    };

    if (request.data) {
      tx.data = request.data;
    }

    return await wallet.sendTransaction(tx);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown signing error';
    throw new Error(`DogeOS transaction failed to submit. Please check details and try again. (${message})`);
  }
}
