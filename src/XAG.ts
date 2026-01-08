import { Client, Wallet, Payment, Memo, xrpToDrops } from 'xrpl';
import { AgentConfig, Agent, TradeConfig, TradeResult, ReputationResult } from './types';
import { DIDManager } from './identity/DIDManager';
import { EscrowManager } from './escrow/EscrowManager';
import { ReputationService } from './reputation/ReputationService';
import { RLUSDManager } from './currency/RLUSDManager';

export class XAG {
  private client: Client;
  private network: string;
  private didManager: DIDManager;
  private escrowManager: EscrowManager;
  private reputationService: ReputationService;
  private rlusdManager: RLUSDManager;
  private agentWallets: Map<string, Wallet> = new Map(); // Store wallets by DID

  constructor(network: string = 'wss://s.altnet.rippletest.net:51233') {
    this.network = network;
    this.client = new Client(this.network);
    this.didManager = new DIDManager(this.client);
    this.escrowManager = new EscrowManager(this.client);
    this.reputationService = new ReputationService(this.client);
    this.rlusdManager = new RLUSDManager(this.client);
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

  /**
   * Creates an agent with XLS-40 DID
   * @example
   * const agent = await XAG.createAgent({
   *   name: "SolarMonitor-01",
   *   type: "supplier",
   *   didMethod: "xls-40"
   * });
   */
  async createAgent(config: AgentConfig): Promise<Agent> {
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

    // Register DID (XLS-40)
    const didHash = await this.didManager.registerDID(wallet, {
      name: config.name,
      type: config.type
    });

    const did = this.didManager.createDID(wallet.address);
    
    if (didHash) {
      console.log(`\n✅ DID registered for ${config.name}`);
      console.log(`   DID: ${did}`);
      console.log(`   Transaction Hash: ${didHash}`);
      console.log(`   View on Testnet: https://testnet.xrpl.org/transactions/${didHash}`);
    } else {
      console.log(`\n⚠️  DID registration skipped (using address-based DID)`);
      console.log(`   DID: ${did}`);
    }

    // If RLUSD is needed, create trustline
    if (config.type === 'supplier' || config.type === 'seller') {
      try {
        const hasTrustLine = await this.rlusdManager.hasTrustLine(wallet.address);
        if (!hasTrustLine) {
          console.log(`   Creating RLUSD TrustLine...`);
          await this.rlusdManager.createTrustLine(wallet);
        }
      } catch (error) {
        console.warn(`   Could not create RLUSD TrustLine: ${error}`);
      }
    }

    // Store wallet for later use
    this.agentWallets.set(did, wallet);

    return {
      address: wallet.address,
      seed: wallet.seed,
      did,
      config
    };
  }

  /**
   * Gets or creates a wallet from a DID/address
   */
  private getWalletFromDID(didOrAddress: string, seed?: string): Wallet {
    const address = this.didManager.resolveDID(didOrAddress);
    
    // Check if we have it stored
    const storedWallet = this.agentWallets.get(didOrAddress);
    if (storedWallet) {
      return storedWallet;
    }

    // If seed provided, use it
    if (seed) {
      return Wallet.fromSeed(seed);
    }

    throw new Error(`Wallet not found for ${didOrAddress}. Please provide seed or create agent first.`);
  }

  /**
   * Initiates a trade with escrow-locked payments
   * @example
   * const settlement = await XAG.initiateTrade({
   *   buyer: buyerDID,
   *   seller: sellerDID,
   *   amount: 100,
   *   token: "RLUSD",
   *   condition: fulfillmentCryptoCondition 
   * });
   */
  async initiateTrade(config: TradeConfig, buyerSeed?: string): Promise<TradeResult> {
    await this.connect();

    // Get buyer wallet (from stored wallets or seed)
    let buyerWallet: Wallet;
    try {
      buyerWallet = this.getWalletFromDID(config.buyer, buyerSeed);
    } catch (error) {
      throw new Error(`Buyer wallet not found. Please create agent first or provide buyerSeed. ${error}`);
    }

    const buyerAddress = this.didManager.resolveDID(config.buyer);
    
    // Check balance
    if (config.token === 'XRP') {
      const accountInfo = await this.client.request({
        command: 'account_info',
        account: buyerAddress
      });
      const balance = parseFloat(accountInfo.result.account_data.Balance) / 1000000;
      console.log(`\n💰 Buyer balance: ${balance} XRP`);

      if (balance < config.amount + 0.1) {
        throw new Error(`Insufficient balance. Need ${config.amount + 0.1} XRP (amount + fees)`);
      }
    } else if (config.token === 'RLUSD') {
      const balance = await this.rlusdManager.getBalance(buyerAddress);
      console.log(`\n💰 Buyer RLUSD balance: ${balance}`);
      
      if (parseFloat(balance) < config.amount) {
        throw new Error(`Insufficient RLUSD balance. Need ${config.amount}, have ${balance}`);
      }
    }

    // Add default memo for auditability
    const memo = config.memo || `XAG Trade: ${config.amount} ${config.token} from ${config.buyer} to ${config.seller}`;

    console.log(`\n🔒 Creating ${config.token === 'RLUSD' ? 'RLUSD Payment' : 'Native Escrow'}...`);
    console.log(`   Amount: ${config.amount} ${config.token}`);
    console.log(`   Buyer: ${config.buyer}`);
    console.log(`   Seller: ${config.seller}`);
    console.log(`   Memo: ${memo}`);

    const tradeConfig: TradeConfig = {
      ...config,
      memo
    };

    const result = await this.escrowManager.initiateTrade(tradeConfig, buyerWallet);

    console.log(`\n✅ Trade initiated - ${config.token === 'RLUSD' ? 'Payment created' : 'Escrow created'}!`);
    console.log(`   Transaction Hash: ${result.hash}`);
    console.log(`   View on Testnet: https://testnet.xrpl.org/transactions/${result.hash}`);

    return result;
  }

  /**
   * Fulfills a trade (completes escrow or verifies payment)
   */
  async fulfillTrade(escrowHash: string, sellerDID: string, token: 'RLUSD' | 'XRP' = 'XRP', sellerSeed?: string): Promise<string> {
    await this.connect();

    // Get seller wallet
    let sellerWallet: Wallet;
    try {
      sellerWallet = this.getWalletFromDID(sellerDID, sellerSeed);
    } catch (error) {
      throw new Error(`Seller wallet not found. Please create agent first or provide sellerSeed. ${error}`);
    }

    console.log(`\n✅ Fulfilling ${token} trade...`);
    const hash = await this.escrowManager.fulfillTrade(escrowHash, sellerWallet, token);
    
    if (token === 'XRP') {
      console.log(`\n✅ Trade fulfilled - Escrow finished!`);
      console.log(`   Transaction Hash: ${hash}`);
      console.log(`   View on Testnet: https://testnet.xrpl.org/transactions/${hash}`);
    } else {
      console.log(`\n✅ RLUSD Payment verified!`);
      console.log(`   Transaction Hash: ${hash}`);
    }

    return hash;
  }

  /**
   * Gets reputation for an agent by DID
   * @example
   * const score = await XAG.getReputation(agentDID);
   */
  async getReputation(agentDID: string): Promise<ReputationResult> {
    await this.connect();

    console.log(`\n📊 Fetching reputation for: ${agentDID}`);
    
    const result = await this.reputationService.getReputation(agentDID);

    console.log(`   Successful Escrow Creates: ${result.escrowCreates}`);
    console.log(`   Successful Escrow Finishes: ${result.escrowFinishes}`);
    console.log(`   Successful Payments: ${result.payments}`);
    console.log(`   Reputation Score: ${result.score}`);

    return result;
  }

  /**
   * Logs a message to the blockchain using XRPL Transaction Memos
   * Creates an immutable audit trail for A2A communication
   * @example
   * await xag.log("Agent interaction started", "info", agentDID, agentSeed);
   */
  async log(
    message: string,
    level: 'info' | 'success' | 'warn' | 'error' = 'info',
    agentDID: string,
    agentSeed?: string
  ): Promise<string> {
    await this.connect();

    // Get agent wallet
    let agentWallet: Wallet;
    try {
      agentWallet = this.getWalletFromDID(agentDID, agentSeed);
    } catch (error) {
      throw new Error(`Agent wallet not found. Please create agent first or provide agentSeed. ${error}`);
    }

    // Use Payment to a known sink address with memos - simple and avoids redundancy!
    // Each memo is unique, so no redundant transaction errors
    const logData = {
      message,
      level,
      timestamp: new Date().toISOString(),
      agent: agentDID
    };
    
    // Known XRPL sink address (burn address) - perfect for logging
    const SINK_ADDRESS = 'rrrrrrrrrrrrrrrrrrrrBZbvji';
    
    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: agentWallet.address,
      Destination: SINK_ADDRESS, // Send to sink address (burn)
      Amount: xrpToDrops('0.000001'), // Minimum amount (1 drop)
      Memos: [{
        Memo: {
          MemoData: Buffer.from(JSON.stringify(logData)).toString('hex'),
          MemoType: Buffer.from('application/json').toString('hex')
        }
      }]
    };

    try {
      const prepared = await this.client.autofill(paymentTx);
      const signed = agentWallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      const txHash = result.result.hash as string;
      console.log(`\n📝 Logged to blockchain [${level.toUpperCase()}]`);
      console.log(`   Message: ${message}`);
      console.log(`   Transaction Hash: ${txHash}`);
      console.log(`   View on Testnet: https://testnet.xrpl.org/transactions/${txHash}`);

      return txHash;
    } catch (error: any) {
      throw new Error(`Failed to log to blockchain: ${error.message || error}`);
    }
  }

  /**
   * Retrieves logs from blockchain for an agent
   * Parses transaction memos to extract log entries
   */
  async getLogs(agentDID: string, limit: number = 50): Promise<Array<{
    message: string;
    level: string;
    timestamp: string;
    txHash: string;
  }>> {
    await this.connect();

    const address = this.didManager.resolveDID(agentDID);
    
    const accountTx = await this.client.request({
      command: 'account_tx',
      account: address,
      limit: limit
    });

    const logs: Array<{
      message: string;
      level: string;
      timestamp: string;
      txHash: string;
    }> = [];

    const transactions = accountTx.result.transactions || [];
    
    for (const tx of transactions) {
      const txData: any = tx.tx || tx.tx_json || {};
      const memos = txData.Memos || [];
      
      for (const memo of memos) {
        try {
          const memoData = (memo as any).Memo?.MemoData;
          if (memoData) {
            const decoded = Buffer.from(memoData, 'hex').toString('utf-8');
            const logData = JSON.parse(decoded);
            
            // Check if it's a log entry (has message and level)
            if (logData.message && logData.level) {
              logs.push({
                message: logData.message,
                level: logData.level,
                timestamp: logData.timestamp || new Date().toISOString(),
                txHash: txData.hash || (tx as any).hash || ''
              });
            }
          }
        } catch (error) {
          // Skip invalid memos
          continue;
        }
      }
    }

    // Sort by timestamp (newest first)
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return logs;
  }

  /**
   * Gets transaction history for an agent
   */
  async getTransactionHistory(agentDID: string, limit: number = 50): Promise<Array<{
    hash: string;
    type: string;
    result: string;
    timestamp?: string;
  }>> {
    await this.connect();

    const address = this.didManager.resolveDID(agentDID);
    
    const accountTx = await this.client.request({
      command: 'account_tx',
      account: address,
      limit: limit
    });

    const transactions = accountTx.result.transactions || [];
    
    return transactions.map((tx: any) => ({
      hash: tx.tx?.hash || tx.hash || '',
      type: tx.tx?.TransactionType || tx.tx_json?.TransactionType || 'Unknown',
      result: tx.meta?.TransactionResult || 'Unknown',
      timestamp: tx.tx?.date ? new Date((tx.tx.date + 946684800) * 1000).toISOString() : undefined
    }));
  }
}
