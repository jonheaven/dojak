/**
 * Read-only DogeOS (EVM) helpers via viem.
 * The Dojakweb shell also mounts **wagmi** (`dogeosWagmiConfig`) so hooks like `useBalance` stay aligned with this chain + RPC.
 */
import { createPublicClient, formatEther, http, type Address } from 'viem';
import { dogeosChain, getDogeosRpcUrl } from './dogeos-chain';

export function createDogeosPublicClient() {
  return createPublicClient({
    chain: dogeosChain,
    transport: http(getDogeosRpcUrl()),
  });
}

/** Native balance on DogeOS (wei → ether string). */
export async function fetchDogeosNativeBalance(address: Address): Promise<string> {
  const client = createDogeosPublicClient();
  const wei = await client.getBalance({ address });
  return formatEther(wei);
}
