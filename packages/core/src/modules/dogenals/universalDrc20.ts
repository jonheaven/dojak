// Universal DRC-20 uses the same JSON as DRC-20 but in OP_RETURN instead of inscriptions
// Validation is similar, but container is OP_RETURN with 80-byte limit

import { DRC20Operation, DRC20Deploy, DRC20Mint, DRC20Transfer } from './types';

export function isUniversalDRC20Operation(obj: any): obj is DRC20Operation {
  // Same as DRC-20, but detected in OP_RETURN
  return obj && typeof obj === 'object' && obj.p === 'drc-20';
}

export function validateUniversalDRC20Deploy(op: DRC20Deploy): boolean {
  // Same rules as DRC-20
  return validateDRC20Deploy(op);
}

export function validateUniversalDRC20Mint(op: DRC20Mint): boolean {
  return validateDRC20Mint(op);
}

export function validateUniversalDRC20Transfer(op: DRC20Transfer): boolean {
  return validateDRC20Transfer(op);
}

export function validateUniversalDRC20Operation(op: DRC20Operation): boolean {
  if (!isUniversalDRC20Operation(op)) return false;
  switch (op.op) {
    case 'deploy':
      return validateUniversalDRC20Deploy(op);
    case 'mint':
      return validateUniversalDRC20Mint(op);
    case 'transfer':
      return validateUniversalDRC20Transfer(op);
    default:
      return false;
  }
}

export function createUniversalDRC20Deploy(tick: string, max: number, lim?: number): DRC20Deploy {
  return createDRC20Deploy(tick, max, lim);
}

export function createUniversalDRC20Mint(tick: string, amt: number): DRC20Mint {
  return createDRC20Mint(tick, amt);
}

export function createUniversalDRC20Transfer(tick: string, amt: number): DRC20Transfer {
  return createDRC20Transfer(tick, amt);
}

// Import from drc20.ts for reuse
import { validateDRC20Deploy, validateDRC20Mint, validateDRC20Transfer, createDRC20Deploy, createDRC20Mint, createDRC20Transfer } from './drc20';