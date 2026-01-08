# AI Context: X-Agent Gateway (XAG)

## Project Goals
XAG is a middleware SDK for autonomous agents to interact with the XRP Ledger (XRPL). It focuses on:
1. **Identity**: Using XLS-40 DIDs for agent identification and reputation.
2. **Settlement**: Using RLUSD (Ripple Stablecoin) for stable payments.
3. **Escrow**: Using native XRPL Escrows for trustless A2A (Agent-to-Agent) commerce.
4. **Auditability**: Using Memos to store transaction context/intent.

## Technical Architecture
- **Language**: TypeScript/Node.js
- **Blockchain**: XRPL (Testnet/Mainnet)
- **Library**: `xrpl.js`
- **Key Features**:
    - `XAG.createAgent()`: Handles wallet creation and DID (XLS-40) registration.
    - `XAG.initiateTrade()`: Creates an Escrow transaction with RLUSD.
    - `XAG.fulfillTrade()`: Completes the Escrow with a fulfillment condition.
    - `XAG.getReputation()`: Queries ledger history for an agent's successful transactions.

## Development Priorities
1. **Fast Prototyping**: Minimalist SDK that wraps `xrpl.js` calls.
2. **XLS-40 Compliance**: Ensure DID implementation follows the standard.
3. **RLUSD Support**: Handle TrustLines and issued currencies for RLUSD.
4. **Demo Scenarios**: A script showing a buyer agent and a seller agent completing a transaction via escrow.

## Known Constraints
- Use Testnet for development.
- RLUSD issuer address needs to be configured for Testnet.
- XLS-40 is relatively new; ensure current `xrpl.js` or manual transaction blobs are used if necessary.

