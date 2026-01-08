import { Client } from 'xrpl';
import { VerificationResult } from '../types';
import { DIDManager } from '../identity/DIDManager';
import { ReputationService } from '../reputation/ReputationService';
import { ProfileManager } from '../profile/ProfileManager';

export class VerificationService {
  private didManager: DIDManager;
  private reputationService: ReputationService;
  private profileManager: ProfileManager;

  constructor(private client: Client) {
    this.didManager = new DIDManager(client);
    this.reputationService = new ReputationService(client);
    this.profileManager = new ProfileManager(client);
  }

  /**
   * Verifies an agent's credentials and claims
   */
  async verifyAgent(agentDID: string, requirements?: {
    minReputation?: number;
    requireProfile?: boolean;
    requiredCapabilities?: string[];
  }): Promise<VerificationResult> {
    const address = this.didManager.resolveDID(agentDID);
    
    const claims = {
      identity: false,
      reputation: false,
      profile: false,
      credentials: [] as Array<{ type: string; verified: boolean; source: string }>
    };

    // 1. Verify DID/Identity
    try {
      const accountInfo = await this.client.request({
        command: 'account_info',
        account: address,
        ledger_index: 'validated'
      });
      claims.identity = accountInfo.result.account_data !== undefined;
      if (claims.identity) {
        claims.credentials.push({
          type: 'identity',
          verified: true,
          source: 'XRPL Account'
        });
      }
    } catch (error) {
      claims.identity = false;
    }

    // 2. Verify Reputation
    try {
      const reputation = await this.reputationService.getReputation(agentDID);
      const minRep = requirements?.minReputation || 0;
      claims.reputation = reputation.score >= minRep;
      if (claims.reputation) {
        claims.credentials.push({
          type: 'reputation',
          verified: true,
          source: `XRPL History (Score: ${reputation.score})`
        });
      }
    } catch (error) {
      claims.reputation = false;
    }

    // 3. Verify Profile
    try {
      const profile = await this.profileManager.getProfile(address);
      claims.profile = profile !== null;
      if (claims.profile && profile) {
        claims.credentials.push({
          type: 'profile',
          verified: true,
          source: 'XRPL DID Data'
        });

        // Check required capabilities if specified
        if (requirements?.requiredCapabilities && profile.capabilities) {
          const hasAll = requirements.requiredCapabilities.every(cap => 
            profile.capabilities!.includes(cap)
          );
          if (hasAll) {
            claims.credentials.push({
              type: 'capabilities',
              verified: true,
              source: 'Profile Capabilities'
            });
          }
        }
      }
    } catch (error) {
      claims.profile = false;
    }

    // Calculate verification score
    let score = 0;
    if (claims.identity) score += 25;
    if (claims.reputation) score += 25;
    if (claims.profile) score += 25;
    if (claims.credentials.length > 2) score += 25;

    const verified = score >= 50 && 
                     (!requirements?.minReputation || claims.reputation) &&
                     (!requirements?.requireProfile || claims.profile);

    return {
      agentDID,
      verified,
      claims,
      score
    };
  }
}

