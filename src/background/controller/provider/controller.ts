import { permissionService, sessionService, walletApiService } from '@/background/service';
import { CHAINS, CHAINS_MAP, NETWORK_TYPES, VERSION } from '@/shared/constant';
import { getDogecoinNetwork } from '@/shared/lib/dogecoin-network';
import { NetworkType, RequestMethodGetInscriptionsParams, RequestMethodSendBitcoinParams, RequestMethodSendDunesParams, RequestMethodSendInscriptionParams, RequestMethodSignMessageParams, RequestMethodSignMessagesParams, RequestMethodSignPsbtParams, RequestMethodSignPsbtsParams } from '@/shared/types';
import { getChainInfo } from '@/shared/utils';
import { amountToSatoshis } from '@/ui/utils';
import { bitcoin, verifyMessageOfBIP322Simple } from '@unisat/wallet-bitcoin';
import { ethErrors } from 'eth-rpc-errors';
import BaseController from '../base';
import wallet from '../wallet';

import { formatPsbtHex } from '@/background/utils/psbt-utils';

class ProviderController extends BaseController {

  requestAccounts = async ({ session: { origin } }) => {
    if (!permissionService.hasPermission(origin)) {
      throw ethErrors.provider.unauthorized();
    }

    const _account = await wallet.getCurrentAccount();
    const account = _account ? [_account.address] : [];
    sessionService.broadcastEvent('accountsChanged', account);
    const connectSite = permissionService.getConnectedSite(origin);
    if (connectSite) {
      const network = wallet.getLegacyNetworkName()
      sessionService.broadcastEvent(
        'networkChanged',
        {
          network
        },
        origin
      );
    }
    return account
  };

  disconnect = async ({ session: { origin } }) => {
    wallet.removeConnectedSite(origin)
  };

  @Reflect.metadata('SAFE', true)
  getAccounts = async ({ session: { origin } }) => {
    if (!permissionService.hasPermission(origin)) {
      return [];
    }

    const _account = await wallet.getCurrentAccount();
    const account = _account ? [_account.address] : [];
    return account
  };

  @Reflect.metadata('SAFE', true)
  getNetwork = async () => {
    return wallet.getLegacyNetworkName()
  };

  @Reflect.metadata('APPROVAL', ['SwitchNetwork', (req) => {
    const network = req.data.params.network;
    if (NETWORK_TYPES[NetworkType.MAINNET].validNames.includes(network)) {
      req.data.params.networkType = NetworkType.MAINNET
    } else if (NETWORK_TYPES[NetworkType.TESTNET].validNames.includes(network)) {
      req.data.params.networkType = NetworkType.TESTNET
    } else {
      throw new Error(`the network is invalid, supported networks: ${NETWORK_TYPES.map(v => v.name).join(',')}`)
    }

    if (req.data.params.networkType === wallet.getNetworkType()) {
      // skip approval
      return true;
    }
  }])
  switchNetwork = async (req) => {
    const { data: { params: { networkType } } } = req;
    wallet.setNetworkType(networkType)
    return NETWORK_TYPES[networkType].name
  }


  @Reflect.metadata('SAFE', true)
  getChain = async () => {
    const chainType = wallet.getChainType()
    return getChainInfo(chainType)
  };

  @Reflect.metadata('APPROVAL', ['SwitchChain', (req) => {
    const chainType = req.data.params.chain;
    if(!CHAINS_MAP[chainType]){
      throw new Error(`the chain is invalid, supported chains: ${CHAINS.map(v => v.enum).join(',')}`)
    }

    if (chainType == wallet.getChainType()) {
      // skip approval
      return true;
    }
  }])
  switchChain = async (req) => {
    const { data: { params: { chain } } } = req;
    wallet.setChainType(chain)
    return getChainInfo(chain)
  }

  @Reflect.metadata('SAFE', true)
  getPublicKey = async () => {
    const account = await wallet.getCurrentAccount();
    if (!account) return ''
    return account.pubkey;
  };

  @Reflect.metadata('SAFE', true)
  getInscriptions = async (req) => {
    const params:RequestMethodGetInscriptionsParams = req.data.params;
    const { cursor, size } = params;
    if(typeof cursor !== 'number' || typeof size !== 'number'){
      throw new Error('cursor and size is required')
    }

    const account = await wallet.getCurrentAccount();
    if (!account) return ''
    const { list, total } = await walletApiService.inscriptions.getAddressInscriptions(account.address, cursor, size);
    return { list, total };
  };

  @Reflect.metadata('SAFE', true)
  getBalance = async () => {
    const account = await wallet.getCurrentAccount();
    if (!account) return null;
    const balance = await wallet.getAddressBalance(account.address)
    return {
      confirmed: amountToSatoshis(balance.confirm_amount),
      unconfirmed: amountToSatoshis(balance.pending_amount),
      total: amountToSatoshis(balance.amount)
    };
  };

  @Reflect.metadata('SAFE', true)
  getBalanceV2 = async () => {
    const account = await wallet.getCurrentAccount();
    if (!account) return null;
    const balance = await wallet.getAddressBalanceV2(account.address)
    return {
      available: balance.availableBalance,
      unavailable: balance.unavailableBalance,
      total: balance.totalBalance
    };
  };

  @Reflect.metadata('SAFE', true)
  verifyMessageOfBIP322Simple = async (req) => {
    const { data: { params } } = req;
    return verifyMessageOfBIP322Simple(params.address, params.message, params.signature, params.network) ? 1 : 0;
  }

  @Reflect.metadata('APPROVAL', ['SignPsbt', (req) => {
    const params:RequestMethodSendBitcoinParams = req.data.params;
    if(!params.sendBitcoinParams.toAddress){
      throw new Error('toAddress is required')
    }
    if(!params.sendBitcoinParams.satoshis){
      throw new Error('satoshis is required')
    }
  }])
  sendBitcoin = async ({ approvalRes: { psbtHex } }) => {
    const psbt = bitcoin.Psbt.fromHex(psbtHex);
    const tx = psbt.extractTransaction(true);
    const rawtx = tx.toHex()
    return await wallet.pushTx(rawtx)
  }

  @Reflect.metadata('APPROVAL', ['SignPsbt', (req) => {
    const params:RequestMethodSendInscriptionParams = req.data.params;
    if(!params.sendInscriptionParams.toAddress){
      throw new Error('toAddress is required')
    }
    if(!params.sendInscriptionParams.inscriptionId){
      throw new Error('inscriptionId is required')
    }
  }])
  sendInscription = async ({ approvalRes: { psbtHex } }) => {
    const psbt = bitcoin.Psbt.fromHex(psbtHex);
    const tx = psbt.extractTransaction(true);
    const rawtx = tx.toHex()
    return await wallet.pushTx(rawtx)
  }

  @Reflect.metadata('APPROVAL', ['SignPsbt', (req) => {
     const params: RequestMethodSendDunesParams = req.data.params;
    if(!params.sendDunesParams.toAddress){
      throw new Error('toAddress is required')
    }
    if(!params.sendDunesParams.duneid){
      throw new Error('runeid is required')
    }
    if(!params.sendDunesParams.amount){
      throw new Error('amount is required')
    }
  }])
  sendDunes = async ({ approvalRes: { psbtHex } }) => {
    const psbt = bitcoin.Psbt.fromHex(psbtHex);
    const tx = psbt.extractTransaction(true);
    const rawtx = tx.toHex()
    return await wallet.pushTx(rawtx)
  }

  @Reflect.metadata('APPROVAL', ['SignText', (req) => {
    const params:RequestMethodSignMessageParams = req.data.params;
    if(!params.text){
      throw new Error('text is required')
    }
  }])
  signMessage = async ({ data: { params: { text, type } }, approvalRes }) => {
    if (approvalRes?.signature) {
      return approvalRes.signature
    }
    if (type === 'bip322-simple') {
      return wallet.signBIP322Simple(text)
    } else {
      return wallet.signMessage(text)
    }
  }

  @Reflect.metadata('APPROVAL', ['SignData', () => {
    // todo check text
  }])
  signData = async ({ data: { params: { data, type } } }) => {
    return wallet.signData(data, type)
  }

  @Reflect.metadata('SAFE', true)
  pushTx = async ({ data: { params: { rawtx } } }) => {

    return await wallet.pushTx(rawtx)
  }

  @Reflect.metadata('APPROVAL', ['SignPsbt', (req) => {
    const params:RequestMethodSignPsbtParams = req.data.params;
    if(!params.psbtHex){
      throw new Error('psbtHex is required')
    }

    params.psbtHex = formatPsbtHex(params.psbtHex);
  }])
  signPsbt = async ({ data: { params: { psbtHex, options } }, approvalRes }) => {
    if (approvalRes && approvalRes.signed==true) {
      return approvalRes.psbtHex
    }
    const networkType = wallet.getNetworkType()
    const psbtNetwork = getDogecoinNetwork(networkType)
    const psbt = bitcoin.Psbt.fromHex(psbtHex, { network: psbtNetwork })
    const autoFinalized = (options && options.autoFinalized == false) ? false : true;
    const toSignInputs = await wallet.formatOptionsToSignInputs(psbtHex, options);
    await wallet.signPsbt(psbt, toSignInputs, autoFinalized);
    return psbt.toHex();
  }

  @Reflect.metadata('APPROVAL', ['MultiSignPsbt', (req) => {
    const params:RequestMethodSignPsbtsParams = req.data.params;
    params.psbtHexs.forEach(psbtHex=>{
      if(!psbtHex){
        throw new Error('psbtHex is required')
      }
    })

    params.psbtHexs = params.psbtHexs.map(psbtHex => formatPsbtHex(psbtHex));
  }])
  multiSignPsbt = async ({ data: { params: { psbtHexs, options } } }) => {
    const account = await wallet.getCurrentAccount();
    if (!account) throw null;
    const networkType = wallet.getNetworkType()
    const psbtNetwork = getDogecoinNetwork(networkType)
    const result: string[] = [];
    for (let i = 0; i < psbtHexs.length; i++) {
      const psbt = bitcoin.Psbt.fromHex(psbtHexs[i], { network: psbtNetwork });
      const autoFinalized = (options && options[i] && options[i].autoFinalized == false) ? false : true;
      const toSignInputs = await wallet.formatOptionsToSignInputs(psbtHexs[i], options[i]);
      await wallet.signPsbt(psbt, toSignInputs, autoFinalized);
      result.push(psbt.toHex())
    }
    return result;
  }


  @Reflect.metadata('APPROVAL', ['MultiSignMessage', (req) => {
    const params:RequestMethodSignMessagesParams = req.data.params;
    if(params.messages.length == 0){
      throw new Error('data is required')
    }
    for (let i = 0; i < params.messages.length; i++) {
      const message = params.messages[i];
      if (!message.text) {
        throw new Error('text is required')
      }
      if(message.text.length > 10000){
        throw new Error('text is too long')
      }
    }
  }])
  multiSignMessage = async ({ data: { params: { messages } } }) => {
    const account = await wallet.getCurrentAccount();
    if (!account) throw null;
    const result: string[] = [];
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      if (message.type === 'bip322-simple') {
        result.push(await wallet.signBIP322Simple(message.text))
      } else {
        result.push(await wallet.signMessage(message.text))
      }
    }
    return result;
  }

  @Reflect.metadata('SAFE', true)
  pushPsbt = async ({ data: { params: { psbtHex } } }) => {
    const hexData = formatPsbtHex(psbtHex);
    const psbt = bitcoin.Psbt.fromHex(hexData);
    const tx = psbt.extractTransaction(true);
    const rawtx = tx.toHex()
    return await wallet.pushTx(rawtx)
  }

  @Reflect.metadata('APPROVAL', ['InscribeTransfer', (req) => {
    const { data: { params: { ticker } } } = req;
    // todo
  }])
  inscribeTransfer = async ({ approvalRes }) => {
    return approvalRes
  }

  @Reflect.metadata('SAFE', true)
  getVersion = async () => {
    return VERSION
  };

  @Reflect.metadata('SAFE', true)
  isAtomicalsEnabled = async () => {
    return false;
  };

  @Reflect.metadata('SAFE', true)
  getBitcoinUtxos = async () => {
    const account = await wallet.getCurrentAccount();
    if (!account) return [];
    const utxos = await wallet.getPEPUtxos()
    return utxos;
  };

  private _isKeystoneWallet = async () => {
    const currentKeyring = await wallet.getCurrentKeyring();
    return currentKeyring?.type === 'keystone';
  }
}

export default new ProviderController();
