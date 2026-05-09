/**
 * Wagmi config for **read-only** DogeOS (EVM) RPC via the same chain metadata as `dogeosChain`.
 * Optional connectors are omitted — L1 signing stays in Dojakweb; hosts can still inject EIP-1193 from `createDogeosEip1193Provider`.
 */
import { createConfig, http } from 'wagmi';
import { dogeosChain, getDogeosRpcUrl } from './dogeos-chain';

export const dogeosWagmiConfig = createConfig({
  chains: [dogeosChain],
  transports: {
    [dogeosChain.id]: http(getDogeosRpcUrl()),
  },
});
