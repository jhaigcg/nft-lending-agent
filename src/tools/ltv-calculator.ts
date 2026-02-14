import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";

interface LoanEstimate {
  ethPrice: number;
  floorPrice: number;
  estimatedValueEth: number;
  estimatedValueUsd: number;
  ltvRatio: number;
  recommendedLoanUsdt: number;
  riskLevel: "Low" | "Medium" | "High" | "Very High";
  liquidationThreshold: number;
  interestRate: number;
  maxLtv: number;
  reasoning: string[];
}

export const ltvCalculatorTool = tool(
  async ({ floorPrice = 0.1, rarityPremium = 0 }) => {
    console.error(`💰 Calculating LTV and USDT loan amount...`);
    console.error(`   Floor price: ${floorPrice} ETH, Premium: ${rarityPremium}%`);
    
    try {
      // Get current ETH/USDT price
      let ethPrice = 3500;
      try {
        const response = await axios.get(
          "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
          { timeout: 5000 }
        );
        ethPrice = response.data.ethereum.usd;
        console.error(`   ETH Price: $${ethPrice}`);
      } catch (e) {
        console.error("⚠️ Failed to fetch ETH price, using fallback");
      }

      // Calculate fair value using ACTUAL floor price
      const baseValue = Math.max(floorPrice || 0.1, 0.01);
      const premiumMultiplier = 1 + (Math.max(rarityPremium || 0, 0) / 100);
      const estimatedValueEth = baseValue * premiumMultiplier;
      const estimatedValueUsd = estimatedValueEth * ethPrice;

      console.error(`   Estimated value: ${estimatedValueEth.toFixed(3)} ETH ($${Math.round(estimatedValueUsd)})`);

      // Determine LTV based on risk
      let ltvRatio = 40;
      let riskLevel: "Low" | "Medium" | "High" | "Very High" = "Medium";
      const reasoning: string[] = [];

      if (rarityPremium > 50) {
        ltvRatio += 10;
        reasoning.push("✅ Rare trait premium (+10% LTV)");
        riskLevel = "Low";
      } else if (rarityPremium > 25) {
        ltvRatio += 5;
        reasoning.push("✅ Above average rarity (+5% LTV)");
        riskLevel = "Low";
      } else if (rarityPremium < 10 && rarityPremium > 0) {
        ltvRatio -= 5;
        reasoning.push("⚠️ Common traits (-5% LTV)");
        riskLevel = "High";
      } else {
        reasoning.push("📊 Standard risk profile applied");
      }

      // Blue chip collections get better LTV
      if (floorPrice > 5) {
        ltvRatio += 5;
        reasoning.push("✅ Blue chip collection (+5% LTV)");
      }

      const maxLtv = 70;
      ltvRatio = Math.min(Math.max(ltvRatio, 20), maxLtv);
      
      const recommendedLoanUsdt = (estimatedValueUsd * ltvRatio) / 100;
      
      let interestRate = 8;
      if (riskLevel === "Low") interestRate = 6;
      else if (riskLevel === "Medium") interestRate = 10;
      else if (riskLevel === "High") interestRate = 15;

      const result: LoanEstimate = {
        ethPrice,
        floorPrice,
        estimatedValueEth: Number(estimatedValueEth.toFixed(3)),
        estimatedValueUsd: Math.round(estimatedValueUsd),
        ltvRatio: Math.round(ltvRatio),
        recommendedLoanUsdt: Math.round(recommendedLoanUsdt),
        riskLevel,
        liquidationThreshold: Math.min(ltvRatio + 15, 85),
        interestRate,
        maxLtv,
        reasoning,
      };

      console.error(`   Recommended loan: $${result.recommendedLoanUsdt} USDT at ${result.ltvRatio}% LTV`);
      return JSON.stringify(result, null, 2);
    } catch (error: any) {
      console.error("❌ LTV calculation failed:", error.message);
      const fallbackResult: LoanEstimate = {
        ethPrice: 3500,
        floorPrice: floorPrice,
        estimatedValueEth: floorPrice,
        estimatedValueUsd: floorPrice * 3500,
        ltvRatio: 30,
        recommendedLoanUsdt: Math.round(floorPrice * 3500 * 0.3),
        riskLevel: "High",
        liquidationThreshold: 45,
        interestRate: 15,
        maxLtv: 70,
        reasoning: ["⚠️ Using conservative estimates due to calculation error"]
      };
      return JSON.stringify(fallbackResult, null, 2);
    }
  },
  {
    name: "calculate_loan_estimate",
    description: "Calculate USDT loan amount based on NFT value and risk",
    schema: z.object({
      floorPrice: z.number().optional().default(0.1).describe("Collection floor price in ETH"),
      rarityPremium: z.number().optional().default(0).describe("Estimated % premium above floor"),
    }),
  }
);