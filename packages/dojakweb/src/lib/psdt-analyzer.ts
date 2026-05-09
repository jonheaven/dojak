import * as bitcoin from 'bitcoinjs-lib';
import { decodePsdtOutputAddress, quickCheckPsdtNetwork } from './psdt-validator';
import { DOGE_NETWORK, tryParsePsdt } from './doginal-psdt';

export type PsbtLikeFormat = 'psbt' | 'raw-tx' | 'invalid';

export interface PsbtInputDetail {
  index: number;
  txid: string;
  vout: number;
  sequence: number;
  hasNonWitnessUtxo: boolean;
  hasWitnessUtxo: boolean;
  prevoutValueDoge: number | null;
  prevoutAddressDoge: string | null;
  prevoutAddressBtc: string | null;
  scriptHex: string | null;
  partialSigCount: number;
  partialSigners: string[];
  sighashType: number | null;
  bip32DerivationCount: number;
  bip32Paths: string[];
  redeemScriptHex: string | null;
  witnessScriptHex: string | null;
  unknownKeyCount: number;
}

export interface PsbtOutputDetail {
  index: number;
  valueDoge: number;
  addressDoge: string | null;
  addressBtc: string | null;
  scriptHex: string | null;
}

export interface PsdtAnalysisResult {
  format: PsbtLikeFormat;
  inputEncoding: 'base64' | 'hex' | 'raw-tx' | 'unknown';
  rawLength: number;
  rawPrefix: string;
  networkHint: 'dogecoin' | 'bitcoin' | 'unknown';
  warnings: string[];
  errors: string[];
  psbtVersion: number | null;
  txVersion: number | null;
  locktime: number | null;
  txid: string | null;
  inputCount: number;
  outputCount: number;
  totalOutputDoge: number | null;
  outputs: PsbtOutputDetail[];
  inputs: PsbtInputDetail[];
  globalUnknownKeyCount: number;
  note: string | null;
}

function toHex(value: Buffer | Uint8Array | undefined | null): string | null {
  if (!value) return null;
  return Buffer.from(value).toString('hex');
}

function toDoge(value: bigint | number | undefined | null): number {
  if (value === null || value === undefined) return 0;
  const satoshis = typeof value === 'bigint' ? Number(value) : Number(value);
  return satoshis / 1e8;
}

function addressFromScript(script: Buffer | Uint8Array | undefined | null): { doge: string | null; btc: string | null } {
  if (!script?.length) return { doge: null, btc: null };
  let doge: string | null = null;
  let btc: string | null = null;
  try {
    doge = bitcoin.address.fromOutputScript(Buffer.from(script), DOGE_NETWORK);
  } catch {
    /* ignore */
  }
  try {
    btc = bitcoin.address.fromOutputScript(Buffer.from(script), bitcoin.networks.bitcoin);
  } catch {
    /* ignore */
  }
  return { doge, btc };
}

function summarizeEncoding(input: string): {
  format: PsbtLikeFormat;
  inputEncoding: 'base64' | 'hex' | 'raw-tx' | 'unknown';
  normalized: string;
} {
  const trimmed = input.trim();
  if (!trimmed) {
    return { format: 'invalid', inputEncoding: 'unknown', normalized: '' };
  }

  const looksHex = /^[0-9a-fA-F]+$/.test(trimmed);
  const looksBase64 = /^[A-Za-z0-9+/=_-]+$/.test(trimmed);

  if (looksHex && trimmed.toLowerCase().startsWith('70736274')) {
    return { format: 'psbt', inputEncoding: 'hex', normalized: trimmed };
  }

  const parsedPsbt = tryParsePsdt(trimmed);
  if (parsedPsbt) {
    return {
      format: 'psbt',
      inputEncoding: looksHex ? 'hex' : 'base64',
      normalized: parsedPsbt.toBase64(),
    };
  }

  if (looksHex) {
    return { format: 'raw-tx', inputEncoding: 'hex', normalized: trimmed };
  }

  if (looksBase64) {
    return { format: 'invalid', inputEncoding: 'base64', normalized: trimmed };
  }

  return { format: 'invalid', inputEncoding: 'unknown', normalized: trimmed };
}

export function analyzePsdtLike(input: string): PsdtAnalysisResult {
  const trimmed = input.trim();
  const prefix = trimmed.slice(0, 24);

  console.log('[PSBT Analyzer] analyze:start', {
    length: trimmed.length,
    prefix,
  });

  const base: PsdtAnalysisResult = {
    format: 'invalid',
    inputEncoding: 'unknown',
    rawLength: trimmed.length,
    rawPrefix: prefix,
    networkHint: 'unknown',
    warnings: [],
    errors: [],
    psbtVersion: null,
    txVersion: null,
    locktime: null,
    txid: null,
    inputCount: 0,
    outputCount: 0,
    totalOutputDoge: null,
    outputs: [],
    inputs: [],
    globalUnknownKeyCount: 0,
    note: null,
  };

  if (!trimmed) {
    console.warn('[PSBT Analyzer] analyze:empty-input');
    return {
      ...base,
      errors: ['Paste a PSDT or raw transaction first.'],
    };
  }

  const encoding = summarizeEncoding(trimmed);
  console.log('[PSBT Analyzer] analyze:encoding', encoding);

  if (encoding.format === 'raw-tx') {
    try {
      const tx = bitcoin.Transaction.fromHex(encoding.normalized);
      const outputs = tx.outs.map((out, index) => {
        const addresses = addressFromScript(out.script);
        return {
          index,
          valueDoge: toDoge(out.value),
          addressDoge: addresses.doge,
          addressBtc: addresses.btc,
          scriptHex: toHex(out.script),
        };
      });
      const result: PsdtAnalysisResult = {
        ...base,
        format: 'raw-tx',
        inputEncoding: encoding.inputEncoding,
        txVersion: tx.version,
        locktime: tx.locktime,
        txid: tx.getId(),
        inputCount: tx.ins.length,
        outputCount: tx.outs.length,
        totalOutputDoge: outputs.reduce((sum, out) => sum + out.valueDoge, 0),
        outputs,
        note: 'This is a raw transaction, not a PSDT. It cannot be partially signed the same way a PSDT can.',
      };
      console.log('[PSBT Analyzer] analyze:raw-tx-result', {
        txid: result.txid,
        inputs: result.inputCount,
        outputs: result.outputCount,
        totalOutputDoge: result.totalOutputDoge,
      });
      return result;
    } catch (error) {
      console.error('[PSBT Analyzer] analyze:raw-tx-parse-failed', error);
      return {
        ...base,
        inputEncoding: encoding.inputEncoding,
        errors: ['Input looks like hex, but it is not a valid Dogecoin transaction or PSDT.'],
      };
    }
  }

  const psbt = tryParsePsdt(trimmed);
  if (!psbt) {
    console.warn('[PSBT Analyzer] analyze:psbt-parse-failed');
    return {
      ...base,
      inputEncoding: encoding.inputEncoding,
      errors: ['Could not parse the pasted value as a PSDT.'],
      note: 'If this came from a wallet, it may be an unsigned raw transaction or a wallet-specific encoding.',
    };
  }

  const psbtBase64 = psbt.toBase64();
  const psbtNetworkHint = quickCheckPsdtNetwork(psbtBase64);
  const decodedFirstOutput = decodePsdtOutputAddress(psbtBase64);
  const globalMap = (psbt.data as any).globalMap ?? {};
  const unsignedTx = globalMap.unsignedTx?.tx ?? null;

  const inputs = psbt.txInputs.map((txIn, index) => {
    const inputData: any = psbt.data.inputs[index] ?? {};
    const prevTxid = Buffer.from(txIn.hash).reverse().toString('hex');
    const prevoutIndex = txIn.index;
    const sequence = txIn.sequence;
    const partialSig = inputData.partialSig ?? [];
    const bip32Derivation = inputData.bip32Derivation ?? [];
    const nonWitnessUtxo = inputData.nonWitnessUtxo as Buffer | undefined;
    const witnessUtxo = inputData.witnessUtxo as { script?: Buffer; value?: bigint | number } | undefined;
    const prevoutScript = nonWitnessUtxo
      ? (() => {
          try {
            const prevTx = bitcoin.Transaction.fromBuffer(Buffer.from(nonWitnessUtxo));
            return prevTx.outs[prevoutIndex]?.script ?? null;
          } catch {
            return null;
          }
        })()
      : witnessUtxo?.script ?? null;
    const prevoutValue = nonWitnessUtxo
      ? (() => {
          try {
            const prevTx = bitcoin.Transaction.fromBuffer(Buffer.from(nonWitnessUtxo));
            return toDoge(prevTx.outs[prevoutIndex]?.value ?? null);
          } catch {
            return null;
          }
        })()
      : witnessUtxo?.value !== undefined
        ? toDoge(witnessUtxo.value)
        : null;
    const addresses = addressFromScript(prevoutScript);

    const detail: PsbtInputDetail = {
      index,
      txid: prevTxid,
      vout: prevoutIndex,
      sequence: sequence ?? 0xffffffff,
      hasNonWitnessUtxo: Boolean(nonWitnessUtxo),
      hasWitnessUtxo: Boolean(witnessUtxo),
      prevoutValueDoge: prevoutValue,
      prevoutAddressDoge: addresses.doge,
      prevoutAddressBtc: addresses.btc,
      scriptHex: toHex(prevoutScript),
      partialSigCount: partialSig.length,
      partialSigners: partialSig.map((sig: any) => Buffer.from(sig.pubkey ?? []).toString('hex')),
      sighashType: inputData.sighashType ?? null,
      bip32DerivationCount: bip32Derivation.length,
      bip32Paths: bip32Derivation.map((entry: any) => entry.path ?? ''),
      redeemScriptHex: toHex(inputData.redeemScript),
      witnessScriptHex: toHex(inputData.witnessScript),
      unknownKeyCount: inputData.unknownKeyVals?.length ?? 0,
    };

    console.log(`[PSBT Analyzer] input[${index}]`, detail);
    return detail;
  });

  const outputs = psbt.txOutputs.map((txOut, index) => {
    const addresses = addressFromScript(txOut.script);
    const detail: PsbtOutputDetail = {
      index,
      valueDoge: toDoge(txOut.value),
      addressDoge: addresses.doge,
      addressBtc: addresses.btc,
      scriptHex: toHex(txOut.script),
    };
    console.log(`[PSBT Analyzer] output[${index}]`, detail);
    return detail;
  });

  const result: PsdtAnalysisResult = {
    ...base,
    format: 'psbt',
    inputEncoding: encoding.inputEncoding,
    networkHint: psbtNetworkHint,
    psbtVersion: (psbt as any).version ?? (globalMap.version ?? null),
    txVersion: unsignedTx?.version ?? null,
    locktime: unsignedTx?.locktime ?? null,
    txid: unsignedTx?.getId?.() ?? null,
    inputCount: psbt.txInputs.length,
    outputCount: psbt.txOutputs.length,
    totalOutputDoge: outputs.reduce((sum, out) => sum + out.valueDoge, 0),
    outputs,
    inputs,
    globalUnknownKeyCount: globalMap.unknownKeyVals?.length ?? 0,
    note: decodedFirstOutput.doge || decodedFirstOutput.btc
      ? `First output decodes as ${decodedFirstOutput.doge ?? decodedFirstOutput.btc}.`
      : 'No readable address could be derived from the first output script.',
  };

  console.log('[PSBT Analyzer] analyze:psbt-result', {
    inputCount: result.inputCount,
    outputCount: result.outputCount,
    networkHint: result.networkHint,
    globalUnknownKeyCount: result.globalUnknownKeyCount,
    totalOutputDoge: result.totalOutputDoge,
  });

  return result;
}
