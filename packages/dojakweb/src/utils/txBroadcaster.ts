import { DogeLinkRPC, createP2PKHTransaction, TransactionBuilder } from 'doge-sdk';
import * as dogeSdk from 'doge-sdk';
import * as bitcoin from 'bitcoinjs-lib';
import { browserRpcProxyAbsoluteUrl, fetchRpcSmartFeeKoinuPerKb } from '../lib/rpc-proxy-client';
import { loadBroadcastConfig } from '../lib/broadcast/dogecoinTxBroadcast';
import {
  clampKoinuPerKb,
  INCLUSION_FLOOR_KOINU_PER_KB,
  resolveInclusionFeeRateKoinuPerKb,
} from '../lib/fees/dogecoinFeePolicy';

// Use the EXACT same network configuration as MyDoge wallet
export const dogecoin = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bech32: 'dc',
  bip44: 3,
  bip32: {
    public: 0x02facafd,
    private: 0x02fac398,
  },
  pubKeyHash: 0x1e,  // 30
  scriptHash: 0x16,   // 22
  wif: 0x9e,          // 158
};

// Get raw transaction hex from Tatum API
async function getRawTransaction(txid: string): Promise<string> {
  const response = await fetch('https://api.tatum.io/v3/dogecoin/tx/' + txid, {
    headers: {
      'accept': 'application/json',
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get raw transaction: ${response.status}`);
  }

  const data = await response.json();
  return data.hex || data.raw || data.txHex;
}

// Dogecoin network configuration for bitcoinjs-lib
const dogecoinNetwork = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bech32: 'doge',
  bip32: {
    public: 0x02facafd,
    private: 0x02fac398,
  },
  pubKeyHash: 0x1e, // Dogecoin P2PKH addresses start with 'D'
  scriptHash: 0x16, // Dogecoin P2SH addresses start with '9' or 'A'
  wif: 0x9e, // Dogecoin WIF
};

interface Utxo {
  txid: string;
  vout: number;
  value: number; // in satoshis
  scriptPubKey?: string;
  address?: string;
}

interface RpcConfig {
  url: string;
  username: string;
  password: string;
}

// Your RPC config - adjust for your setup
const RPC_CONFIG: RpcConfig = {
  url: 'http://127.0.0.1:22555',
  username: 'rpcuser', // from your dogecoin.conf
  password: 'rpcpass'  // from your dogecoin.conf
};

const rpcProvider = new DogeLinkRPC(
  `${RPC_CONFIG.url.replace('http://', 'http://' + encodeURIComponent(RPC_CONFIG.username) + ':' + encodeURIComponent(RPC_CONFIG.password) + '@')}`
);

async function waitForConfirmation(txid: string, timeoutMs = 120000, pollIntervalMs = 5000): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const txWithStatus = await rpcProvider.getTransactionWithStatus(txid);
      if (txWithStatus.status.confirmed) {
        return;
      }
    } catch {
      // Ignore transient RPC errors while polling for confirmation
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

// dogecoin-js instance for signing and key operations

async function broadcastRawTransaction(rawTxHex: string): Promise<string> {
  const blockCypherResponse = await fetch('https://api.blockcypher.com/v1/doge/main/txs/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tx: rawTxHex }),
  });

  if (blockCypherResponse.ok) {
    const data = await blockCypherResponse.json();
    return data?.tx?.hash || data?.tx?.hash160 || data?.hash || '';
  }

  const fallbackTxid = await rpcProvider.sendRawTransaction(rawTxHex);
  return typeof fallbackTxid === 'string' ? fallbackTxid : String(fallbackTxid);
}

let doge: any;
let dogeInitPromise: Promise<any> | null = null;

async function getDogecoinJs(): Promise<any> {
  if (doge) {
    return doge;
  }

  if (!dogeInitPromise) {
    dogeInitPromise = import('@mydogeofficial/dogecoin-js')
      .then((mod) => {
        const sdk = (mod as any).DogecoinJS ?? (mod as any).default?.DogecoinJS ?? (mod as any).default ?? mod;
        return typeof sdk.init === 'function' ? sdk.init() : sdk;
      })
      .then((instance) => {
        doge = instance;
        return instance;
      })
      .catch((error) => {
        dogeInitPromise = null;
        throw error;
      });
  }

  return dogeInitPromise;
}

/**
 * Sign transaction using dogecoin-js (for development/testing)
 * In production, this would integrate with wallet signing
 */
export async function signWithDogeJS(unsignedHex: string, privKey?: string): Promise<string> {
  const dogeInstance = await getDogecoinJs();

  // Debug: Log available methods on doge object
  console.log('🔍 [DEBUG] Available methods on doge object:', Object.getOwnPropertyNames(dogeInstance).filter(name => typeof dogeInstance[name] === 'function'));

  // Generate test private key if none provided (NEVER use in production)
  const priv = privKey || dogeInstance.generatePrivPubKeypair()[0];

  try {
    // Try different signing methods that might exist
    let signedHex: string;

    if (typeof dogeInstance.signRawTransaction === 'function') {
      signedHex = dogeInstance.signRawTransaction(unsignedHex, priv);
    } else if (typeof dogeInstance.signTransaction === 'function') {
      signedHex = dogeInstance.signTransaction(unsignedHex, priv);
    } else if (typeof dogeInstance.sign === 'function') {
      signedHex = dogeInstance.sign(unsignedHex, priv);
    } else {
      throw new Error(`No suitable signing method found. Available methods: ${Object.getOwnPropertyNames(dogeInstance).filter(name => typeof dogeInstance[name] === 'function').join(', ')}`);
    }

    // Basic validation - check if signing produced a result
    if (!signedHex || signedHex === unsignedHex) {
      throw new Error('Transaction signing failed - no valid signature produced');
    }

    return signedHex;
  } catch (error) {
    console.error('Signing failed:', error);
    throw new Error(`Transaction signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Broadcast a merge transaction to combine multiple UTXOs
 */
export async function broadcastMerge(
  plainUtxos: Utxo[],
  walletAddress: string,
  estimatedFee: number,
  signWithWallet?: (psbtHex: string) => Promise<string>
): Promise<string> {
  console.error('🚀🚀🚀 BROADCAST MERGE FUNCTION CALLED 🚀🚀🚀');
  console.error('🔥 DEBUG: broadcastMerge called with walletAddress:', walletAddress);
  console.error('🚀 [BROADCAST MERGE] Function called with:', {
    plainUtxosCount: plainUtxos?.length,
    walletAddress,
    estimatedFee,
    plainUtxosType: typeof plainUtxos,
    isArray: Array.isArray(plainUtxos)
  });

  // Log the actual plainUtxos content
  if (plainUtxos && Array.isArray(plainUtxos)) {
    console.error('🚀 [BROADCAST MERGE] plainUtxos content:');
    plainUtxos.forEach((utxo, i) => {
      console.error(`🚀 [BROADCAST MERGE] UTXO ${i}:`, {
        txid: utxo?.txid,
        vout: utxo?.vout,
        value: utxo?.value,
        address: utxo?.address,
        scriptPubKey: utxo?.scriptPubKey,
        utxoType: typeof utxo
      });
    });
  }

  try {
    console.error('🧪 [BROADCAST MERGE] Starting merge with bitcoinjs-lib PSBT approach');

    // Validate inputs
    if (!Array.isArray(plainUtxos) || plainUtxos.length < 2) {
      throw new Error('Need at least 2 UTXOs to merge');
    }

    // Calculate totals
    const totalInput = plainUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
    const totalOutput = totalInput - estimatedFee;

    if (totalOutput <= 0) {
      throw new Error('Transaction would result in negative or zero output');
    }

    // Create PSBT for MyDoge compatibility (uses nonWitnessUtxo)
    console.error('🔧 [PSBT BUILD] Creating PSBT with nonWitnessUtxo for MyDoge compatibility');
    const psbt = new bitcoin.Psbt({ network: dogecoin });

    // Add inputs with nonWitnessUtxo (MyDoge requirement)
    for (const utxo of plainUtxos) {
      console.error(`🔍 [PSBT BUILD] Fetching raw transaction for UTXO: ${utxo.txid}:${utxo.vout}`);
      const prevTxHex = await getRawTransaction(utxo.txid);
      console.error(`✅ [PSBT BUILD] Got raw transaction hex, length: ${prevTxHex.length}`);

      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        nonWitnessUtxo: Buffer.from(prevTxHex, 'hex') // MyDoge requires this!
      } as any);
      console.error(`✅ [PSBT BUILD] Added input with nonWitnessUtxo: ${utxo.txid}:${utxo.vout}`);
    }

    // Add output
    psbt.addOutput({
      address: walletAddress,
      value: BigInt(totalOutput)
    });
    console.error('✅ [PSBT BUILD] Added output to wallet address');

    // Convert to hex for MyDoge signing
    const psbtHex = psbt.toHex();
    console.error('✅ [PSBT BUILD] PSBT created successfully, hex length:', psbtHex.length);

    // Sign with MyDoge wallet
    if (!signWithWallet) {
      throw new Error('Wallet signing is required. No wallet signer available.');
    }

    console.error('🔐 [PSBT SIGN] Sending PSBT to MyDoge for signing...');
    const signedPsbtHex = await signWithWallet(psbtHex);
    console.error('✅ [PSBT SIGN] MyDoge signed PSBT, length:', signedPsbtHex.length);

    // Extract final transaction
    let finalTxHex: string;
    try {
      // Try to parse as signed PSBT first
      const signedPsbt = bitcoin.Psbt.fromHex(signedPsbtHex, { network: dogecoin });
      const tx = signedPsbt.extractTransaction();
      finalTxHex = tx.toHex();
      console.error('✅ [TX EXTRACT] Extracted transaction from signed PSBT');
    } catch (psbtError) {
      // If PSBT parsing fails, assume it's already a raw transaction
      const psbtErrorMessage = psbtError instanceof Error ? psbtError.message : String(psbtError);
      console.error('⚠️ [TX EXTRACT] PSBT extraction failed, assuming raw transaction:', psbtErrorMessage);
      finalTxHex = signedPsbtHex;
    }

    // Broadcast transaction
    console.error('🚀 [TX BROADCAST] Broadcasting transaction...');
    const txid = await broadcastRawTransaction(finalTxHex);
    console.error('✅ [TX BROADCAST] Transaction broadcast successfully! TXID:', txid);

    await waitForConfirmation(txid);
    return txid;
  } catch (error) {
    console.error('Merge broadcast failed:', error);
    throw new Error(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Broadcast a split transaction to divide a UTXO into multiple outputs
 */
export async function broadcastSplit(
  utxo: Utxo,
  outputs: Array<{ address: string; value: number }>,
  estimatedFee: number,
  signWithWallet?: (psbtHex: string) => Promise<string>
): Promise<string> {
  try {
    if (outputs.length < 2) {
      throw new Error('Split must create at least 2 outputs');
    }

    const totalOutputValue = outputs.reduce((sum, output) => sum + output.value, 0);

    if (totalOutputValue + estimatedFee > utxo.value) {
      throw new Error('Total outputs plus fee exceed input value');
    }

    if (!signWithWallet) {
      throw new Error('Wallet signing is required for split transactions');
    }

    const prevTxHex = await getRawTransaction(utxo.txid);
    const psbt = new bitcoin.Psbt({ network: dogecoin });
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      nonWitnessUtxo: Buffer.from(prevTxHex, 'hex')
    } as any);

    outputs.forEach((output) => {
      psbt.addOutput({
        address: output.address,
        value: BigInt(output.value)
      });
    });

    const signedPsbtHex = await signWithWallet(psbt.toHex());
    let finalTxHex: string;
    try {
      finalTxHex = bitcoin.Psbt.fromHex(signedPsbtHex, { network: dogecoin }).extractTransaction().toHex();
    } catch {
      finalTxHex = signedPsbtHex;
    }

    const txid = await broadcastRawTransaction(finalTxHex);

    // Wait for confirmation
    await waitForConfirmation(txid);

    return txid;
  } catch (error) {
    console.error('Split broadcast failed:', error);
    throw new Error(`Split transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Broadcast a batch send transaction to multiple recipients
 */
export async function broadcastBatchSend(
  utxos: Utxo[],
  recipients: Array<{ address: string; amount: number }>,
  estimatedFee: number
): Promise<string> {
  try {
    if (utxos.length === 0 || recipients.length === 0) {
      throw new Error('Batch send requires at least one UTXO and one recipient');
    }

    const totalInput = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
    const totalOutput = recipients.reduce((sum, recipient) => sum + recipient.amount, 0);

    if (totalOutput + estimatedFee > totalInput) {
      throw new Error('Total outputs plus fee exceed input value');
    }

    // Create transaction with multiple inputs and outputs
    const txParams = {
      inputs: utxos.map(utxo => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        scriptPubKey: utxo.scriptPubKey || '',
        address: utxo.address || ''
      })),
      outputs: recipients.map(recipient => ({
        address: recipient.address,
        value: recipient.amount
      })),
      fee: estimatedFee
    };

    // Build and sign
    const unsignedTx = (createP2PKHTransaction as unknown as (params: any) => any)(txParams);
    const signedTxHex = await (signWithDogeJS as unknown as (unsignedHex: string) => Promise<string>)(unsignedTx.toString('hex'));

    // Broadcast
    const txid = await rpcProvider.sendRawTransaction(signedTxHex);

    // Wait for confirmation
    await waitForConfirmation(txid);

    return txid;
  } catch (error) {
    console.error('Batch send broadcast failed:', error);
    throw new Error(`Batch send failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Inscription / wallet fee rate in koinu per kB (same unit as the inscribe UI).
 * Always ≥ inclusion floor (10× Core min relay). Prefers Command.dog fee-estimate.
 */
export async function getFeeEstimate(targetBlocks = 2): Promise<number> {
  if (typeof window === 'undefined') return INCLUSION_FLOOR_KOINU_PER_KB;

  const fromApi = await resolveInclusionFeeRateKoinuPerKb(targetBlocks);
  if (fromApi > INCLUSION_FLOOR_KOINU_PER_KB) {
    return fromApi;
  }

  if (!browserRpcProxyAbsoluteUrl()) return fromApi;

  const cfg = loadBroadcastConfig();
  const url = cfg.rpcUrl?.trim();
  const user = cfg.rpcUser?.trim();
  const pass = cfg.rpcPass;
  if (!url || !user || pass === undefined || pass === '') return fromApi;

  try {
    const r = await fetchRpcSmartFeeKoinuPerKb(
      { rpcUrl: url, rpcUser: user, rpcPass: pass },
      targetBlocks,
    );
    if (r.ok) {
      console.log('[dojakweb:fee] RPC fee estimate', {
        koinuPerKb: r.koinuPerKb,
        blocks: r.blocks,
        source: r.source,
      });
      return clampKoinuPerKb(r.koinuPerKb);
    }
    console.warn('[dojakweb:fee] RPC fee estimate failed:', r.error);
  } catch (e) {
    console.warn('[dojakweb:fee] RPC fee estimate error:', e);
  }
  return fromApi;
}
