import { XAG } from '../src/XAG';
import { Wallet } from 'xrpl';

async function runDemo() {
  const xag = new XAG();
  console.log("═══════════════════════════════════════════════════════");
  console.log("   X-Agent Gateway (XAG) - Demo");
  console.log("   Trust & Settlement for Autonomous Agents");
  console.log("═══════════════════════════════════════════════════════");

  try {
    // 1. Create Buyer Agent
    console.log("\n[STEP 1] Creating Buyer Agent with XLS-40 DID...");
    const buyerAgent = await xag.createAgent({
      name: "AutoBuyer-Alpha",
      type: "consumer"
    });

    // 2. Create Seller Agent
    console.log("\n[STEP 2] Creating Seller Agent with XLS-40 DID...");
    const sellerAgent = await xag.createAgent({
      name: "SolarSupplier-One",
      type: "supplier"
    });

    // Wait a bit for wallets to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Initiate Trade (Escrow)
    console.log("\n[STEP 3] Initiating Trade (Locking funds in Native XRPL Escrow)...");
    const buyerWallet = Wallet.fromSeed(buyerAgent.seed!);
    
    // Set escrow to be finishable after 10 seconds (Ripple epoch time)
    // Ripple epoch is Jan 1, 2000, so we need to convert
    const rippleEpoch = 946684800; // Unix timestamp for Jan 1, 2000
    const currentRippleTime = Math.floor(Date.now() / 1000) - rippleEpoch;
    const finishAfter = currentRippleTime + 10; // 10 seconds from now
    
    const trade = await xag.initiateTrade({
      buyer: buyerAgent.address,
      seller: sellerAgent.address,
      amount: "10", // 10 XRP
      token: "XRP",
      finishAfter: finishAfter
    }, buyerWallet);

    console.log(`\n✅ Trade initiated by ${buyerAgent.config.name}`);
    console.log(`   Escrow locked: ${trade.amount} XRP`);

    // 4. Wait for time-lock (simulating agent processing/fulfillment)
    console.log("\n[STEP 4] Waiting for time-lock to expire (10s)...");
    console.log("   (In production, this would be agent processing time)");
    for (let i = 10; i > 0; i--) {
      process.stdout.write(`\r   ${i}... `);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log("\r   Ready!     ");

    // 5. Fulfill Trade
    console.log("\n[STEP 5] Seller fulfilling the trade (Completing Escrow)...");
    const sellerWallet = Wallet.fromSeed(sellerAgent.seed!);
    await xag.fulfillTrade(trade.hash, sellerWallet);

    console.log(`\n✅ Trade completed by ${sellerAgent.config.name}`);

    // 6. Check Reputation
    console.log("\n[STEP 6] Verifying Agent Reputation (On-Chain History)...");
    const buyerRep = await xag.getReputation(buyerAgent.address);
    const sellerRep = await xag.getReputation(sellerAgent.address);

    console.log(`\n📈 Reputation Scores:`);
    console.log(`   ${buyerAgent.config.name}: ${buyerRep.score} points`);
    console.log(`   ${sellerAgent.config.name}: ${sellerRep.score} points`);

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("   ✅ Demo completed successfully! 🚀");
    console.log("   All transactions are visible on XRPL Testnet");
    console.log("═══════════════════════════════════════════════════════");

  } catch (error: any) {
    console.error("\n❌ Demo failed:", error.message || error);
    if (error.stack) {
      console.error("\nStack trace:", error.stack);
    }
  } finally {
    await xag.disconnect();
    console.log("\n🔌 Disconnected from XRPL");
  }
}

runDemo();

