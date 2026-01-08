import { Client, Wallet, DIDSet } from 'xrpl';
import { AgentProfile } from '../types';

export class ProfileManager {
  constructor(private client: Client) {}

  /**
   * Updates agent profile on-chain using DIDSet Data field
   */
  async updateProfile(wallet: Wallet, profile: AgentProfile): Promise<string> {
    const profileData = {
      capabilities: profile.capabilities || [],
      pricing: profile.pricing,
      availability: profile.availability,
      description: profile.description,
      contact: profile.contact,
      metadata: profile.metadata || {},
      updatedAt: new Date().toISOString()
    };

    const didTx: DIDSet = {
      TransactionType: 'DIDSet',
      Account: wallet.address,
      URI: Buffer.from(`xag:profile:${wallet.address}`).toString('hex'),
      Data: Buffer.from(JSON.stringify(profileData)).toString('hex'),
    };

    try {
      const prepared = await this.client.autofill(didTx);
      const signed = wallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);
      
      return result.result.hash as string;
    } catch (error: any) {
      throw new Error(`Failed to update profile: ${error.message || error}`);
    }
  }

  /**
   * Retrieves agent profile from on-chain DID data
   */
  async getProfile(agentAddress: string): Promise<AgentProfile | null> {
    try {
      // Check for DID data in account objects
      const accountObjects = await this.client.request({
        command: 'account_objects',
        account: agentAddress,
        type: 'did',
        ledger_index: 'validated'
      });

      const didObjects = accountObjects.result.account_objects || [];
      
      for (const didObj of didObjects) {
        const didData = didObj as any;
        // Check Data field
        if (didData.Data) {
          try {
            const profileData = JSON.parse(Buffer.from(didData.Data, 'hex').toString('utf-8'));
            // Verify it's a profile (has expected fields)
            if (profileData.capabilities !== undefined || profileData.pricing !== undefined) {
              return profileData as AgentProfile;
            }
          } catch (error) {
            continue;
          }
        }
        // Also check URI for profile indicator
        if (didData.URI) {
          const uri = Buffer.from(didData.URI, 'hex').toString('utf-8');
          if (uri.includes('xag:profile')) {
            // Try to get from transaction history
            const accountTx = await this.client.request({
              command: 'account_tx',
              account: agentAddress,
              limit: 50
            });
            
            const transactions = accountTx.result.transactions || [];
            for (const tx of transactions) {
              const txData: any = tx.tx || tx.tx_json || {};
              if (txData.TransactionType === 'DIDSet' && txData.Data) {
                try {
                  const profileData = JSON.parse(Buffer.from(txData.Data, 'hex').toString('utf-8'));
                  if (profileData.capabilities !== undefined || profileData.pricing !== undefined) {
                    return profileData as AgentProfile;
                  }
                } catch (error) {
                  continue;
                }
              }
            }
          }
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Searches for agents by profile criteria
   */
  async searchAgents(criteria: {
    type?: string;
    capabilities?: string[];
    minReputation?: number;
  }): Promise<Array<{ address: string; profile: AgentProfile; reputation?: number }>> {
    // This would require indexing or querying known agents
    // For now, return empty - in production, you'd have an agent registry
    return [];
  }
}

