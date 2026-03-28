import { ethErrors } from 'eth-rpc-errors';

import ReadyPromise from '@/content-script/pageProvider/readyPromise';
import BroadcastChannelMessage from '@dojak/core/utils/message/broadcastChannelMessage';

import { dojakProvider } from './index';

class PushEventHandlers {
  provider: dojakProvider;
  _dojakProviderPrivate: any;

  constructor(
    provider,
    _dojakProviderPrivate: {
      _selectedAddress: string | null;
      _network: string | null;
      _isConnected: boolean;
      _initialized: boolean;
      _isUnlocked: boolean;
      _pushEventHandlers: PushEventHandlers | null;
      _requestPromise: ReadyPromise;
      _bcm: BroadcastChannelMessage;
    }
  ) {
    this.provider = provider;
    this._dojakProviderPrivate = _dojakProviderPrivate;
  }

  _emit(event, data) {
    if (this._dojakProviderPrivate._initialized) {
      this.provider.emit(event, data);
    }
  }

  connect = (data) => {
    if (!this._dojakProviderPrivate._isConnected) {
      this._dojakProviderPrivate._isConnected = true;
      this._dojakProviderPrivate._state.isConnected = true;
      this._emit('connect', data);
    }
  };

  unlock = () => {
    this._dojakProviderPrivate._isUnlocked = true;
    this._dojakProviderPrivate._state.isUnlocked = true;
  };

  lock = () => {
    this._dojakProviderPrivate._isUnlocked = false;
  };

  disconnect = () => {
    this._dojakProviderPrivate._isConnected = false;
    this._dojakProviderPrivate._state.isConnected = false;
    this._dojakProviderPrivate._state.accounts = null;
    this._dojakProviderPrivate._selectedAddress = null;
    const disconnectError = ethErrors.provider.disconnected();

    this._emit('accountsChanged', []);
    this._emit('disconnect', disconnectError);
    this._emit('close', disconnectError);
  };

  accountsChanged = (accounts: string[]) => {
    if (accounts?.[0] === this._dojakProviderPrivate._selectedAddress) {
      return;
    }

    this._dojakProviderPrivate._selectedAddress = accounts?.[0];
    this._dojakProviderPrivate._state.accounts = accounts;
    this._emit('accountsChanged', accounts);
  };

  networkChanged = ({ network }) => {
    this.connect({});

    if (network !== this._dojakProviderPrivate._network) {
      this._dojakProviderPrivate._network = network;
      this._emit('networkChanged', network);
    }
  };
}

export default PushEventHandlers;
