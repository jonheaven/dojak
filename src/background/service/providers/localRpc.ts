import { AxiosInstance } from 'axios';

import { BitcoinBalance, BitcoinBalanceV2 } from '@/shared/types';

export const isLocalRpcClient = (client: AxiosInstance) => client.defaults.baseURL?.includes('http://');

export const localRpcCall = async (client: AxiosInstance, method: string, params: any[] = []) => {
  const response = await client.post('/', {
    jsonrpc: '2.0',
    id: Math.floor(Math.random() * 100000),
    method,
    params
  });
  return response.data.result;
};

export const localRpcGetBalance = async (client: AxiosInstance, address: string): Promise<BitcoinBalance> => {
  try {
    const balance = await localRpcCall(client, 'getbalance', ['', 0, false, address]);
    return {
      confirmed: balance,
      unconfirmed: 0
    };
  } catch (error) {
    // Fallback to getreceivedbyaddress if getbalance fails
    const received = await localRpcCall(client, 'getreceivedbyaddress', [address]);
    return {
      confirmed: received,
      unconfirmed: 0
    };
  }
};

export const localRpcGetBalanceV2 = async (
  client: AxiosInstance,
  address: string
): Promise<BitcoinBalanceV2> => {
  try {
    const balance = await localRpcCall(client, 'getbalance', ['', 0, false, address]);
    return {
      availableBalance: balance,
      unavailableBalance: 0,
      totalBalance: balance
    };
  } catch (error) {
    // Fallback to getreceivedbyaddress if getbalance fails
    const received = await localRpcCall(client, 'getreceivedbyaddress', [address]);
    return {
      availableBalance: received,
      unavailableBalance: 0,
      totalBalance: received
    };
  }
};

export const localRpcGetUtxo = async (client: AxiosInstance, address: string) => {
  const utxos = await localRpcCall(client, 'listunspent', [0, 9999999, [address]]);
  return utxos.map((utxo: any) => ({
    txid: utxo.txid,
    vout: utxo.vout,
    value: utxo.amount,
    confirmations: utxo.confirmations,
    scriptPubKey: utxo.scriptPubKey,
    inscriptions: [] // Local RPC doesn't have inscription data
  }));
};

export const localRpcGetAddressInscriptions = async (client: AxiosInstance, address: string) => {
  // Local RPC doesn't have inscription data, return empty
  return { list: [] };
};

export const localRpcPushTx = async (client: AxiosInstance, txHex: string) => {
  return await localRpcCall(client, 'sendrawtransaction', [txHex]);
};

export const localRpcGetTransaction = async (client: AxiosInstance, txid: string) => {
  return await localRpcCall(client, 'getrawtransaction', [txid, true]);
};

export const localRpcGetBlockCount = async (client: AxiosInstance) => {
  return await localRpcCall(client, 'getblockcount', []);
};

export const localRpcEstimateFee = async (client: AxiosInstance, blocks: number = 6) => {
  return await localRpcCall(client, 'estimatefee', [blocks]);
};
