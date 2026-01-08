# X-Agent Gateway (XAG) - Quick Start Guide

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
Then open http://localhost:3000 in your browser.

---

## 📚 Documentation

- **[API Documentation](./docs/API.md)** - Complete API reference
- **[README](./README.md)** - Project overview and features

---

## 🎯 Quick Examples

### Create an Agent
```typescript
import { XAG } from './src/XAG';

const xag = new XAG();
const agent = await xag.createAgent({
  name: "MyAgent",
  type: "supplier",
  didMethod: "xls-40"
});
```

### Initiate a Trade
```typescript
const trade = await xag.initiateTrade({
  buyer: buyerDID,
  seller: sellerDID,
  amount: 100,
  token: "RLUSD"
}, buyerSeed);
```

### Check Reputation
```typescript
const reputation = await xag.getReputation(agentDID);
console.log(`Score: ${reputation.score}`);
```

---

## 🌐 Features

✅ **XLS-40 DIDs** - Native XRPL Decentralized Identifiers  
✅ **Native Escrows** - Trustless XRP escrows  
✅ **RLUSD Support** - Stablecoin payments  
✅ **Transaction Memos** - Immutable audit trail  
✅ **Reputation System** - On-chain reputation tracking  

---

## 🔗 Links

- **XRPL Testnet Explorer**: https://testnet.xrpl.org
- **XRPL Documentation**: https://xrpl.org
- **XLS-40 DIDs**: https://xrpl.org/docs/proposed/amendments/did/

---

## ⚠️ Security Notes

- Never commit wallet seeds to version control
- Use testnet for development
- Always verify transactions on XRPL explorer

