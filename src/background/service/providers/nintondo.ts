import type { AxiosInstance } from 'axios';

// Helper to detect if a client is pointing at the main Nintondo Dogecoin API
export const isNintondoMainClient = (client: AxiosInstance): boolean =>
  !!client.defaults.baseURL && client.defaults.baseURL.includes('doge-mainnet-api.nintondo.io');

export const isNintondoTokensClient = (client: AxiosInstance): boolean =>
  !!client.defaults.baseURL && client.defaults.baseURL.includes('doge-mainnet-tokens.nintondo.io');

export const isNintondoSearchClient = (client: AxiosInstance): boolean =>
  !!client.defaults.baseURL && client.defaults.baseURL.includes('doge-mainnet-search.nintondo.io');

// ---- Balance helpers ----

export const nintondoGetAddressBalance = async (client: AxiosInstance, address: string) => {
  const res = await client.get(`/address/${address}/stats`);
  const balance = (res.data?.balance || 0) / 100000000;
  return {
    confirmed: balance,
    unconfirmed: 0
  };
};

export const nintondoGetAddressBalanceV2 = async (client: AxiosInstance, address: string) => {
  const res = await client.get(`/address/${address}/stats`);
  const confirmedBalance = (res.data?.balance || 0) / 100000000;
  return {
    availableBalance: confirmedBalance,
    unavailableBalance: 0,
    totalBalance: confirmedBalance
  };
};


