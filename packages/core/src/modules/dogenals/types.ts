export interface DRC20Deploy {
  p: 'drc-20';
  op: 'deploy';
  tick: string;
  max: string;
  lim?: string;
}

export interface DRC20Mint {
  p: 'drc-20';
  op: 'mint';
  tick: string;
  amt: string;
}

export interface DRC20Transfer {
  p: 'drc-20';
  op: 'transfer';
  tick: string;
  amt: string;
}

export type DRC20Operation = DRC20Deploy | DRC20Mint | DRC20Transfer;

export interface DRC20Token {
  tick: string;
  maxSupply: number;
  mintLimit?: number;
  totalMinted: number;
  deployHeight: number;
  deployTxid: string;
  deployer: string;
}

export interface DRC20Balance {
  address: string;
  tick: string;
  available: number;
  transferable: number;
  total: number;
}