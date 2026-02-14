import { tool } from "@langchain/core/tools";
import { z } from "zod";

interface ReportData {
  report: string;
  summary: string;
}

export const reportGeneratorTool = tool(
  async ({ 
    nftData,
    rarityScore,
    loanEstimate,
    userQuery 
  }) => {
    console.error(`📝 Generating loan assessment report...`);
    
    try {
      // Parse JSON data with error handling
      let nft: any = {};
      let rarity: any = {};
      let loan: any = {};
      
      try {
        nft = nftData ? JSON.parse(nftData) : {};
        console.error(`   NFT: ${nft.collectionName} #${nft.tokenId}`);
      } catch (e) {
        console.error("⚠️ Error parsing nftData, using defaults");
        nft = { 
          collectionName: "Unknown", 
          tokenId: "Unknown", 
          traits: [],
          imageUrl: "",
          contract: "",
          floorPrice: 0.1
        };
      }
      
      try {
        rarity = rarityScore ? JSON.parse(rarityScore) : {};
        console.error(`   Rarity score: ${rarity.overallRarity}, Premium: ${rarity.estimatedPremium}%`);
      } catch (e) {
        console.error("⚠️ Error parsing rarityScore, using defaults");
        rarity = { 
          overallRarity: 50, 
          percentile: 50, 
          estimatedPremium: 25, 
          rareTraits: [] 
        };
      }
      
      try {
        loan = loanEstimate ? JSON.parse(loanEstimate) : {};
        console.error(`   Loan: $${loan.recommendedLoanUsdt} at ${loan.ltvRatio}% LTV`);
      } catch (e) {
        console.error("⚠️ Error parsing loanEstimate, using defaults");
        loan = { 
          ethPrice: 3500,
          floorPrice: 0.1,
          estimatedValueEth: 0.1,
          estimatedValueUsd: 350,
          ltvRatio: 30,
          recommendedLoanUsdt: 105,
          riskLevel: "Medium",
          liquidationThreshold: 45,
          interestRate: 10,
          maxLtv: 70,
          reasoning: ["Using default values due to limited data"]
        };
      }

      const timestamp = new Date().toLocaleString();
      
      // Format NFT identifier
      const collectionName = nft.collectionName || "Unknown Collection";
      const tokenId = nft.tokenId || "Unknown";
      const nftId = `${collectionName} #${tokenId}`;
      const contract = nft.contract || "Unknown";
      const shortAddress = contract.length > 10 ? `${contract.slice(0, 6)}...${contract.slice(-4)}` : contract;

      // Format trait count
      const traitCount = nft.traits?.length || 0;
      
      // Format rare traits list
      const rareTraitsList = rarity.rareTraits?.length > 0 
        ? rarity.rareTraits.join(", ") 
        : "None identified";

      // Get loan values (using real calculated data)
      const ethPrice = loan.ethPrice || 3500;
      const floorPrice = loan.floorPrice || nft.floorPrice || 0.1;
      const estimatedValueEth = loan.estimatedValueEth || floorPrice;
      const estimatedValueUsd = loan.estimatedValueUsd || (estimatedValueEth * ethPrice);
      const ltvRatio = loan.ltvRatio || 40;
      const recommendedLoanUsdt = loan.recommendedLoanUsdt || Math.round(estimatedValueUsd * ltvRatio / 100);
      const riskLevel = loan.riskLevel || "Medium";
      const interestRate = loan.interestRate || 10;
      const liquidationThreshold = loan.liquidationThreshold || 55;
      const maxLtv = loan.maxLtv || 70;
      const reasoning = loan.reasoning || ["Standard underwriting criteria applied"];

      console.error(`   Final loan amount: $${recommendedLoanUsdt.toLocaleString()} USDT`);

      // Build the markdown report
      const report = `
# 🏛️ NFT Lending Assessment Report

**Generated:** ${timestamp}  
**Agent:** NFT Lending Evaluator v1.0  
**Query:** ${userQuery || "NFT loan inquiry"}

---

## 1. Collateral Summary

| Property | Value |
|----------|-------|
| **NFT** | ${nftId} |
| **Contract** | \`${shortAddress}\` |
| **Collection** | ${collectionName} |
| **Token ID** | ${tokenId} |
| **Trait Count** | ${traitCount} |
| **Floor Price** | ${floorPrice.toFixed(2)} ETH ($${Math.round(floorPrice * ethPrice).toLocaleString()}) |

${nft.imageUrl ? `![NFT Image](${nft.imageUrl})` : "*No image available*"}

---

## 2. Rarity Analysis

| Metric | Value |
|--------|-------|
| **Rarity Score** | ${rarity.overallRarity || 50}/100 |
| **Rarity Percentile** | Top ${rarity.percentile || 50}% |
| **Estimated Premium** | +${rarity.estimatedPremium || 25}% above floor |
| **Rare Traits** | ${rareTraitsList} |

---

## 3. Loan Terms (USDT)

| Metric | Value |
|--------|-------|
| **Estimated Fair Value** | ${estimatedValueEth.toFixed(3)} ETH ($${Math.round(estimatedValueUsd).toLocaleString()}) |
| **LTV Ratio** | ${ltvRatio}% (Max: ${maxLtv}%) |
| **💵 RECOMMENDED LOAN** | **$${recommendedLoanUsdt.toLocaleString()} USDT** |
| **Risk Level** | ${riskLevel} |
| **Interest Rate (APY)** | ${interestRate}% |
| **Liquidation Threshold** | ${liquidationThreshold}% |

---

## 4. Risk Assessment

**Risk Rating:** ${riskLevel} ${
  riskLevel === "Low" ? "✅" : 
  riskLevel === "Medium" ? "⚠️" : 
  riskLevel === "High" ? "🔴" : "❓"
}

**Underwriting Notes:**
${reasoning.map((r: string) => `- ${r}`).join("\n")}

**Market Context:**
- ETH Price: $${ethPrice.toLocaleString()}
- Collection Floor: ${floorPrice.toFixed(2)} ETH

---

## 5. Recommendation

**${
  riskLevel === "Low" ? "✅ APPROVE" : 
  riskLevel === "Medium" ? "⚠️ APPROVE WITH CAUTION" : 
  riskLevel === "High" ? "🔴 CONSIDER REJECTING" : 
  "📋 REVIEW REQUIRED"
}**

${
  riskLevel === "Low" ? "This NFT shows strong characteristics as collateral with rare traits and healthy collection metrics." :
  riskLevel === "Medium" ? "Acceptable collateral with moderate risk. Consider standard loan terms." :
  riskLevel === "High" ? "High risk collateral - consider alternative assets or reduced LTV." :
  "Insufficient data for full assessment. Manual review recommended."
}

---

*Report generated by NFT Lending Evaluator Agent – Tether Technical Project*
`;

      const result: ReportData = { 
        report,
        summary: `${nftId}: $${recommendedLoanUsdt.toLocaleString()} USDT @ ${ltvRatio}% LTV (${riskLevel} risk)`
      };
      
      console.error(`✅ Report generated successfully`);
      return JSON.stringify(result, null, 2);
      
    } catch (error: any) {
      console.error("❌ Report generation failed:", error.message);
      
      // Return a basic report even on catastrophic error
      const fallbackReport = `
# 🏛️ NFT Lending Assessment Report

**Generated:** ${new Date().toLocaleString()}  
**Status:** Limited Data Available

---

## ⚠️ Notice

The assessment could not be fully completed due to: ${error.message}

Please verify the NFT contract address and token ID are correct.

---

*Report generated by NFT Lending Evaluator Agent – Tether Technical Project*
`;
      return JSON.stringify({ 
        report: fallbackReport,
        summary: "Assessment incomplete - please try again"
      });
    }
  },
  {
    name: "generate_lending_report",
    description: "Create a professional markdown report with loan assessment",
    schema: z.object({
      nftData: z.string().optional().default("{}").describe("JSON string from get_nft_metadata"),
      rarityScore: z.string().optional().default("{}").describe("JSON string from analyze_rarity"),
      loanEstimate: z.string().optional().default("{}").describe("JSON string from calculate_loan_estimate"),
      userQuery: z.string().optional().default("NFT loan inquiry").describe("Original user query"),
    }),
  }
);