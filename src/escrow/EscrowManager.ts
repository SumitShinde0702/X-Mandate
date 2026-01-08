import { Client, Wallet, EscrowCreate, EscrowFinish, Payment, Memo, xrpToDrops } from 'xrpl';
import { TradeConfig, TradeResult } from '../types';
import { DIDManager } from '../identity/DIDManager';
import { RLUSDManager } from '../currency/RLUSDManager';

export class EscrowManager {
  private didManager: DIDManager;
  private rlusdManager: RLUSDManager;

  constructor(private client: Client) {
    this.didManager = new DIDManager(client);
    this.rlusdManager = new RLUSDManager(client);
  }

  /**
   * Creates a memo array from a string
   */
  private createMemos(memoText?: string): Memo[] {
    if (!memoText) return [];
    return [{
      Memo: {
        MemoData: Buffer.from(memoText).toString('hex'),
        MemoType: Buffer.from('text/plain').toString('hex')
      }
    }];
  }

  /**
   * Initiates a trade using native XRPL Escrow (for XRP) or Payment (for RLUSD)
   */
  async initiateTrade(config: TradeConfig, buyerWallet: Wallet): Promise<TradeResult> {
    const buyerAddress = this.didManager.resolveDID(config.buyer);
    const sellerAddress = this.didManager.resolveDID(config.seller);

    if (config.token === 'RLUSD') {
      // For RLUSD, we use Payment transactions (native escrows only support XRP)
      // In production, this could use Hooks or other mechanisms
      const memo = config.memo || `XAG Trade: ${config.amount} RLUSD from ${buyerAddress} to ${sellerAddress}`;
      
      console.log(`\n💱 Creating RLUSD Payment (Escrow-like)...`);
      console.log(`   Note: Native Escrows only support XRP. Using Payment for RLUSD.`);
      
      const hash = await this.rlusdManager.createRLUSDPayment(
        buyerWallet,
        sellerAddress,
        config.amount.toString(),
        memo
      );

      return {
        hash,
        sequence: 0, // Payment doesn't use sequence like Escrow
        amount: config.amount,
        token: config.token,
        buyer: buyerAddress,
        seller: sellerAddress
      };
    } else {
      // Native XRPL Escrow for XRP
      const escrowTx: EscrowCreate = {
        TransactionType: 'EscrowCreate',
        Account: buyerWallet.address,
        Amount: xrpToDrops(config.amount.toString()),
        Destination: sellerAddress,
        ...(config.condition && { Condition: config.condition }),
        ...(config.finishAfter && { FinishAfter: config.finishAfter }),
        ...(config.cancelAfter && { CancelAfter: config.cancelAfter }),
        ...(config.memo && { Memos: this.createMemos(config.memo) })
      };

      const prepared = await this.client.autofill(escrowTx);
      const signed = buyerWallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      const txHash = result.result.hash as string;
      const sequence = (result.result as any).Sequence || prepared.Sequence;

      return {
        hash: txHash,
        sequence,
        amount: config.amount,
        token: config.token,
        buyer: buyerAddress,
        seller: sellerAddress
      };
    }
  }

  /**
   * Fulfills an escrow (for XRP) or verifies payment (for RLUSD)
   */
  async fulfillTrade(
    escrowHash: string,
    sellerWallet: Wallet,
    token: 'XRP' | 'RLUSD',
    fulfillment?: string,
    condition?: string
  ): Promise<string> {
    if (token === 'RLUSD') {
      // For RLUSD, payment is already complete, just verify
      const tx = await this.client.request({
        command: 'tx',
        transaction: escrowHash
      });
      
      const txResult = tx.result as any;
      if (txResult.meta?.TransactionResult !== 'tesSUCCESS') {
        throw new Error('RLUSD payment was not successful');
      }
      
      return escrowHash; // Payment already completed
    } else {
      // Native EscrowFinish for XRP
      const tx = await this.client.request({
        command: 'tx',
        transaction: escrowHash
      });

      const txResult = tx.result as any;
      const owner = txResult.tx_json?.Account || txResult.Account;
      const sequence = txResult.tx_json?.Sequence || txResult.Sequence;

      if (!owner || !sequence) {
        throw new Error(`Could not extract owner or sequence from escrow transaction. Hash: ${escrowHash}`);
      }

      const escrowFinishTx: EscrowFinish = {
        TransactionType: 'EscrowFinish',
        Account: sellerWallet.address,
        Owner: owner,
        OfferSequence: sequence,
        ...(fulfillment && { Fulfillment: fulfillment }),
        ...(condition && { Condition: condition })
      };

      const prepared = await this.client.autofill(escrowFinishTx);
      const signed = sellerWallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      return result.result.hash as string;
    }
  }
}

