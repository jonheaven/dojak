/**
 * Provider Response Validation Module
 * 
 * Validates API responses from external providers to ensure data integrity
 * and prevent malicious/malformed data from entering the wallet state.
 * 
 * Addresses H-02 from Security Audit 2026-03:
 * "Canonicalize provider schemas and validate response invariants before acceptance"
 */

import { UTXO, DogecoinBalance, TxHistoryItem } from '@/shared/types';

export class ValidationError extends Error {
  constructor(message: string, public field?: string, public value?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates that a value is a non-negative number
 */
function isNonNegativeNumber(value: any): boolean {
  return typeof value === 'number' && !isNaN(value) && value >= 0;
}

/**
 * Validates that a value is a valid positive integer
 */
function isPositiveInteger(value: any): boolean {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Validates that a value is a non-empty string
 */
function isNonEmptyString(value: any): boolean {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Validates that a value is a valid hexadecimal string of expected length
 */
function isValidHex(value: any, expectedLength?: number): boolean {
  if (typeof value !== 'string') return false;
  const hexRegex = /^[0-9a-fA-F]+$/;
  if (!hexRegex.test(value)) return false;
  if (expectedLength !== undefined && value.length !== expectedLength) return false;
  return true;
}

/**
 * Validates that a value is a valid txid (64-character hex string)
 */
function isValidTxid(value: any): boolean {
  return isValidHex(value, 64);
}

/**
 * Validates that a numeric string can be safely parsed
 */
function isValidNumericString(value: any): boolean {
  if (typeof value !== 'string') return false;
  const num = parseFloat(value);
  return !isNaN(num) && isFinite(num) && num >= 0;
}

/**
 * Validates a UTXO object
 */
export function validateUTXO(utxo: any): UTXO {
  if (!utxo || typeof utxo !== 'object') {
    throw new ValidationError('UTXO must be an object', 'utxo', utxo);
  }

  // Validate txid (required, must be 64-char hex)
  if (!isValidTxid(utxo.txid)) {
    throw new ValidationError('Invalid txid in UTXO', 'txid', utxo.txid);
  }

  // Validate vout (required, must be non-negative integer)
  if (!isPositiveInteger(utxo.vout)) {
    throw new ValidationError('Invalid vout in UTXO', 'vout', utxo.vout);
  }

  // Validate koinu (required, must be positive number)
  if (!isPositiveInteger(utxo.koinu) || utxo.koinu <= 0) {
    throw new ValidationError('Invalid koinu amount in UTXO', 'koinu', utxo.koinu);
  }

  // Validate koinu is within reasonable bounds (max supply is 100B DOGE = 10^16 koinu)
  const MAX_KOINU = 1e16;
  if (utxo.koinu > MAX_KOINU) {
    throw new ValidationError('UTXO koinu exceeds maximum possible value', 'koinu', utxo.koinu);
  }

  // Validate scriptPk (required, must be hex string)
  if (!isValidHex(utxo.scriptPk)) {
    throw new ValidationError('Invalid scriptPk in UTXO', 'scriptPk', utxo.scriptPk);
  }

  // Validate addressType (required, must be number)
  if (typeof utxo.addressType !== 'number') {
    throw new ValidationError('Invalid addressType in UTXO', 'addressType', utxo.addressType);
  }

  // Validate inscriptions array (optional, but must be array if present)
  if (utxo.inscriptions !== undefined) {
    if (!Array.isArray(utxo.inscriptions)) {
      throw new ValidationError('UTXO inscriptions must be an array', 'inscriptions', utxo.inscriptions);
    }
    
    utxo.inscriptions.forEach((insc: any, idx: number) => {
      if (!insc || typeof insc !== 'object') {
        throw new ValidationError(`Invalid inscription at index ${idx}`, `inscriptions[${idx}]`, insc);
      }
      if (!isNonEmptyString(insc.inscriptionId)) {
        throw new ValidationError(`Invalid inscriptionId at index ${idx}`, `inscriptions[${idx}].inscriptionId`, insc.inscriptionId);
      }
      if (insc.inscriptionNumber !== undefined && !isPositiveInteger(insc.inscriptionNumber)) {
        throw new ValidationError(`Invalid inscriptionNumber at index ${idx}`, `inscriptions[${idx}].inscriptionNumber`, insc.inscriptionNumber);
      }
      if (!isPositiveInteger(insc.offset)) {
        throw new ValidationError(`Invalid offset at index ${idx}`, `inscriptions[${idx}].offset`, insc.offset);
      }
    });
  }

  // Validate atomicals array (optional, deprecated but must be valid if present)
  if (utxo.atomicals !== undefined && !Array.isArray(utxo.atomicals)) {
    throw new ValidationError('UTXO atomicals must be an array', 'atomicals', utxo.atomicals);
  }

  // Validate dunes array (optional, but must be array if present)
  if (utxo.dunes !== undefined && !Array.isArray(utxo.dunes)) {
    throw new ValidationError('UTXO dunes must be an array', 'dunes', utxo.dunes);
  }

  return utxo as UTXO;
}

/**
 * Validates an array of UTXOs
 */
export function validateUTXOs(utxos: any): UTXO[] {
  if (!Array.isArray(utxos)) {
    throw new ValidationError('UTXOs must be an array', 'utxos', utxos);
  }

  return utxos.map((utxo, idx) => {
    try {
      return validateUTXO(utxo);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ValidationError(
          `UTXO validation failed at index ${idx}: ${error.message}`,
          `utxos[${idx}].${error.field}`,
          error.value
        );
      }
      throw error;
    }
  });
}

/**
 * Validates a DogecoinBalance object
 */
export function validateBalance(balance: any): DogecoinBalance {
  if (!balance || typeof balance !== 'object') {
    throw new ValidationError('Balance must be an object', 'balance', balance);
  }

  const requiredFields = [
    'confirm_amount',
    'pending_amount',
    'amount',
    'confirm_doge_amount',
    'pending_doge_amount',
    'doge_amount',
    'confirm_inscription_amount',
    'pending_inscription_amount',
    'inscription_amount',
    'usd_value'
  ];

  for (const field of requiredFields) {
    if (!(field in balance)) {
      throw new ValidationError(`Missing required field in balance`, field, undefined);
    }

    if (!isValidNumericString(balance[field])) {
      throw new ValidationError(`Invalid numeric value in balance`, field, balance[field]);
    }

    // Additional check for non-negative values
    const numValue = parseFloat(balance[field]);
    if (numValue < 0) {
      throw new ValidationError(`Balance field cannot be negative`, field, balance[field]);
    }
  }

  return balance as DogecoinBalance;
}

/**
 * Validates a transaction history item
 */
export function validateTransaction(tx: any): TxHistoryItem {
  if (!tx || typeof tx !== 'object') {
    throw new ValidationError('Transaction must be an object', 'transaction', tx);
  }

  // Validate txid
  if (!isValidTxid(tx.txid)) {
    throw new ValidationError('Invalid txid in transaction', 'txid', tx.txid);
  }

  // Validate confirmations (must be non-negative integer)
  if (!isPositiveInteger(tx.confirmations)) {
    throw new ValidationError('Invalid confirmations count', 'confirmations', tx.confirmations);
  }

  // Validate height (must be non-negative integer, 0 for unconfirmed)
  if (!isPositiveInteger(tx.height)) {
    throw new ValidationError('Invalid block height', 'height', tx.height);
  }

  // Validate timestamp (must be positive number)
  if (!isNonNegativeNumber(tx.timestamp)) {
    throw new ValidationError('Invalid timestamp', 'timestamp', tx.timestamp);
  }

  // Validate size (must be positive integer)
  if (!isPositiveInteger(tx.size) || tx.size <= 0) {
    throw new ValidationError('Invalid transaction size', 'size', tx.size);
  }

  // Validate fee (must be non-negative number)
  if (!isNonNegativeNumber(tx.fee)) {
    throw new ValidationError('Invalid fee amount', 'fee', tx.fee);
  }

  // Validate feeRate (must be non-negative number)
  if (!isNonNegativeNumber(tx.feeRate)) {
    throw new ValidationError('Invalid fee rate', 'feeRate', tx.feeRate);
  }

  // Validate outputValue (must be non-negative number)
  if (!isNonNegativeNumber(tx.outputValue)) {
    throw new ValidationError('Invalid output value', 'outputValue', tx.outputValue);
  }

  // Validate vin array
  if (!Array.isArray(tx.vin)) {
    throw new ValidationError('Transaction vin must be an array', 'vin', tx.vin);
  }

  // Validate vout array
  if (!Array.isArray(tx.vout)) {
    throw new ValidationError('Transaction vout must be an array', 'vout', tx.vout);
  }

  // Validate types array (optional)
  if (tx.types !== undefined && !Array.isArray(tx.types)) {
    throw new ValidationError('Transaction types must be an array', 'types', tx.types);
  }

  return tx as TxHistoryItem;
}

/**
 * Validates an array of transactions
 */
export function validateTransactions(transactions: any): TxHistoryItem[] {
  if (!Array.isArray(transactions)) {
    throw new ValidationError('Transactions must be an array', 'transactions', transactions);
  }

  return transactions.map((tx, idx) => {
    try {
      return validateTransaction(tx);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ValidationError(
          `Transaction validation failed at index ${idx}: ${error.message}`,
          `transactions[${idx}].${error.field}`,
          error.value
        );
      }
      throw error;
    }
  });
}

/**
 * Safely validates and returns data, logging validation failures
 * but not throwing to avoid breaking the application flow
 */
export function safeValidate<T>(
  data: any,
  validator: (data: any) => T,
  context: string
): T | null {
  try {
    return validator(data);
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error(`[ResponseValidator] Validation failed in ${context}:`, {
        message: error.message,
        field: error.field,
        value: error.value
      });
    } else {
      console.error(`[ResponseValidator] Unknown validation error in ${context}:`, error);
    }
    return null;
  }
}

/**
 * Validates and logs provider response quality
 * Returns validated data or null if validation fails
 */
export function validateProviderResponse<T>(
  data: any,
  validator: (data: any) => T,
  providerName: string,
  endpoint: string
): T | null {
  const context = `${providerName} (${endpoint})`;
  const result = safeValidate(data, validator, context);
  
  if (result === null) {
    console.warn(`[ResponseValidator] Provider ${providerName} returned invalid data from ${endpoint}`);
  }
  
  return result;
}
