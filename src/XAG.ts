import { Client, Wallet, DIDSet, xrpToDrops, EscrowCreate, EscrowFinish } from 'xrpl';
import * as dotenv from 'dotenv';

dotenv.config();

export interface AgentConfig {
  name: string;
  type: 'buyer' | 'seller' | 'supplier' | 'consumer';
  didMethod?: string;
  seed?: string;
}

export interface TradeConfig {
  buyer: string;
  seller: string;
  amount: string; // in XRP for now, due to native escrow limitations
  token: string;
  condition?: string;
  finishAfter?: number; // Ripple epoch timestamp
  cancelAfter?: number; // Ripple epoch timestamp
}

export class XAG {
  private client: Client;
  private network: string;

  constructor(network: string = 'wss://s.altnet.rippletest.net:51233') {
    this.network = network;
    this.client = new Client(this.network);
  }

  async connect() {
    if (!this.client.isConnected()) {
      await this.client.connect();
    }
  }

  async disconnect() {
    if (this.client.isConnected()) {
      await this.client.disconnect();
    }
  }

  async createAgent(config: AgentConfig) {
    await this.connect();

    let wallet: Wallet;
    if (config.seed) {
      wallet = Wallet.fromSeed(config.seed);
    } else {
      console.log(`Funding new wallet for ${config.name}...`);
      const { wallet: newWallet } = await this.client.fundWallet();
      wallet = newWallet;
    }

    console.log(`\n✅ Agent ${config.name} created`);
    console.log(`   Address: ${wallet.address}`);
    console.log(`   View on Testnet: https://testnet.xrpl.org/accounts/${wallet.address}`);

    const didTx: DIDSet = {
      TransactionType: 'DIDSet',
      Account: wallet.address,
      URI: Buffer.from(`xag:agent:${config.name.toLowerCase().replace(/\s+/g, '-')}`).toString('hex'),
      Data: Buffer.from(JSON.stringify({ name: config.name, type: config.type })).toString('hex'),
    };

    try {
      const prepared = await this.client.autofill(didTx);
      const signed = wallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);
      
      const txHash = result.result.hash;
      console.log(`\n✅ DID registered for ${config.name}`);
      console.log(`   Transaction Hash: ${txHash}`);
      console.log(`   View on Testnet: https://testnet.xrpl.org/transactions/${txHash}`);
      
      return {
        address: wallet.address,
        seed: wallet.seed,
        did: `did:xrpl:1:${wallet.address}`,
        config
      };
    } catch (error: any) {
      console.error(`⚠️  Failed to register DID for ${config.name}:`, error.message || error);
      // Still return wallet even if DID fails
      return {
        address: wallet.address,
        seed: wallet.seed,
        did: `did:xrpl:1:${wallet.address}`,
        config
      };
    }
  }

  async initiateTrade(config: TradeConfig, buyerWallet: Wallet) {
    await this.connect();

    // Check buyer balance
    const accountInfo = await this.client.request({
      command: 'account_info',
      account: buyerWallet.address
    });
    const balance = parseFloat(accountInfo.result.account_data.Balance) / 1000000;
    console.log(`\n💰 Buyer balance: ${balance} XRP`);

    if (balance < parseFloat(config.amount) + 0.1) {
      throw new Error(`Insufficient balance. Need ${parseFloat(config.amount) + 0.1} XRP (amount + fees)`);
    }

    // Note: Native XRPL Escrows currently only support XRP.
    // In a production RLUSD environment, this would use a Bridge or Hooks.
    const escrowTx: EscrowCreate = {
      TransactionType: 'EscrowCreate',
      Account: buyerWallet.address,
      Amount: xrpToDrops(config.amount),
      Destination: config.seller,
      ...(config.condition && { Condition: config.condition }),
      ...(config.finishAfter && { FinishAfter: config.finishAfter }),
      ...(config.cancelAfter && { CancelAfter: config.cancelAfter }),
    };

    console.log(`\n🔒 Creating Escrow...`);
    console.log(`   Amount: ${config.amount} XRP`);
    console.log(`   Destination: ${config.seller}`);
    
    const prepared = await this.client.autofill(escrowTx);
    const signed = buyerWallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);

    const txHash = result.result.hash;
    const sequence = (result.result as any).Sequence || prepared.Sequence;
    
    console.log(`\n✅ Trade initiated - Escrow created!`);
    console.log(`   Transaction Hash: ${txHash}`);
    console.log(`   Sequence: ${sequence}`);
    console.log(`   View on Testnet: https://testnet.xrpl.org/transactions/${txHash}`);
    
    return {
      hash: txHash,
      sequence: sequence,
      ...config
    };
  }

  async fulfillTrade(escrowHash: string, sellerWallet: Wallet, fulfillment?: string, condition?: string) {
    await this.connect();

    console.log(`\n🔍 Looking up Escrow transaction: ${escrowHash}`);
    
    // Get the original escrow creation transaction
    const tx = await this.client.request({
      command: 'tx',
      transaction: escrowHash
    });

    const txResult = tx.result as any;
    // Get Account and Sequence from tx_json (the actual transaction data)
    const owner = txResult.tx_json?.Account || txResult.Account;
    const sequence = txResult.tx_json?.Sequence || txResult.Sequence;

    if (!owner || !sequence) {
      throw new Error(`Could not extract owner or sequence from escrow transaction. Hash: ${escrowHash}`);
    }

    console.log(`   Owner: ${owner}`);
    console.log(`   Sequence: ${sequence}`);

    // Check if escrow exists and get its details
    const accountEscrows = await this.client.request({
      command: 'account_objects',
      account: owner,
      type: 'escrow',
      ledger_index: 'validated'
    });

    const escrow = accountEscrows.result.account_objects.find((obj: any) => 
      obj.PreviousTxnID === escrowHash
    ) as any;

    if (!escrow) {
      throw new Error(`Escrow not found or already completed. Hash: ${escrowHash}`);
    }

    const escrowAmount = escrow.Amount ? parseFloat(escrow.Amount) / 1000000 : 'unknown';
    console.log(`   Escrow found. Amount: ${escrowAmount} XRP`);

    const escrowFinishTx: EscrowFinish = {
      TransactionType: 'EscrowFinish',
      Account: sellerWallet.address,
      Owner: owner,
      OfferSequence: sequence,
      ...(fulfillment && { Fulfillment: fulfillment }),
      ...(condition && { Condition: condition })
    };

    console.log(`\n✅ Fulfilling Escrow...`);
    
    const prepared = await this.client.autofill(escrowFinishTx);
    const signed = sellerWallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);

    const finishHash = result.result.hash;
    console.log(`\n✅ Trade fulfilled - Escrow finished!`);
    console.log(`   Transaction Hash: ${finishHash}`);
    console.log(`   View on Testnet: https://testnet.xrpl.org/transactions/${finishHash}`);
    
    return result.result;
  }

  async getReputation(address: string) {
    await this.connect();
    
    console.log(`\n📊 Fetching reputation for: ${address}`);
    
    // Aggregates successful XRPL Escrow completions and on-chain logs
    const accountTx = await this.client.request({
      command: 'account_tx',
      account: address,
      limit: 100
    });

    const allTransactions = accountTx.result.transactions || [];
    
    // Count successful EscrowFinish transactions (seller side)
    const successfulFinishes = allTransactions.filter((tx: any) => 
      tx.tx?.TransactionType === 'EscrowFinish' && 
      tx.meta?.TransactionResult === 'tesSUCCESS'
    ).length;

    // Count successful EscrowCreate transactions (buyer side)
    const successfulCreates = allTransactions.filter((tx: any) => 
      tx.tx?.TransactionType === 'EscrowCreate' && 
      tx.meta?.TransactionResult === 'tesSUCCESS'
    ).length;

    const totalSuccessful = successfulFinishes + successfulCreates;
    const score = totalSuccessful * 10;

    console.log(`   Successful Escrow Creates: ${successfulCreates}`);
    console.log(`   Successful Escrow Finishes: ${successfulFinishes}`);
    console.log(`   Reputation Score: ${score}`);

    return {
      address,
      score,
      successfulTrades: totalSuccessful,
      escrowCreates: successfulCreates,
      escrowFinishes: successfulFinishes
    };
  }
}

