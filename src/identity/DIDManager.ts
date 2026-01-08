import { Client, Wallet, DIDSet } from 'xrpl';

export class DIDManager {
  constructor(private client: Client) {}

  /**
   * Resolves a DID to an XRPL address
   * Format: did:xrpl:1:rAddress...
   */
  resolveDID(did: string): string {
    if (did.startsWith('did:xrpl:1:')) {
      return did.replace('did:xrpl:1:', '');
    }
    // If it's already an address, return as-is
    if (did.startsWith('r')) {
      return did;
    }
    throw new Error(`Invalid DID format: ${did}`);
  }

  /**
   * Creates a DID from an address
   */
  createDID(address: string): string {
    return `did:xrpl:1:${address}`;
  }

  /**
   * Registers a DID on XRPL using XLS-40 DIDSet transaction
   */
  async registerDID(wallet: Wallet, config: { name: string; type: string }): Promise<string> {
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
      
      return result.result.hash as string;
    } catch (error: any) {
      // DID registration might fail on testnet if not fully supported
      // Return the DID anyway based on address
      console.warn(`DID registration warning: ${error.message || error}`);
      return '';
    }
  }
}

