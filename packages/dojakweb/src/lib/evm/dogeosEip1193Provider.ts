/**
 * Minimal EIP-1193 Ethereum provider for **DogeOS only** (same RPC/chain as `dogeosChain`).
 *
 * ## Drop-in wallet module (web dApps)
 * A DogeOS dApp that **embeds this package** (same origin as your app shell) can expose
 * `window.ethereum = createDogeosEip1193Provider({ privateKey, getUserConfirmation })` after the user
 * unlocks, then use **wagmi/ethers** against that provider like any injected wallet — no MetaMask required
 * for users who sign with Dojakweb / future **DojakWeb** flows.
 *
 * ## Browser extension (planned)
 * Cross-origin injection (MetaMask-style) belongs in an MV3 **content script**. The Dojak extension
 * (sibling repo `../dojak` next to this monorepo) is the intended place to wire injection + approvals;
 * this module is the signing primitive you can call from the extension background or in-page bridge.
 *
 * ## Multi-wallet (different seed / imported EVM key)
 * Pass one `privateKey` per provider instance. For multiple identities, use multiple instances or swap
 * the key after encrypted import — do **not** persist raw keys unencrypted.
 */
import {
  createWalletClient,
  http,
  toHex,
  type Address,
  type Chain,
  type Hash,
  type Hex,
  type TransactionSerializable,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { dogeosChain, getDogeosChainId, getDogeosRpcUrl } from '../dogeos-chain';

export type Eip1193RequestArguments = { method: string; params?: readonly unknown[] | unknown };

type Listener = (...args: unknown[]) => void;

function createEmitter() {
  const m = new Map<string, Set<Listener>>();
  return {
    on(event: string, fn: Listener) {
      let s = m.get(event);
      if (!s) {
        s = new Set();
        m.set(event, s);
      }
      s.add(fn);
    },
    removeListener(event: string, fn: Listener) {
      m.get(event)?.delete(fn);
    },
    emit(event: string, ...args: unknown[]) {
      const s = m.get(event);
      if (!s) return;
      for (const fn of s) fn(...args);
    },
  };
}

function rpcReject(code: number, message: string): never {
  const err = new Error(message) as Error & { code: number };
  err.code = code;
  throw err;
}

function parseChainIdHex(hex: string): number | null {
  if (!hex || typeof hex !== 'string') return null;
  const h = hex.startsWith('0x') ? hex : `0x${hex}`;
  const n = Number.parseInt(h, 16);
  return Number.isFinite(n) ? n : null;
}

export interface DogeosEip1193ProviderOptions {
  /** Secp256k1 private key, 32-byte hex with 0x prefix. */
  privateKey: Hex;
  /** Optional override (defaults to `dogeosChain`). */
  chain?: Chain;
  /** Optional RPC (defaults to `getDogeosRpcUrl()`). */
  rpcUrl?: string;
  /**
   * Gate signing / connect — return false to mimic MetaMask “Reject”.
   * Wire this to your own modal / approval queue.
   */
  getUserConfirmation?: (args: Eip1193RequestArguments) => Promise<boolean>;
}

export interface DogeosEip1193Provider {
  /** EIP-1193 */
  request: (args: Eip1193RequestArguments) => Promise<unknown>;
  /** Narrow MetaMask-style surface many dApps probe */
  on: (event: string, fn: Listener) => void;
  removeListener: (event: string, fn: Listener) => void;
  /** Marker for dApp detection (prefer feature-detect over spoofing `isMetaMask`) */
  isDojakweb: true;
  chainId: Hex;
}

/**
 * Build an EIP-1193 provider for DogeOS. Safe to expose as `window.ethereum` **only on origins you control**
 * (or from an extension content script).
 */
export function createDogeosEip1193Provider(opts: DogeosEip1193ProviderOptions): DogeosEip1193Provider {
  const chain = opts.chain ?? dogeosChain;
  const rpc = opts.rpcUrl ?? getDogeosRpcUrl();
  const account = privateKeyToAccount(opts.privateKey);
  const client = createWalletClient({
    account,
    chain,
    transport: http(rpc),
  });

  const emitter = createEmitter();
  const targetChainId = chain.id;
  const chainIdHex = toHex(targetChainId) as Hex;

  const confirm = opts.getUserConfirmation ?? (async () => true);

  async function request(args: Eip1193RequestArguments): Promise<unknown> {
    const { method } = args;
    const params = (args.params as unknown[] | undefined) ?? [];

    switch (method) {
      case 'eth_chainId':
        return chainIdHex;
      case 'net_version':
        return String(targetChainId);
      case 'eth_accounts':
        return [account.address];
      case 'eth_requestAccounts': {
        if (!(await confirm(args))) rpcReject(4001, 'User rejected the request.');
        emitter.emit('connect', { chainId: chainIdHex });
        return [account.address];
      }
      case 'personal_sign': {
        if (!(await confirm(args))) rpcReject(4001, 'User rejected the request.');
        const [data, address] = params as [Hex | string, Address];
        if (String(address).toLowerCase() !== account.address.toLowerCase()) {
          rpcReject(4001, 'personal_sign: address does not match active account');
        }
        const message =
          typeof data === 'string' && data.startsWith('0x')
            ? ({ raw: data as Hex } as const)
            : (data as string);
        return client.signMessage({ message });
      }
      case 'eth_signTypedData_v4':
      case 'eth_signTypedData': {
        if (!(await confirm(args))) rpcReject(4001, 'User rejected the request.');
        const [addr, typed] = params as [Address, string];
        if (String(addr).toLowerCase() !== account.address.toLowerCase()) {
          rpcReject(4001, 'signTypedData: address does not match active account');
        }
        const parsed = JSON.parse(typed) as {
          domain: Record<string, unknown>;
          types: Record<string, unknown>;
          primaryType: string;
          message: Record<string, unknown>;
        };
        return client.signTypedData({
          domain: parsed.domain as any,
          types: parsed.types as any,
          primaryType: parsed.primaryType,
          message: parsed.message as any,
        });
      }
      case 'eth_sendTransaction': {
        if (!(await confirm(args))) rpcReject(4001, 'User rejected the request.');
        const [tx] = params as [TransactionSerializable];
        const hash: Hash = await client.sendTransaction({
          ...tx,
          account,
          chain,
        } as Parameters<typeof client.sendTransaction>[0]);
        return hash;
      }
      case 'wallet_switchEthereumChain': {
        const [{ chainId }] = params as [{ chainId: string }];
        const want = parseChainIdHex(chainId);
        if (want !== targetChainId) rpcReject(4902, 'Unrecognized chain ID.');
        emitter.emit('chainChanged', chainIdHex);
        return null;
      }
      case 'wallet_addEthereumChain': {
        const [add] = params as [{ chainId: string }];
        const want = parseChainIdHex(add.chainId);
        if (want !== targetChainId) rpcReject(-32602, 'This provider only supports the configured DogeOS chain.');
        return null;
      }
      default:
        rpcReject(4200, `Unsupported method: ${method}`);
    }
  }

  return {
    request,
    on: (e, fn) => emitter.on(e, fn),
    removeListener: (e, fn) => emitter.removeListener(e, fn),
    isDojakweb: true as const,
    chainId: chainIdHex,
  };
}

/** Hex chain id for the configured DogeOS network (for dApp comparisons). */
export function getDogeosChainIdHex(): Hex {
  return toHex(getDogeosChainId()) as Hex;
}
