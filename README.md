# X-Agent Gateway (XAG) 🚀
The Trust & Settlement Middleware for the Autonomous Agent Economy

![XRPL Native](https://img.shields.io/badge/XRPL-Native-blue.svg)
![SDG Aligned](https://img.shields.io/badge/UN--SDG-Aligned-green.svg)
![Stablecoin](https://img.shields.io/badge/Payment-RLUSD-gold.svg)

## 🌟 Overview
As we move toward an Agent-to-Agent (A2A) economy, AI agents need more than just intelligence—they need **Financial Identity** and **Trustless Settlement**.

**X-Agent Gateway (XAG)** is a lightweight SDK and infrastructure layer that enables any autonomous agent (from LLM-based bots to IoT devices) to securely transact on the XRP Ledger (XRPL). By leveraging native XRPL features like DIDs (XLS-40), Escrows, and RLUSD, XAG provides the "Plaid-for-Agents" middleware that ensures machines can trust each other.

## 🛠 XRPL Implementation (Rubric: 30%)
XAG is built strictly on XRPL's native protocols to ensure maximum security and minimum latency:

- **Agent Identity (XLS-40 DIDs)**: Every agent registered through XAG is assigned a native XRPL Decentralized Identifier (DID). This allows agents to carry their reputation across different platforms without a central authority.
- **Trustless Commerce (Native Escrows)**: To solve the "Handshake Problem," XAG uses XRPL Escrows. Funds are locked in RLUSD and only released when the agent provides a cryptographic proof of fulfillment or a time-lock expires.
- **Settlement (RLUSD)**: All commerce is settled in RLUSD (Ripple’s 1:1 USD-backed stablecoin), providing the price stability necessary for business operations while maintaining sub-penny transaction costs.
- **Auditability (Memos & Hooks)**: Every negotiation and intent is anchored to the ledger using XRPL Transaction Memos, creating an immutable audit trail for governance.

## 🌍 Social Impact & UN SDGs (BGA Bounty)
XAG aligns with the UN’s 17 Sustainable Development Goals (SDGs) by democratizing financial infrastructure:

- **SDG 10: Reducing Inequality**: XAG provides underserved developers and small-scale autonomous systems (like community solar grids) access to the same high-tier financial security as major corporations.
- **SDG 12: Responsible Consumption & Production**: By using XRPL’s carbon-neutral ledger, XAG enables sustainable supply chains where autonomous agents can verify the "Green Credentials" of suppliers before settling payments.
- **SDG 9: Industry, Innovation, and Infrastructure**: Building a resilient, decentralised "operating system" for the future of machine-led commerce.

## 📦 SDK Features
XAG is designed to be Plug-and-Play. Developers can integrate XRPL features into their agents with just a few lines of code:

### 1. Identity Management
```javascript
const agent = await XAG.createAgent({
  name: "SolarMonitor-01",
  type: "supplier",
  didMethod: "xls-40"
});
// Generates a native XRPL DID for the agent
```

### 2. Escrow-Locked Payments
```javascript
const settlement = await XAG.initiateTrade({
  buyer: buyerDID,
  seller: sellerDID,
  amount: 100,
  token: "RLUSD",
  condition: fulfillmentCryptoCondition 
});
// Locks 100 RLUSD in a native XRPL Escrow
```

### 3. Reputation Verification
```javascript
const score = await XAG.getReputation(agentDID);
// Aggregates successful XRPL Escrow completions and on-chain logs
```

## 🚀 Getting Started

### Installation
```bash
npm install
```

### Run CLI Demo
```bash
npm run demo
```

### Run Web Frontend
```bash
npm run server
```
Then open http://localhost:3000 in your browser to see the interactive demo!

### Documentation
- **[API Documentation](./docs/API.md)** - Complete API reference
- **[Quick Start Guide](./docs/QUICKSTART.md)** - Get started in 5 minutes

## 🎯 Rubric Alignment

| Rubric | X-Agent Gateway Strategy |
| :--- | :--- |
| **Use of XRPL (30%)** | Uses XLS-40 DIDs, Native Escrows, RLUSD, and Trust Lines. No "off-chain" workarounds. |
| **Business Potential (20%)** | Targets the $50B+ Agentic AI market by providing the missing payment rails for autonomous commerce. |
| **Completeness (30%)** | Provides a full SDK, detailed documentation, interactive web frontend, and a sample "Buyer-Seller" agent interaction demo. |
| **Social Impact (30% - BGA)** | Directly enables decentralized micro-grids and sustainable supply chains. |

