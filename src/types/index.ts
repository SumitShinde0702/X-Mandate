export interface AgentConfig {
  name: string;
  type: 'buyer' | 'seller' | 'supplier' | 'consumer';
  didMethod?: string;
  seed?: string;
  profile?: AgentProfile;
}

export interface AgentProfile {
  capabilities?: string[]; // e.g., ["solar-energy", "data-analysis"]
  pricing?: {
    currency: 'XRP' | 'RLUSD';
    rate: number; // per unit or per hour
    unit?: string; // "kWh", "hour", "transaction"
  };
  availability?: {
    status: 'available' | 'busy' | 'offline';
    hours?: string; // "9am-5pm UTC"
  };
  description?: string;
  contact?: {
    email?: string;
    website?: string;
  };
  metadata?: Record<string, any>; // Additional custom fields
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

export interface Intent {
  agentDID: string;
  type: 'offer' | 'request';
  category: string; // e.g., "energy", "data", "service"
  description: string;
  terms?: {
    price?: number;
    currency?: 'XRP' | 'RLUSD';
    duration?: string;
    conditions?: string[];
  };
  timestamp: string;
  txHash?: string;
  status?: 'active' | 'fulfilled' | 'cancelled';
}

export interface Negotiation {
  negotiationId: string;
  participants: string[]; // Agent DIDs
  status: 'initiated' | 'counter-offer' | 'accepted' | 'rejected' | 'completed';
  currentOffer: {
    from: string;
    to: string;
    terms: any;
    timestamp: string;
  };
  history: Array<{
    step: number;
    from: string;
    action: 'offer' | 'counter' | 'accept' | 'reject';
    terms: any;
    timestamp: string;
    txHash: string;
  }>;
}

export interface VerificationResult {
  agentDID: string;
  verified: boolean;
  claims: {
    identity?: boolean; // DID is valid
    reputation?: boolean; // Has minimum reputation
    profile?: boolean; // Profile exists and is valid
    credentials?: Array<{
      type: string;
      verified: boolean;
      source: string;
    }>;
  };
  score: number; // Overall verification score 0-100
}

export const RLUSD_ISSUER_TESTNET = 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH'; // Testnet RLUSD issuer (example)
export const RLUSD_CURRENCY_CODE = 'RLUSD';

