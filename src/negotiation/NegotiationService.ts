import { Client, Wallet, Payment, Memo, xrpToDrops } from 'xrpl';
import { Negotiation } from '../types';
import { DIDManager } from '../identity/DIDManager';

export class NegotiationService {
  private didManager: DIDManager;
  private SINK_ADDRESS = 'rrrrrrrrrrrrrrrrrrrrBZbvji';

  constructor(private client: Client) {
    this.didManager = new DIDManager(client);
  }

  /**
   * Initiates a negotiation between agents
   */
  async initiateNegotiation(
    initiatorDID: string,
    participantDID: string,
    initialOffer: any,
    initiatorSeed?: string
  ): Promise<{ negotiationId: string; txHash: string }> {
    const initiatorAddress = this.didManager.resolveDID(initiatorDID);
    const wallet = initiatorSeed ? Wallet.fromSeed(initiatorSeed) : null;
    
    if (!wallet) {
      throw new Error('Wallet seed required to initiate negotiation');
    }

    const negotiationId = `neg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const negotiation: Negotiation = {
      negotiationId,
      participants: [initiatorDID, participantDID],
      status: 'initiated',
      currentOffer: {
        from: initiatorDID,
        to: participantDID,
        terms: initialOffer,
        timestamp: new Date().toISOString()
      },
      history: [{
        step: 1,
        from: initiatorDID,
        action: 'offer',
        terms: initialOffer,
        timestamp: new Date().toISOString(),
        txHash: '' // Will be set after transaction
      }]
    };

    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: this.SINK_ADDRESS,
      Amount: xrpToDrops('0.000001'),
      Memos: [{
        Memo: {
          MemoData: Buffer.from(JSON.stringify(negotiation)).toString('hex'),
          MemoType: Buffer.from('application/json').toString('hex'),
          MemoFormat: Buffer.from('xag:negotiation').toString('hex')
        }
      }]
    };

    const prepared = await this.client.autofill(paymentTx);
    const signed = wallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);

    const txHash = result.result.hash as string;
    
    // Update history with txHash
    negotiation.history[0].txHash = txHash;

    return { negotiationId, txHash };
  }

  /**
   * Adds a counter-offer or response to a negotiation
   */
  async counterOffer(
    negotiationId: string,
    originalTxHash: string,
    responderDID: string,
    action: 'counter' | 'accept' | 'reject',
    counterTerms?: any,
    responderSeed?: string
  ): Promise<string> {
    const responderAddress = this.didManager.resolveDID(responderDID);
    const wallet = responderSeed ? Wallet.fromSeed(responderSeed) : null;
    
    if (!wallet) {
      throw new Error('Wallet seed required');
    }

    // Get original negotiation
    const originalTx = await this.client.request({
      command: 'tx',
      transaction: originalTxHash
    });

    const txData: any = originalTx.result.tx_json || originalTx.result;
    const memos = txData.Memos || [];
    
    let negotiation: Negotiation | null = null;
    for (const memo of memos) {
      try {
        const memoFormat = (memo as any).Memo?.MemoFormat;
        if (memoFormat && Buffer.from(memoFormat, 'hex').toString() === 'xag:negotiation') {
          const memoData = (memo as any).Memo?.MemoData;
          const decoded = Buffer.from(memoData, 'hex').toString('utf-8');
          negotiation = JSON.parse(decoded) as Negotiation;
          break;
        }
      } catch (error) {
        continue;
      }
    }

    if (!negotiation || negotiation.negotiationId !== negotiationId) {
      throw new Error('Negotiation not found');
    }

    // Add new step to history
    const newStep = negotiation.history.length + 1;
    const newStatus = action === 'accept' ? 'accepted' : 
                     action === 'reject' ? 'rejected' : 
                     'counter-offer';

    negotiation.status = newStatus;
    negotiation.history.push({
      step: newStep,
      from: responderDID,
      action,
      terms: counterTerms || negotiation.currentOffer.terms,
      timestamp: new Date().toISOString(),
      txHash: '' // Will be set after
    });

    if (action === 'counter' && counterTerms) {
      negotiation.currentOffer = {
        from: responderDID,
        to: negotiation.currentOffer.from,
        terms: counterTerms,
        timestamp: new Date().toISOString()
      };
    }

    // Broadcast updated negotiation
    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: this.SINK_ADDRESS,
      Amount: xrpToDrops('0.000001'),
      Memos: [{
        Memo: {
          MemoData: Buffer.from(JSON.stringify(negotiation)).toString('hex'),
          MemoType: Buffer.from('application/json').toString('hex'),
          MemoFormat: Buffer.from('xag:negotiation').toString('hex')
        }
      }]
    };

    const prepared = await this.client.autofill(paymentTx);
    const signed = wallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);

    const txHash = result.result.hash as string;
    negotiation.history[negotiation.history.length - 1].txHash = txHash;

    return txHash;
  }

  /**
   * Retrieves negotiation history
   */
  async getNegotiation(negotiationId: string, participantDID: string): Promise<Negotiation | null> {
    const address = this.didManager.resolveDID(participantDID);
    
    const accountTx = await this.client.request({
      command: 'account_tx',
      account: address,
      limit: 200
    });

    const transactions = accountTx.result.transactions || [];
    
    // Find all negotiation transactions
    const negotiations: Negotiation[] = [];
    
    for (const tx of transactions) {
      const txData: any = tx.tx || tx.tx_json || {};
      const memos = txData.Memos || [];
      
      for (const memo of memos) {
        try {
          const memoFormat = (memo as any).Memo?.MemoFormat;
          if (memoFormat && Buffer.from(memoFormat, 'hex').toString() === 'xag:negotiation') {
            const memoData = (memo as any).Memo?.MemoData;
            const decoded = Buffer.from(memoData, 'hex').toString('utf-8');
            const negotiation = JSON.parse(decoded) as Negotiation;
            
            if (negotiation.negotiationId === negotiationId) {
              negotiation.history[negotiation.history.length - 1].txHash = 
                txData.hash || (tx as any).hash || '';
              negotiations.push(negotiation);
            }
          }
        } catch (error) {
          continue;
        }
      }
    }

    // Return the most recent version (last transaction)
    if (negotiations.length > 0) {
      negotiations.sort((a, b) => 
        new Date(b.history[b.history.length - 1].timestamp).getTime() - 
        new Date(a.history[a.history.length - 1].timestamp).getTime()
      );
      return negotiations[0];
    }

    return null;
  }
}

