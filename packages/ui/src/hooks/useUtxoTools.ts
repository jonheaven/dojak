import { TypeChain } from '@dojak/core/constant';

export const useUtxoTools = (chain: TypeChain) => {
  const openUtxoTools = () => {
    window.open(`${chain.dojakUrl}/utxo?tab=all`);
  };

  return {
    openUtxoTools
  };
};
