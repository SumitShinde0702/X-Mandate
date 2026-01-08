# X-Agent Gateway (XAG) - API Documentation

## Overview
XAG is a TypeScript SDK for autonomous agents to interact with the XRP Ledger (XRPL). It provides identity management, escrow-based payments, and reputation tracking.

## Installation
```bash
npm install xrpl dotenv
```

## Quick Start
```typescript
import { XAG } from './src/XAG';

const xag = new XAG(); // Connects to XRPL Testnet by default
await xag.connect();
```

---

## Core Classes

### `XAG`
Main SDK class for interacting with XRPL.

#### Constructor
```typescript
constructor(network?: string)
```
- `network` (optional): XRPL network URL. Default: `'wss://s.altnet.rippletest.net:51233'` (Testnet)

#### Methods

##### `createAgent(config: AgentConfig): Promise<Agent>`
Creates a new agent with XLS-40 DID registration.

**Parameters:**
- `config.name`: Agent name (string)
- `config.type`: Agent type - `'buyer' | 'seller' | 'supplier' | 'consumer'` (string)
- `config.didMethod`: DID method (optional, defaults to 'xls-40')
- `config.seed`: Wallet seed (optional, auto-generated if not provided)

**Returns:** `Promise<Agent>`
- `address`: XRPL address
- `seed`: Wallet seed (keep secure!)
- `did`: Decentralized Identifier (DID)
- `config`: Original config

**Example:**
```typescript
const agent = await xag.createAgent({
  name: "SolarMonitor-01",
  type: "supplier",
  didMethod: "xls-40"
});
console.log(agent.did); // did:xrpl:1:r...
```

---

##### `initiateTrade(config: TradeConfig, buyerSeed?: string): Promise<TradeResult>`
Initiates a trade with escrow-locked payments (XRP) or direct payment (RLUSD).

**Parameters:**
- `config.buyer`: Buyer DID or address (string)
- `config.seller`: Seller DID or address (string)
- `config.amount`: Amount to trade (number)
- `config.token`: Token type - `'RLUSD' | 'XRP'` (string)
- `config.condition`: Cryptographic condition (optional, string)
- `config.finishAfter`: Ripple epoch timestamp for time-lock (optional, number)
- `config.cancelAfter`: Ripple epoch timestamp for cancellation (optional, number)
- `config.memo`: Transaction memo for auditability (optional, string)
- `buyerSeed`: Buyer wallet seed (optional if agent was created via XAG)

**Returns:** `Promise<TradeResult>`
- `hash`: Transaction hash
- `sequence`: Transaction sequence
- `amount`: Trade amount
- `token`: Token type
- `buyer`: Buyer address
- `seller`: Seller address

**Example:**
```typescript
const settlement = await xag.initiateTrade({
  buyer: buyerDID,
  seller: sellerDID,
  amount: 100,
  token: "RLUSD",
  condition: fulfillmentCryptoCondition,
  memo: "Solar panel purchase"
}, buyerAgent.seed);
```

**Notes:**
- For XRP: Uses native XRPL Escrow (time-locked)
- For RLUSD: Uses Payment transaction (immediate, no native escrow support)

---

##### `fulfillTrade(escrowHash: string, sellerDID: string, token?: 'RLUSD' | 'XRP', sellerSeed?: string): Promise<string>`
Fulfills a trade by completing an escrow (XRP) or verifying payment (RLUSD).

**Parameters:**
- `escrowHash`: Transaction hash of the escrow/payment (string)
- `sellerDID`: Seller DID or address (string)
- `token`: Token type - `'RLUSD' | 'XRP'` (optional, defaults to 'XRP')
- `sellerSeed`: Seller wallet seed (optional if agent was created via XAG)

**Returns:** `Promise<string>` - Transaction hash of the fulfillment

**Example:**
```typescript
const fulfillmentHash = await xag.fulfillTrade(
  trade.hash,
  sellerAgent.did,
  "XRP",
  sellerAgent.seed
);
```

---

##### `getReputation(agentDID: string): Promise<ReputationResult>`
Gets reputation score for an agent based on on-chain transaction history.

**Parameters:**
- `agentDID`: Agent DID or address (string)

**Returns:** `Promise<ReputationResult>`
- `did`: Agent DID
- `address`: XRPL address
- `score`: Reputation score (10 points per successful trade)
- `successfulTrades`: Total successful trades
- `escrowCreates`: Number of successful EscrowCreate transactions
- `escrowFinishes`: Number of successful EscrowFinish transactions
- `payments`: Number of successful Payment transactions

**Example:**
```typescript
const score = await xag.getReputation(agentDID);
console.log(`Reputation: ${score.score} points`);
console.log(`Successful trades: ${score.successfulTrades}`);
```

---

##### `log(message: string, level?: 'info' | 'success' | 'warn' | 'error', agentDID: string, agentSeed?: string): Promise<string>`
Logs a message to the blockchain using XRPL Transaction Memos. Creates an immutable audit trail for A2A communication.

**Parameters:**
- `message`: Log message (string)
- `level`: Log level - `'info' | 'success' | 'warn' | 'error'` (optional, defaults to 'info')
- `agentDID`: Agent DID or address (string)
- `agentSeed`: Agent wallet seed (optional if agent was created via XAG)

**Returns:** `Promise<string>` - Transaction hash

**Example:**
```typescript
// Log agent interaction
await xag.log("Agent interaction started", "info", agent.did, agent.seed);
await xag.log("Trade completed successfully", "success", agent.did, agent.seed);
await xag.log("Warning: Low balance", "warn", agent.did, agent.seed);
```

**Note:** Uses XRPL Transaction Memos to store log data. Creates a minimal self-payment transaction (1 drop = 0.000001 XRP) to ensure the log is permanently recorded on-chain.

---

##### `getLogs(agentDID: string, limit?: number): Promise<Array<LogEntry>>`
Retrieves logs from blockchain for an agent by parsing transaction memos.

**Parameters:**
- `agentDID`: Agent DID or address (string)
- `limit`: Maximum number of logs to retrieve (optional, defaults to 50)

**Returns:** `Promise<Array<LogEntry>>`
- `message`: Log message
- `level`: Log level
- `timestamp`: ISO timestamp
- `txHash`: Transaction hash

**Example:**
```typescript
const logs = await xag.getLogs(agent.did, 20);
logs.forEach(log => {
  console.log(`[${log.level}] ${log.message} - ${log.timestamp}`);
});
```

---

##### `getTransactionHistory(agentDID: string, limit?: number): Promise<Array<Transaction>>`
Gets transaction history for an agent.

**Parameters:**
- `agentDID`: Agent DID or address (string)
- `limit`: Maximum number of transactions (optional, defaults to 50)

**Returns:** `Promise<Array<Transaction>>`
- `hash`: Transaction hash
- `type`: Transaction type
- `result`: Transaction result
- `timestamp`: ISO timestamp (if available)

**Example:**
```typescript
const history = await xag.getTransactionHistory(agent.did);
history.forEach(tx => {
  console.log(`${tx.type}: ${tx.result} - ${tx.hash}`);
});
```

---

##### `log(message: string, level?: 'info' | 'success' | 'warn' | 'error', agentDID: string, agentSeed?: string): Promise<string>`
Logs a message to the blockchain using XRPL Transaction Memos. Creates an immutable audit trail for A2A communication.

**Parameters:**
- `message`: Log message (string)
- `level`: Log level - `'info' | 'success' | 'warn' | 'error'` (optional, defaults to 'info')
- `agentDID`: Agent DID or address (string)
- `agentSeed`: Agent wallet seed (optional if agent was created via XAG)

**Returns:** `Promise<string>` - Transaction hash

**Example:**
```typescript
// Log agent interaction
await xag.log("Agent interaction started", "info", agent.did, agent.seed);
await xag.log("Trade completed successfully", "success", agent.did, agent.seed);
await xag.log("Warning: Low balance", "warn", agent.did, agent.seed);
await xag.log("Error: Connection failed", "error", agent.did, agent.seed);
```

**Note:** Uses XRPL Transaction Memos to store log data. Creates a Payment transaction to a sink address (1 drop = 0.000001 XRP) to ensure the log is permanently recorded on-chain. Each log entry is unique and cannot be rejected as redundant.

---

##### `getLogs(agentDID: string, limit?: number): Promise<Array<LogEntry>>`
Retrieves logs from blockchain for an agent by parsing transaction memos.

**Parameters:**
- `agentDID`: Agent DID or address (string)
- `limit`: Maximum number of logs to retrieve (optional, defaults to 50)

**Returns:** `Promise<Array<LogEntry>>`
- `message`: Log message
- `level`: Log level
- `timestamp`: ISO timestamp
- `txHash`: Transaction hash

**Example:**
```typescript
const logs = await xag.getLogs(agent.did, 20);
logs.forEach(log => {
  console.log(`[${log.level}] ${log.message} - ${log.timestamp}`);
  console.log(`Transaction: ${log.txHash}`);
});
```

---

##### `getTransactionHistory(agentDID: string, limit?: number): Promise<Array<Transaction>>`
Gets transaction history for an agent.

**Parameters:**
- `agentDID`: Agent DID or address (string)
- `limit`: Maximum number of transactions (optional, defaults to 50)

**Returns:** `Promise<Array<Transaction>>`
- `hash`: Transaction hash
- `type`: Transaction type (e.g., 'Payment', 'EscrowCreate', 'EscrowFinish')
- `result`: Transaction result (e.g., 'tesSUCCESS')
- `timestamp`: ISO timestamp (if available)

**Example:**
```typescript
const history = await xag.getTransactionHistory(agent.did, 100);
history.forEach(tx => {
  console.log(`${tx.type}: ${tx.result} - ${tx.hash}`);
  if (tx.timestamp) {
    console.log(`Time: ${tx.timestamp}`);
  }
});
```

---

##### `updateProfile(agentDID: string, profile: AgentProfile, agentSeed?: string): Promise<string>`
Updates an agent's profile metadata (capabilities, pricing, availability) stored on-chain using DIDSet Data field.

**Parameters:**
- `agentDID`: Agent DID or address (string)
- `profile`: Profile object with capabilities, pricing, availability, etc. (AgentProfile)
- `agentSeed`: Agent wallet seed (optional if agent was created via XAG)

**Returns:** `Promise<string>` - Transaction hash of the profile update

**Example:**
```typescript
await xag.updateProfile(agent.did, {
  capabilities: ['solar-energy', 'data-analysis'],
  pricing: {
    currency: 'RLUSD',
    rate: 0.10,
    unit: 'kWh'
  },
  availability: {
    status: 'available',
    hours: '9am-5pm UTC'
  },
  description: 'Solar energy supplier with data analytics capabilities'
}, agent.seed);
```

**Note:** Profile data is stored in the DIDSet Data field on-chain, making it publicly accessible and verifiable.

---

##### `getProfile(agentDID: string): Promise<AgentProfile | null>`
Retrieves an agent's profile from the blockchain.

**Parameters:**
- `agentDID`: Agent DID or address (string)

**Returns:** `Promise<AgentProfile | null>` - Profile object or null if not found

**Example:**
```typescript
const profile = await xag.getProfile(agent.did);
if (profile) {
  console.log(`Capabilities: ${profile.capabilities?.join(', ')}`);
  console.log(`Pricing: ${profile.pricing?.rate} ${profile.pricing?.currency}/${profile.pricing?.unit}`);
}
```

---

##### `verifyAgent(agentDID: string, requirements?: object): Promise<VerificationResult>`
Verifies an agent's credentials and claims via DIDs. Checks identity, reputation, profile, and credentials.

**Parameters:**
- `agentDID`: Agent DID or address (string)
- `requirements` (optional): Verification requirements object
  - `minReputation`: Minimum reputation score required (number)
  - `requireProfile`: Whether profile is required (boolean)
  - `requiredCapabilities`: Array of required capabilities (string[])

**Returns:** `Promise<VerificationResult>`
- `agentDID`: Agent DID
- `verified`: Whether agent meets all requirements (boolean)
- `claims`: Object with identity, reputation, profile, and credentials checks
- `score`: Overall verification score (0-100)

**Example:**
```typescript
const verification = await xag.verifyAgent(agent.did, {
  minReputation: 50,
  requireProfile: true,
  requiredCapabilities: ['solar-energy']
});
console.log(`Verified: ${verification.verified}`);
console.log(`Score: ${verification.score}/100`);
```

---

##### `broadcastIntent(agentDID: string, intent: Intent, agentSeed?: string): Promise<string>`
Broadcasts an intent (offer or request) to the blockchain. Agents can announce what they want or offer.

**Parameters:**
- `agentDID`: Agent DID or address (string)
- `intent`: Intent object
  - `type`: 'offer' | 'request' (string)
  - `category`: Category (e.g., "energy", "data", "service") (string)
  - `description`: Description of the intent (string)
  - `terms`: Optional terms object (price, currency, duration, conditions)
- `agentSeed`: Agent wallet seed (optional if agent was created via XAG)

**Returns:** `Promise<string>` - Transaction hash of the intent broadcast

**Example:**
```typescript
const hash = await xag.broadcastIntent(agent.did, {
  type: 'offer',
  category: 'energy',
  description: 'Selling solar energy at competitive rates',
  terms: {
    price: 0.10,
    currency: 'RLUSD',
    unit: 'kWh'
  }
}, agent.seed);
console.log(`Intent broadcasted: ${hash}`);
```

**Note:** Intents are stored in transaction memos and can be searched by other agents.

---

##### `searchIntents(criteria: object): Promise<Array<Intent>>`
Searches for intents broadcasted by agents on the blockchain.

**Parameters:**
- `criteria.type`: Filter by intent type - 'offer' | 'request' (optional, string)
- `criteria.category`: Filter by category (optional, string)
- `criteria.agentDID`: Filter by agent DID (optional, string)
- `criteria.limit`: Maximum results (optional, defaults to 50, number)

**Returns:** `Promise<Array<Intent>>` - Array of Intent objects matching the criteria

**Example:**
```typescript
const intents = await xag.searchIntents({
  type: 'offer',
  category: 'energy',
  limit: 20
});
intents.forEach(intent => {
  console.log(`${intent.type}: ${intent.description}`);
});
```

---

##### `initiateNegotiation(initiatorDID: string, participantDID: string, initialOffer: object, initiatorSeed?: string): Promise<{negotiationId: string, txHash: string}>`
Initiates a multi-step negotiation between two agents with on-chain state tracking.

**Parameters:**
- `initiatorDID`: Initiator agent DID (string)
- `participantDID`: Participant agent DID (string)
- `initialOffer`: Initial offer terms object (amount, currency, description, etc.)
- `initiatorSeed`: Initiator wallet seed (optional if agent was created via XAG)

**Returns:** `Promise<{negotiationId: string, txHash: string}>`
- `negotiationId`: Unique negotiation identifier
- `txHash`: Transaction hash of the initiation

**Example:**
```typescript
const result = await xag.initiateNegotiation(
  buyerAgent.did,
  sellerAgent.did,
  {
    amount: 100,
    currency: 'RLUSD',
    description: 'Initial offer for solar panel purchase'
  },
  buyerAgent.seed
);
console.log(`Negotiation ID: ${result.negotiationId}`);
```

---

##### `counterOffer(negotiationId: string, originalTxHash: string, responderDID: string, action: 'counter' | 'accept' | 'reject', counterTerms?: object, responderSeed?: string): Promise<string>`
Responds to a negotiation with a counter-offer, acceptance, or rejection.

**Parameters:**
- `negotiationId`: Negotiation identifier (string)
- `originalTxHash`: Original transaction hash (string)
- `responderDID`: Responder agent DID (string)
- `action`: Response action - 'counter' | 'accept' | 'reject' (string)
- `counterTerms`: Counter-offer terms object (required if action is 'counter', optional otherwise)
- `responderSeed`: Responder wallet seed (optional if agent was created via XAG)

**Returns:** `Promise<string>` - Transaction hash of the counter-offer

**Example:**
```typescript
const hash = await xag.counterOffer(
  negotiationId,
  originalTxHash,
  sellerAgent.did,
  'counter',
  {
    amount: 120,
    currency: 'RLUSD',
    description: 'Counter-offer with premium features'
  },
  sellerAgent.seed
);
```

---

##### `getNegotiation(negotiationId: string, participantDID: string): Promise<Negotiation | null>`
Retrieves the current state of a negotiation from the blockchain.

**Parameters:**
- `negotiationId`: Negotiation identifier (string)
- `participantDID`: Participant agent DID (for access control) (string)

**Returns:** `Promise<Negotiation | null>`
- `negotiationId`: Negotiation identifier
- `participants`: Array of participant DIDs
- `status`: Current status ('initiated' | 'counter-offer' | 'accepted' | 'rejected' | 'completed')
- `currentOffer`: Current offer details
- `history`: Array of negotiation steps with timestamps and transaction hashes

**Example:**
```typescript
const negotiation = await xag.getNegotiation(negotiationId, agent.did);
if (negotiation) {
  console.log(`Status: ${negotiation.status}`);
  console.log(`Steps: ${negotiation.history.length}`);
  negotiation.history.forEach(step => {
    console.log(`Step ${step.step}: ${step.action} by ${step.from}`);
  });
}
```

---

##### `connect(): Promise<void>`
Connects to the XRPL network.

##### `disconnect(): Promise<void>`
Disconnects from the XRPL network.

---

## Type Definitions

### `AgentConfig`
```typescript
interface AgentConfig {
  name: string;
  type: 'buyer' | 'seller' | 'supplier' | 'consumer';
  didMethod?: string;
  seed?: string;
}
```

### `Agent`
```typescript
interface Agent {
  address: string;
  seed?: string;
  did: string;
  config: AgentConfig;
}
```

### `TradeConfig`
```typescript
interface TradeConfig {
  buyer: string; // DID or address
  seller: string; // DID or address
  amount: number;
  token: 'RLUSD' | 'XRP';
  condition?: string;
  finishAfter?: number; // Ripple epoch timestamp
  cancelAfter?: number; // Ripple epoch timestamp
  memo?: string; // Transaction memo
}
```

### `TradeResult`
```typescript
interface TradeResult {
  hash: string;
  sequence: number;
  amount: number;
  token: string;
  buyer: string;
  seller: string;
}
```

### `ReputationResult`
```typescript
interface ReputationResult {
  did: string;
  address: string;
  score: number;
  successfulTrades: number;
  escrowCreates: number;
  escrowFinishes: number;
  payments: number;
}
```

### `LogEntry`
```typescript
interface LogEntry {
  message: string;
  level: 'info' | 'success' | 'warn' | 'error';
  timestamp: string;
  txHash: string;
}
```

### `Transaction`
```typescript
interface Transaction {
  hash: string;
  type: string;
  result: string;
  timestamp?: string;
}
```

### `AgentProfile`
```typescript
interface AgentProfile {
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
```

### `VerificationResult`
```typescript
interface VerificationResult {
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
```

### `Intent`
```typescript
interface Intent {
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
```

### `Negotiation`
```typescript
interface Negotiation {
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
```

---

## Complete Example

```typescript
import { XAG } from './src/XAG';

async function example() {
  const xag = new XAG();
  
  try {
    // 1. Create agents
    const buyer = await xag.createAgent({
      name: "AutoBuyer",
      type: "consumer",
      didMethod: "xls-40"
    });
    
    const seller = await xag.createAgent({
      name: "SolarSupplier",
      type: "supplier",
      didMethod: "xls-40"
    });
    
    // 2. Initiate trade
    const trade = await xag.initiateTrade({
      buyer: buyer.did,
      seller: seller.did,
      amount: 100,
      token: "XRP",
      memo: "Solar panel purchase"
    }, buyer.seed);
    
    // 3. Wait for time-lock (if XRP escrow)
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // 4. Fulfill trade
    await xag.fulfillTrade(trade.hash, seller.did, "XRP", seller.seed);
    
    // 5. Check reputation
    const reputation = await xag.getReputation(buyer.did);
    console.log(`Buyer reputation: ${reputation.score}`);
    
    // 6. Update agent profile
    await xag.updateProfile(seller.did, {
      capabilities: ['solar-energy', 'data-analysis'],
      pricing: { currency: 'RLUSD', rate: 0.10, unit: 'kWh' },
      availability: { status: 'available', hours: '9am-5pm UTC' }
    }, seller.seed);
    
    // 7. Verify agent
    const verification = await xag.verifyAgent(seller.did);
    console.log(`Agent verified: ${verification.verified}, Score: ${verification.score}/100`);
    
    // 8. Broadcast intent
    await xag.broadcastIntent(seller.did, {
      type: 'offer',
      category: 'energy',
      description: 'Selling solar energy',
      terms: { price: 0.10, currency: 'RLUSD' }
    }, seller.seed);
    
    // 9. Search intents
    const intents = await xag.searchIntents({ type: 'offer', category: 'energy' });
    console.log(`Found ${intents.length} intents`);
    
    // 10. Start negotiation
    const negotiation = await xag.initiateNegotiation(
      buyer.did,
      seller.did,
      { amount: 100, currency: 'RLUSD', description: 'Initial offer' },
      buyer.seed
    );
    
    // 11. View negotiation
    const negotiationState = await xag.getNegotiation(negotiation.negotiationId, buyer.did);
    console.log(`Negotiation status: ${negotiationState?.status}`);
    
  } finally {
    await xag.disconnect();
  }
}
```

---

## XRPL Features Used

1. **XLS-40 DIDs**: Decentralized identifiers for agent identity
2. **Native Escrows**: Time-locked XRP escrows for trustless commerce
3. **RLUSD Payments**: Stablecoin payments via TrustLines
4. **Transaction Memos**: Immutable audit trail for all transactions
5. **DIDSet Data Field**: On-chain storage for agent profiles
6. **Intent Broadcasting**: Agents announce offers/requests via memos
7. **Negotiation State**: Multi-step negotiation tracking on-chain

---

## Network Configuration

### Testnet (Default)
```typescript
const xag = new XAG('wss://s.altnet.rippletest.net:51233');
```

### Mainnet
```typescript
const xag = new XAG('wss://xrplcluster.com');
```

---

## Error Handling

All methods throw errors that should be caught:

```typescript
try {
  const agent = await xag.createAgent({ name: "Test", type: "consumer" });
} catch (error) {
  console.error('Failed to create agent:', error.message);
}
```

Common errors:
- `Insufficient balance`: Not enough XRP/RLUSD for transaction
- `Wallet not found`: Agent not created or seed not provided
- `Escrow not found`: Escrow already completed or invalid hash

---

## Security Notes

⚠️ **Never commit wallet seeds to version control!**
- Store seeds securely (environment variables, secure vaults)
- Use testnet for development
- Always verify transaction hashes on XRPL explorer

