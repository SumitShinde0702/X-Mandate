import { Client, Wallet, Payment, Memo, xrpToDrops } from 'xrpl';
import { Intent } from '../types';
import { DIDManager } from '../identity/DIDManager';

export class IntentService {
  private didManager: DIDManager;
  private SINK_ADDRESS = 'rrrrrrrrrrrrrrrrrrrrBZbvji';

  constructor(private client: Client) {
    this.didManager = new DIDManager(client);
  }

  /**
   * Broadcasts an intent (offer or request) to the blockchain
   */
  async broadcastIntent(
    agentDID: string,
    intent: Omit<Intent, 'agentDID' | 'timestamp' | 'txHash' | 'status'>,
    agentSeed?: string
  ): Promise<string> {
    const address = this.didManager.resolveDID(agentDID);
    const wallet = agentSeed ? Wallet.fromSeed(agentSeed) : null;
    
    if (!wallet) {
      throw new Error('Wallet seed required to broadcast intent');
    }

    const intentData: Intent = {
      agentDID,
      ...intent,
      timestamp: new Date().toISOString(),
      status: 'active'
    };

    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: this.SINK_ADDRESS,
      Amount: xrpToDrops('0.000001'), // Minimal amount
      Memos: [{
        Memo: {
          MemoData: Buffer.from(JSON.stringify(intentData)).toString('hex'),
          MemoType: Buffer.from('application/json').toString('hex'),
          MemoFormat: Buffer.from('xag:intent').toString('hex')
        }
      }]
    };

    const prepared = await this.client.autofill(paymentTx);
    const signed = wallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);

    return result.result.hash as string;
  }

  /**
   * Searches for matching intents on the blockchain
   */
  async searchIntents(criteria: {
    type?: 'offer' | 'request';
    category?: string;
    agentDID?: string;
    limit?: number;
  }): Promise<Intent[]> {
    // Query recent transactions to find intents
    // In production, you'd use a more efficient indexing system
    const intents: Intent[] = [];

    if (criteria.agentDID) {
      const address = this.didManager.resolveDID(criteria.agentDID);
      const accountTx = await this.client.request({
        command: 'account_tx',
        account: address,
        limit: criteria.limit || 100
      });

      const transactions = accountTx.result.transactions || [];
      
      for (const tx of transactions) {
        const txData: any = tx.tx || tx.tx_json || {};
        const memos = txData.Memos || [];
        
        for (const memo of memos) {
          try {
            const memoData = (memo as any).Memo?.MemoData;
            const memoFormat = (memo as any).Memo?.MemoFormat;
            
            if (memoFormat && Buffer.from(memoFormat, 'hex').toString() === 'xag:intent') {
              const decoded = Buffer.from(memoData, 'hex').toString('utf-8');
              const intent = JSON.parse(decoded) as Intent;
              
              // Filter by criteria
              if (criteria.type && intent.type !== criteria.type) continue;
              if (criteria.category && intent.category !== criteria.category) continue;
              
              intent.txHash = txData.hash || (tx as any).hash || '';
              intents.push(intent);
            }
          } catch (error) {
            continue;
          }
        }
      }
    }

    // Sort by timestamp (newest first)
    intents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return intents;
  }

  /**
   * Marks an intent as fulfilled or cancelled
   */
  async updateIntentStatus(
    intentTxHash: string,
    agentDID: string,
    status: 'fulfilled' | 'cancelled',
    agentSeed?: string
  ): Promise<string> {
    // Create a new transaction referencing the original intent
    const address = this.didManager.resolveDID(agentDID);
    const wallet = agentSeed ? Wallet.fromSeed(agentSeed) : null;
    
    if (!wallet) {
      throw new Error('Wallet seed required');
    }

    const updateData = {
      action: 'update_intent',
      intentHash: intentTxHash,
      status,
      timestamp: new Date().toISOString()
    };

    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: this.SINK_ADDRESS,
      Amount: xrpToDrops('0.000001'),
      Memos: [{
        Memo: {
          MemoData: Buffer.from(JSON.stringify(updateData)).toString('hex'),
          MemoType: Buffer.from('application/json').toString('hex'),
          MemoFormat: Buffer.from('xag:intent:update').toString('hex')
        }
      }]
    };

    const prepared = await this.client.autofill(paymentTx);
    const signed = wallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);

    return result.result.hash as string;
  }
}

