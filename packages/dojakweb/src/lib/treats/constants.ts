/** ÐogeTreats wire marker — see dogenals/spec/protocols/treats */
export const TREATS_PROTOCOL_ID = 'dt';

/** Paired dust output for deploy / mint / transfer (0.01 DOGE). */
export const TREATS_DUST_KOINU = 1_000_000;

/** Full OP_RETURN script cap — Dogecoin Core `MAX_OP_RETURN_RELAY`. */
export const TREATS_MAX_OPRETURN_SCRIPT_BYTES = 83;

export const TREATS_TICKER_MIN = 1;
export const TREATS_TICKER_MAX = 8;

export type TreatsOpKind = 'deploy' | 'mint' | 'transfer' | 'burn';
