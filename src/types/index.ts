export interface AgentConfig {
  name: string;
  type: 'buyer' | 'seller' | 'supplier' | 'consumer';
  didMethod?: string;
  seed?: string;
}

export interface Agent {
  address: string;
  seed?: string;
  did: string;
  config: AgentConfig;
}

export interface TradeConfig {
  buyer: string; // DID or address
  seller: string; // DID or address
  amount: number;
  token: 'RLUSD' | 'XRP';
  condition?: string;
  finishAfter?: number; // Ripple epoch timestamp
  cancelAfter?: number; // Ripple epoch timestamp
  memo?: string; // Transaction memo for auditability
}

export interface TradeResult {
  hash: string;
  sequence: number;
  amount: number;
  token: string;
  buyer: string;
  seller: string;
}

export interface ReputationResult {
  did: string;
  address: string;
  score: number;
  successfulTrades: number;
  escrowCreates: number;
  escrowFinishes: number;
  payments: number;
}

export const RLUSD_ISSUER_TESTNET = 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH'; // Testnet RLUSD issuer (example)
export const RLUSD_CURRENCY_CODE = 'RLUSD';

