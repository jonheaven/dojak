import { ethErrors } from 'eth-rpc-errors';

import { sessionService, keyringService } from '@dojak/core/background/service';
import { tab } from '@dojak/core/background/webapi';

import internalMethod from './internalMethod';
import rpcFlow from './rpcFlow';

tab.on('tabRemove', (id) => {
  sessionService.deleteSession(id);
});

export default async (req) => {
  const {
    data: { method }
  } = req;

  if (internalMethod[method]) {
    return internalMethod[method](req);
  }

  const hasVault = keyringService.hasVault();
  if (!hasVault) {
    throw ethErrors.provider.userRejectedRequest({
      message: 'Wallet must have at least one account.'
    });
  }
  return rpcFlow(req);
};
