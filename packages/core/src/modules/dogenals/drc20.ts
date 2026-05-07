import { DRC20Operation, DRC20Deploy, DRC20Mint, DRC20Transfer } from './types';

export function isDRC20Operation(obj: any): obj is DRC20Operation {
  return obj && typeof obj === 'object' && obj.p === 'drc-20';
}

export function validateDRC20Deploy(op: DRC20Deploy): boolean {
  if (op.op !== 'deploy') return false;
  if (!op.tick || typeof op.tick !== 'string' || op.tick.length < 1 || op.tick.length > 4) return false;
  if (!/^[a-zA-Z0-9]+$/.test(op.tick)) return false;
  if (!op.max || isNaN(Number(op.max)) || Number(op.max) <= 0) return false;
  if (op.lim && (isNaN(Number(op.lim)) || Number(op.lim) <= 0 || Number(op.lim) > Number(op.max))) return false;
  return true;
}

export function validateDRC20Mint(op: DRC20Mint): boolean {
  if (op.op !== 'mint') return false;
  if (!op.tick || typeof op.tick !== 'string') return false;
  if (!op.amt || isNaN(Number(op.amt)) || Number(op.amt) <= 0) return false;
  return true;
}

export function validateDRC20Transfer(op: DRC20Transfer): boolean {
  if (op.op !== 'transfer') return false;
  if (!op.tick || typeof op.tick !== 'string') return false;
  if (!op.amt || isNaN(Number(op.amt)) || Number(op.amt) <= 0) return false;
  return true;
}

export function validateDRC20Operation(op: DRC20Operation): boolean {
  if (!isDRC20Operation(op)) return false;
  switch (op.op) {
    case 'deploy':
      return validateDRC20Deploy(op);
    case 'mint':
      return validateDRC20Mint(op);
    case 'transfer':
      return validateDRC20Transfer(op);
    default:
      return false;
  }
}

export function normalizeTicker(tick: string): string {
  return tick.toLowerCase();
}

export function createDRC20Deploy(tick: string, max: number, lim?: number): DRC20Deploy {
  return {
    p: 'drc-20',
    op: 'deploy',
    tick: normalizeTicker(tick),
    max: max.toString(),
    ...(lim && { lim: lim.toString() }),
  };
}

export function createDRC20Mint(tick: string, amt: number): DRC20Mint {
  return {
    p: 'drc-20',
    op: 'mint',
    tick: normalizeTicker(tick),
    amt: amt.toString(),
  };
}

export function createDRC20Transfer(tick: string, amt: number): DRC20Transfer {
  return {
    p: 'drc-20',
    op: 'transfer',
    tick: normalizeTicker(tick),
    amt: amt.toString(),
  };
}