/** ÐogeTreats wire marker — see dogenals/spec/protocols/treats */
export const TREATS_PROTOCOL_ID = 'dt';

/** Paired dust output for deploy / mint / transfer (0.01 DOGE). */
export const TREATS_DUST_KOINU = 1_000_000;

/** Full OP_RETURN script cap per spec. */
export const TREATS_MAX_OPRETURN_SCRIPT_BYTES = 80;

export const TREATS_RESERVED_TICKERS = new Set(['doge', 'treat', 'dt']);

export type TreatsOpKind = 'deploy' | 'mint' | 'transfer' | 'burn';
