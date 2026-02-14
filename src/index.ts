// Add this at the VERY TOP to suppress punycode warnings
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes('punycode')) {
    return; // Ignore punycode deprecation warnings
  }
  console.warn(warning); // Show other warnings
});

import readline from "readline";
import dotenv from "dotenv";
import { evaluateNFTLoan } from "./graph/workflow";

dotenv.config();

console.clear();
console.log(`
═══════════════════════════════════════════════════════════════
  🏛️  NFT LENDING EVALUATOR AGENT – Tether Technical Project
═══════════════════════════════════════════════════════════════

  This AI agent evaluates NFTs as collateral for USDT loans.
  
  Built with: LangGraph · Moralis API · Node.js · Local LLM
═══════════════════════════════════════════════════════════════
`);

console.log(`📋 Example NFTs:

  Bored Ape Yacht Club
  • Contract: 0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d
  • Token ID: 7092

  Pudgy Penguins
  • Contract: 0xbd3531da5cf5857e7cfaa92426877b022e612cf8
  • Token ID: 6878

  Azuki
  • Contract: 0xed5af388653567af2f388e6224dc7c4b3241c544
  • Token ID: 1234

  CryptoPunks
  • Contract: 0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb
  • Token ID: 3100
`);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Note: Moralis initialization is handled in nft-data.ts
// We don't need to initialize it here to avoid duplicate startup

async function main() {
  // Removed Moralis check - nft-data.ts will handle initialization when needed
  
  rl.question("\n🔍 Enter NFT contract address: ", async (contract) => {
    if (contract.toLowerCase() === "exit") {
      console.log("\n👋 Goodbye!");
      rl.close();
      return;
    }

    rl.question("🔢 Enter token ID: ", async (tokenId) => {
      rl.question("💬 Your query: ", async (query) => {
        console.log("\n⏳ Processing...\n");
        
        try {
          const report = await evaluateNFTLoan(contract.trim(), tokenId.trim(), query);
          console.log("\n" + "═".repeat(80) + "\n");
          console.log(report);
          console.log("\n" + "═".repeat(80) + "\n");
        } catch (error: any) {
          console.error("\n❌ Error:", error.message);
        }
        
        main();
      });
    });
  });
}

process.on("SIGINT", () => {
  console.log("\n\n👋 Shutting down...");
  process.exit(0);
});

main();