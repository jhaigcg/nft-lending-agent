import { tool } from "@langchain/core/tools";
import { z } from "zod";

interface RarityScore {
  overallRarity: number;
  traitCount: number;
  rareTraits: string[];
  percentile: number;
  estimatedPremium: number;
}

// Simple rarity estimates (in real app, you'd fetch from a rarity API)
const TRAIT_RARITY: Record<string, Record<string, number>> = {
  "PudgyPenguins": {
    "Background:Mint": 0.15,      // 15% have this
    "Background:Olive Green": 0.08, // 8% have this
    "Skin:Olive Green": 0.12,
    "Body:Surfboard Necklace": 0.05,
    "Face:Monocle": 0.03,          // Rare! Only 3%
    "Head:Flat Cap Tan": 0.07,
  }
};

export const rarityAnalysisTool = tool(
  async ({ traits, floorPrice, collectionName = "Unknown" }) => {
    console.error(`📊 Analyzing rarity for ${collectionName}...`);
    
    try {
      let traitArray = [];
      
      if (traits && traits !== "undefined" && traits !== "null") {
        try {
          traitArray = JSON.parse(traits);
        } catch (e) {
          console.error("⚠️ Failed to parse traits:", e);
          traitArray = [];
        }
      }

      if (!Array.isArray(traitArray) || traitArray.length === 0) {
        return JSON.stringify({
          overallRarity: 50,
          traitCount: 0,
          rareTraits: [],
          percentile: 50,
          estimatedPremium: 25,
          note: "Using default rarity - limited trait data"
        });
      }

      console.error(`📋 Found ${traitArray.length} traits:`);
      traitArray.forEach((t: any) => {
        console.error(`  - ${t.key}: ${t.value}`);
      });

      // Calculate rarity based on trait combinations
      let rarityScore = 0;
      const rareTraits: string[] = [];
      
      // Check each trait against our rarity database
      for (const trait of traitArray) {
        const key = `${trait.key}:${trait.value}`;
        const collectionRarities = TRAIT_RARITY["PudgyPenguins"] || {};
        const traitRarity = collectionRarities[key] || 0.1; // Default 10% rarity
        
        // Rarer = higher score (inverse of percentage)
        const traitScore = (1 / traitRarity) * 10;
        rarityScore += traitScore;
        
        // If less than 5% have this trait, mark as rare
        if (traitRarity < 0.05) {
          rareTraits.push(`${trait.key}: ${trait.value} (${(traitRarity * 100).toFixed(1)}%)`);
        }
      }

      // Normalize score (max around 100)
      const overallRarity = Math.min(100, rarityScore);
      
      // Calculate estimated premium based on rarity
      let estimatedPremium = 0;
      if (overallRarity > 80) estimatedPremium = 100;
      else if (overallRarity > 60) estimatedPremium = 75;
      else if (overallRarity > 40) estimatedPremium = 50;
      else if (overallRarity > 20) estimatedPremium = 25;
      else estimatedPremium = 10;
      
      const percentile = 100 - overallRarity;

      const result: RarityScore = {
        overallRarity: Math.round(overallRarity * 100) / 100,
        traitCount: traitArray.length,
        rareTraits,
        percentile: Math.round(percentile * 100) / 100,
        estimatedPremium,
      };

      console.error(`📊 Rarity score: ${result.overallRarity}, Premium: ${result.estimatedPremium}%`);
      return JSON.stringify(result, null, 2);
      
    } catch (error: any) {
      console.error("❌ Rarity analysis failed:", error.message);
      const defaultResult: RarityScore = {
        overallRarity: 50,
        traitCount: 0,
        rareTraits: [],
        percentile: 50,
        estimatedPremium: 25,
      };
      return JSON.stringify(defaultResult, null, 2);
    }
  },
  {
    name: "analyze_rarity",
    description: "Calculate NFT rarity score and estimated price premium",
    schema: z.object({
      traits: z.string().optional().default("[]").describe("JSON string of NFT traits"),
      floorPrice: z.number().optional().default(0.1).describe("Collection floor price in ETH"),
      collectionName: z.string().optional().describe("Name of the collection"),
    }),
  }
);