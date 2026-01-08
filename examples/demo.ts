import { XAG } from '../src/XAG';

async function runDemo() {
  const xag = new XAG();
  console.log("═══════════════════════════════════════════════════════");
  console.log("   X-Agent Gateway (XAG) - Demo");
  console.log("   Trust & Settlement for Autonomous Agents");
  console.log("═══════════════════════════════════════════════════════");

  try {
    // 1. Create Buyer Agent (matches README API)
    console.log("\n[STEP 1] Creating Buyer Agent with XLS-40 DID...");
    const buyerAgent = await xag.createAgent({
      name: "AutoBuyer-Alpha",
      type: "consumer",
      didMethod: "xls-40"
    });

    // 2. Create Seller Agent (matches README API)
    console.log("\n[STEP 2] Creating Seller Agent with XLS-40 DID...");
    const sellerAgent = await xag.createAgent({
      name: "SolarSupplier-One",
      type: "supplier",
      didMethod: "xls-40"
    });

    // Wait a bit for wallets to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Demo 1: XRP Escrow (Native Escrow)
    console.log("\n[STEP 3] Demo 1: XRP Escrow (Native XRPL Escrow)...");
    
    // Set escrow to be finishable after 10 seconds (Ripple epoch time)
    const rippleEpoch = 946684800; // Unix timestamp for Jan 1, 2000
    const currentRippleTime = Math.floor(Date.now() / 1000) - rippleEpoch;
    const finishAfter = currentRippleTime + 10;
    
    const xrpTrade = await xag.initiateTrade({
      buyer: buyerAgent.did,
      seller: sellerAgent.did,
      amount: 10,
      token: "XRP",
      finishAfter: finishAfter,
      memo: "XAG Demo: 10 XRP Escrow Trade"
    }, buyerAgent.seed);

    console.log(`\n✅ XRP Trade initiated by ${buyerAgent.config.name}`);
    console.log(`   Escrow locked: ${xrpTrade.amount} XRP`);

    // Wait for time-lock
    console.log("\n[STEP 4] Waiting for time-lock to expire (10s)...");
    for (let i = 10; i > 0; i--) {
      process.stdout.write(`\r   ${i}... `);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log("\r   Ready!     ");

    // Fulfill XRP Escrow
    console.log("\n[STEP 5] Fulfilling XRP Escrow...");
    await xag.fulfillTrade(xrpTrade.hash, sellerAgent.did, "XRP", sellerAgent.seed);

    // 4. Demo 2: RLUSD Payment (matches README API)
    console.log("\n[STEP 6] Demo 2: RLUSD Payment (Escrow-like)...");
    console.log("   Note: Native Escrows only support XRP.");
    console.log("   For RLUSD, we use Payment transactions with TrustLines.");
    
    // For RLUSD demo, we'd need RLUSD in the account
    // This is a demo, so we'll show the API call structure
    try {
      const rlusdTrade = await xag.initiateTrade({
        buyer: buyerAgent.did,
        seller: sellerAgent.did,
        amount: 100,
        token: "RLUSD",
        memo: "XAG Demo: 100 RLUSD Payment Trade"
      }, buyerAgent.seed);

      console.log(`\n✅ RLUSD Trade initiated`);
      console.log(`   Payment Hash: ${rlusdTrade.hash}`);
      
      // RLUSD payments are immediate, no escrow to fulfill
      console.log(`   RLUSD Payment completed immediately (no escrow needed)`);
    } catch (error: any) {
      console.log(`\n⚠️  RLUSD demo skipped: ${error.message}`);
      console.log(`   (This is expected if RLUSD balance is insufficient)`);
    }

    // 5. Check Reputation (matches README API)
    console.log("\n[STEP 7] Verifying Agent Reputation (On-Chain History)...");
    const buyerRep = await xag.getReputation(buyerAgent.did);
    const sellerRep = await xag.getReputation(sellerAgent.did);

    console.log(`\n📈 Reputation Scores:`);
    console.log(`   ${buyerAgent.config.name} (${buyerAgent.did}):`);
    console.log(`      Score: ${buyerRep.score} points`);
    console.log(`      Successful Trades: ${buyerRep.successfulTrades}`);
    console.log(`   ${sellerAgent.config.name} (${sellerAgent.did}):`);
    console.log(`      Score: ${sellerRep.score} points`);
    console.log(`      Successful Trades: ${sellerRep.successfulTrades}`);

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("   ✅ Demo completed successfully! 🚀");
    console.log("   All transactions are visible on XRPL Testnet");
    console.log("   Check the transaction hashes above to view on testnet.xrpl.org");
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

