import { Client, Wallet, TrustSet, Payment, Memo } from 'xrpl';
import { RLUSD_ISSUER_TESTNET, RLUSD_CURRENCY_CODE } from '../types';

export class RLUSDManager {
  constructor(private client: Client) {}

  /**
   * Creates a TrustLine for RLUSD
   */
  async createTrustLine(wallet: Wallet, limit: string = '1000000'): Promise<string> {
    const trustSetTx: TrustSet = {
      TransactionType: 'TrustSet',
      Account: wallet.address,
      LimitAmount: {
        currency: RLUSD_CURRENCY_CODE,
        issuer: RLUSD_ISSUER_TESTNET,
        value: limit
      }
    };

    const prepared = await this.client.autofill(trustSetTx);
    const signed = wallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);

    return result.result.hash as string;
  }

  /**
   * Checks if an account has a TrustLine for RLUSD
   */
  async hasTrustLine(address: string): Promise<boolean> {
    const accountLines = await this.client.request({
      command: 'account_lines',
      account: address,
      ledger_index: 'validated'
    });

    const lines = accountLines.result.lines || [];
    return lines.some((line: any) => 
      line.currency === RLUSD_CURRENCY_CODE && 
      line.account === RLUSD_ISSUER_TESTNET
    );
  }

  /**
   * Gets RLUSD balance for an account
   */
  async getBalance(address: string): Promise<string> {
    const accountLines = await this.client.request({
      command: 'account_lines',
      account: address,
      ledger_index: 'validated'
    });

    const lines = accountLines.result.lines || [];
    const rlusdLine = lines.find((line: any) => 
      line.currency === RLUSD_CURRENCY_CODE && 
      line.account === RLUSD_ISSUER_TESTNET
    );

    return rlusdLine ? rlusdLine.balance : '0';
  }

  /**
   * Creates a Payment transaction with RLUSD (for escrow-like functionality)
   * Note: Native Escrows only support XRP, so for RLUSD we use Payment with conditions
   */
  async createRLUSDPayment(
    fromWallet: Wallet,
    toAddress: string,
    amount: string,
    memo?: string
  ): Promise<string> {
    // Ensure trustline exists
    const hasTrustLine = await this.hasTrustLine(fromWallet.address);
    if (!hasTrustLine) {
      console.log(`Creating TrustLine for ${fromWallet.address}...`);
      await this.createTrustLine(fromWallet);
    }

    const memos: Memo[] = memo ? [{
      Memo: {
        MemoData: Buffer.from(memo).toString('hex'),
        MemoType: Buffer.from('text/plain').toString('hex')
      }
    }] : [];

    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: fromWallet.address,
      Destination: toAddress,
      Amount: {
        currency: RLUSD_CURRENCY_CODE,
        issuer: RLUSD_ISSUER_TESTNET,
        value: amount
      },
      ...(memos.length > 0 && { Memos: memos })
    };

    const prepared = await this.client.autofill(paymentTx);
    const signed = fromWallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);

    return result.result.hash as string;
  }
}

