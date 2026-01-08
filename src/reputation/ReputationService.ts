import { Client } from 'xrpl';
import { ReputationResult } from '../types';
import { DIDManager } from '../identity/DIDManager';

export class ReputationService {
  private didManager: DIDManager;

  constructor(private client: Client) {
    this.didManager = new DIDManager(client);
  }

  /**
   * Gets reputation for an agent by DID
   */
  async getReputation(did: string): Promise<ReputationResult> {
    const address = this.didManager.resolveDID(did);
    
    const accountTx = await this.client.request({
      command: 'account_tx',
      account: address,
      limit: 100
    });

    const allTransactions = accountTx.result.transactions || [];
    
    // Count successful EscrowFinish transactions (seller side)
    // Check both tx.TransactionType and tx_json.TransactionType
    const successfulFinishes = allTransactions.filter((tx: any) => {
      const txType = tx.tx?.TransactionType || tx.tx_json?.TransactionType;
      const result = tx.meta?.TransactionResult || tx.meta?.delivered_amount !== undefined;
      return txType === 'EscrowFinish' && (result === 'tesSUCCESS' || result !== undefined);
    }).length;

    // Count successful EscrowCreate transactions (buyer side)
    const successfulCreates = allTransactions.filter((tx: any) => {
      const txType = tx.tx?.TransactionType || tx.tx_json?.TransactionType;
      const result = tx.meta?.TransactionResult || tx.meta?.delivered_amount !== undefined;
      return txType === 'EscrowCreate' && (result === 'tesSUCCESS' || result !== undefined);
    }).length;

    // Count successful Payment transactions (for RLUSD trades)
    const successfulPayments = allTransactions.filter((tx: any) => {
      const txType = tx.tx?.TransactionType || tx.tx_json?.TransactionType;
      const result = tx.meta?.TransactionResult || tx.meta?.delivered_amount !== undefined;
      const amount = tx.tx?.Amount || tx.tx_json?.Amount;
      const isRLUSD = typeof amount === 'object' && amount?.currency === 'RLUSD';
      return txType === 'Payment' && (result === 'tesSUCCESS' || result !== undefined) && isRLUSD;
    }).length;

    const totalSuccessful = successfulFinishes + successfulCreates + successfulPayments;
    const score = totalSuccessful * 10;

    return {
      did,
      address,
      score,
      successfulTrades: totalSuccessful,
      escrowCreates: successfulCreates,
      escrowFinishes: successfulFinishes,
      payments: successfulPayments
    };
  }
}

