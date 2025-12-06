import type { AxiosInstance } from 'axios';

// Helper to detect if a client is pointing at the MyDoge API
export const isMyDogeClient = (client: AxiosInstance): boolean =>
  !!client.defaults.baseURL && client.defaults.baseURL.includes('api.mydoge.com');

// ---- Balance helpers ----

export const myDogeGetAddressBalance = async (client: AxiosInstance, address: string) => {
  const encodedRoute = encodeURIComponent(`/address/${address}?page=1&pageSize=10`);
  const res = await client.get(`/wallet/info?route=${encodedRoute}`);
  const balanceSatoshis = res.data?.balance || 0;

  return {
    confirmed: balanceSatoshis / 100000000,
    unconfirmed: 0
  };
};

export const myDogeGetAddressBalanceV2 = async (client: AxiosInstance, address: string) => {
  const encodedRoute = encodeURIComponent(`/address/${address}?page=1&pageSize=10`);
  const res = await client.get(`/wallet/info?route=${encodedRoute}`);
  const balanceSatoshis = res.data?.balance || 0;
  const confirmedBalance = balanceSatoshis / 100000000;

  return {
    availableBalance: confirmedBalance,
    unavailableBalance: 0,
    totalBalance: confirmedBalance
  };
};

export const myDogeGetMarketBalance = async (client: AxiosInstance, address: string) => {
  // For now share the same wallet/info endpoint as the main balance helpers
  const encodedRoute = encodeURIComponent(`/address/${address}?page=1&pageSize=10`);
  const res = await client.get(`/wallet/info?route=${encodedRoute}`);
  const balanceSatoshis = res.data?.balance || 0;

  return {
    confirmed: balanceSatoshis / 100000000,
    unconfirmed: 0
  };
};

// ---- UTXO helpers ----

export const myDogeGetAddressUtxo = async (client: AxiosInstance, address: string) => {
  const res = await client.get(`/UTXOS/${address}`);
  const utxos = res.data || [];

  return utxos.map((utxo: any) => ({
    txid: utxo.txid,
    vout: utxo.vout,
    value: utxo.value,
    confirmations: utxo.confirmations,
    scriptPubKey: utxo.scriptPubKey,
    inscriptions: utxo.inscriptions || []
  }));
};


