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

