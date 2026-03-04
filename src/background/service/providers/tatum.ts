import { AxiosInstance } from 'axios';

import { BitcoinBalance, BitcoinBalanceV2 } from '@/shared/types';

export const isTatumClient = (client: AxiosInstance) => client.defaults.baseURL?.includes('tatum.io');

export const tatumGetAddressBalance = async (client: AxiosInstance, address: string): Promise<BitcoinBalance> => {
  const response = await client.get(`/v3/dogecoin/address/${address}/balance`);
  const balance = response.data?.balance || {};
  return {
    confirmed: (balance.confirmed || 0) / 100000000, // Convert satoshis to DOGE
    unconfirmed: (balance.unconfirmed || 0) / 100000000
  };
};

export const tatumGetAddressBalanceV2 = async (
  client: AxiosInstance,
  address: string
): Promise<BitcoinBalanceV2> => {
  const response = await client.get(`/v3/dogecoin/address/${address}/balance`);
  const balance = response.data?.balance || {};
  const confirmedBalance = (balance.confirmed || 0) / 100000000;
  const unconfirmedBalance = (balance.unconfirmed || 0) / 100000000;
  return {
    availableBalance: confirmedBalance,
    unavailableBalance: unconfirmedBalance,
    totalBalance: confirmedBalance + unconfirmedBalance
  };
};

export const tatumGetAddressUtxo = async (client: AxiosInstance, address: string) => {
  const response = await client.get(`/v3/dogecoin/address/${address}/utxo`);
  const utxos = response.data || [];
  return utxos.map((utxo: any) => ({
    txid: utxo.txid,
    vout: utxo.vout,
    value: utxo.value,
    confirmations: utxo.confirmations || 0,
    scriptPubKey: utxo.scriptPubKey || '',
    inscriptions: [] // Tatum doesn't provide inscription data
  }));
};

export const tatumGetAddressInscriptions = async (client: AxiosInstance, address: string) => {
  // Tatum doesn't provide inscription data for Dogecoin
  return { list: [] };
};

export const tatumGetTransaction = async (client: AxiosInstance, txid: string) => {
  const response = await client.get(`/v3/dogecoin/transaction/${txid}`);
  return response.data;
};





