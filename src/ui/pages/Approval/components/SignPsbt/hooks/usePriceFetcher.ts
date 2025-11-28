import { useEffect, useState } from 'react';

export const usePriceFetcher = (txInfo, wallet, tools) => {
  const [drc20PriceMap, setDrc20PriceMap] = useState();
  const [dunesPriceMap, setDunesPriceMap] = useState();

  useEffect(() => {
    if (!txInfo?.decodedPsbt?.inputInfos) return;

    const dunesMap = {};
    const drc20Map = {};

    // collect asset information
    txInfo.decodedPsbt.inputInfos.forEach((v) => {
      if (v.dunes) {
        v.dunes.forEach((w) => {
          dunesMap[w.spacedDune] = true;
        });
      }

      if (v.inscriptions) {
        v.inscriptions.forEach((w) => {
          if (w.drc20) {
            drc20Map[w.drc20.tick] = true;
          }
        });
      }
    });

    // get asset price
    if (Object.keys(dunesMap).length > 0) {
      wallet
        .getDunesPrice(Object.keys(dunesMap))
        .then(setDunesPriceMap)
        .catch((e) => tools.toastError(e.message));
    }

    if (Object.keys(drc20Map).length > 0) {
      wallet
        .getDrc20sPrice(Object.keys(drc20Map))
        .then(setDrc20PriceMap)
        .catch((e) => tools.toastError(e.message));
    }
  }, [txInfo, wallet, tools]);

  return { drc20PriceMap, dunesPriceMap };
};


