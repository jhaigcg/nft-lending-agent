import { tool } from "@langchain/core/tools";
import { z } from "zod";
import Moralis from "moralis";
import axios from "axios";

let moralisInitialized = false;

interface NFTMetadata {
  contract: string;
  tokenId: string;
  tokenHash?: string;
  collectionName: string;
  collectionSymbol: string;
  floorPrice: number;
  floorPriceUsd: number;
  imageUrl: string;
  traits: Array<{ key: string; value: string; rarity: number }>;
  lastSalePrice: number;
  lastSaleDate: string;
  ownerOf: string;
  contractType: string;
}

// Collection floor prices (update these periodically with current values)
const COLLECTION_FLOORS: Record<string, { eth: number, name: string }> = {
  "0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb": { eth: 45.5, name: "CryptoPunks" },
  "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d": { eth: 14.2, name: "Bored Ape Yacht Club" },
  "0xbd3531da5cf5857e7cfaa92426877b022e612cf8": { eth: 8.7, name: "Pudgy Penguins" },
  "0xed5af388653567af2f388e6224dc7c4b3241c544": { eth: 4.3, name: "Azuki" },
  "0x8a90cab2b38dba80c64b7734e58ee1db38b8992e": { eth: 2.1, name: "Doodles" },
  "0x23581767a106ae21c074b2276d25e5c3e136a68b": { eth: 3.5, name: "Moonbirds" },
  "0x49cf6f5d44e70224e2e23fdcdd2c053f30ada28b": { eth: 1.8, name: "CloneX" },
};

// Cache ETH price to avoid too many API calls
let cachedEthPrice: number = 3500;
let lastPriceFetch: number = 0;
const PRICE_CACHE_TTL = 60000; // 1 minute

async function getEthPrice(): Promise<number> {
  const now = Date.now();
  if (now - lastPriceFetch < PRICE_CACHE_TTL) {
    return cachedEthPrice;
  }
  
  try {
    const response = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { timeout: 5000 }
    );
    cachedEthPrice = response.data.ethereum.usd;
    lastPriceFetch = now;
    console.error(`💰 ETH Price: $${cachedEthPrice}`);
  } catch (e) {
    console.error("⚠️ Failed to fetch ETH price, using cached/fallback value");
  }
  return cachedEthPrice;
}

async function initializeMoralis() {
  if (moralisInitialized) return true;
  
  try {
    await Moralis.start({
      apiKey: process.env.MORALIS_API_KEY,
    });
    moralisInitialized = true;
    console.error("✅ Moralis initialized");
    return true;
  } catch (error: any) {
    // Check if it's already initialized
    if (error.message && error.message.includes("already started")) {
      moralisInitialized = true;
      console.error("✅ Moralis already initialized");
      return true;
    }
    console.error("❌ Failed to initialize Moralis:", error.message);
    return false;
  }
}

export const nftMetadataTool = tool(
  async ({ contract, tokenId }) => {
    console.error(`🔍 Fetching NFT data: ${contract}/${tokenId}`);
    
    try {
      // Initialize Moralis if not already done
      const initialized = await initializeMoralis();
      if (!initialized) {
        throw new Error("Failed to initialize Moralis");
      }

      // Get NFT metadata from Moralis
      const nftResponse = await Moralis.EvmApi.nft.getNFTMetadata({
        chain: "0x1", // Ethereum mainnet
        address: contract,
        tokenId: tokenId,
        normalizeMetadata: true,
      });

      const nft = nftResponse?.result;
      if (!nft) throw new Error("NFT not found");

      // Cast nft to any to access properties that might not be in type definitions
      const nftAny = nft as any;
      
      // Parse metadata
      const metadata = typeof nftAny.metadata === 'string' 
        ? JSON.parse(nftAny.metadata) 
        : nftAny.metadata || {};

      const contractLower = contract.toLowerCase();
      
      // Handle image URL - try multiple possible locations
      let imageUrl = nftAny.image || 
                     nftAny.normalizedMetadata?.image || 
                     metadata.image || 
                     metadata.image_url || 
                     metadata.imageUrl || 
                     "";
      
      // Process traits
      let traits: Array<{ key: string; value: string; rarity: number }> = [];
      
      // Special handling for CryptoPunks
      if (contractLower === "0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb") {
        console.error("🔍 Detected CryptoPunk - using special handling");
        
        if (metadata.attributes && Array.isArray(metadata.attributes)) {
          traits = metadata.attributes.map((attr: any) => ({
            key: attr.trait_type || "type",
            value: String(attr.value || attr || "Unknown"),
            rarity: 0.3, // Punks are generally rare
          }));
        } else {
          // If no attributes, add a default trait based on type
          traits = [{
            key: "type",
            value: metadata.type || "CryptoPunk",
            rarity: 0.3
          }];
        }
        
        // CryptoPunks image URL format
        if (!imageUrl) {
          imageUrl = `https://www.larvalabs.com/cryptopunks/cryptopunk${tokenId}.png`;
        }
      } 
      // Standard ERC-721 handling for other collections
      else {
        if (metadata.attributes && Array.isArray(metadata.attributes)) {
          traits = metadata.attributes.map((attr: any) => ({
            key: String(attr.trait_type || attr.key || "unknown"),
            value: String(attr.value || ""),
            rarity: typeof attr.rarity === 'number' ? attr.rarity : 0.5,
          }));
          console.error(`📋 Found ${traits.length} traits in attributes`);
        } else if (metadata.traits && Array.isArray(metadata.traits)) {
          traits = metadata.traits.map((trait: any) => ({
            key: String(trait.trait_type || trait.key || "unknown"),
            value: String(trait.value || ""),
            rarity: 0.5,
          }));
          console.error(`📋 Found ${traits.length} traits in traits field`);
        }
      }
      
      // If no traits found, create a default trait from collection name
      if (traits.length === 0) {
        console.error("⚠️ No traits found, using default");
        traits = [{
          key: "collection",
          value: COLLECTION_FLOORS[contractLower]?.name || "NFT",
          rarity: 0.5
        }];
      }

      // Get floor price from our mapping
      const floorPrice = COLLECTION_FLOORS[contractLower]?.eth || 0.1;
      const collectionName = COLLECTION_FLOORS[contractLower]?.name || 
                              nftAny.name || 
                              metadata.name || 
                              "Unknown Collection";
      
      // Get current ETH price for USD conversion
      const ethPrice = await getEthPrice();
      const floorPriceUsd = floorPrice * ethPrice;

      // Log the collected data for debugging
      console.error(`   Collection: ${collectionName}`);
      console.error(`   Floor price: ${floorPrice} ETH ($${Math.round(floorPriceUsd).toLocaleString()})`);
      console.error(`   Traits: ${traits.length}`);

      const result: NFTMetadata = {
        contract: String(nftAny.tokenAddress || contract),
        tokenId: String(nftAny.tokenId || tokenId),
        tokenHash: nftAny.tokenHash,
        collectionName: collectionName,
        collectionSymbol: nftAny.symbol || "",
        floorPrice: floorPrice,
        floorPriceUsd: floorPriceUsd,
        imageUrl: imageUrl,
        traits: traits,
        lastSalePrice: 0,
        lastSaleDate: "",
        ownerOf: "",
        contractType: nftAny.contractType || "ERC721",
      };

      return JSON.stringify(result, null, 2);
      
    } catch (error: any) {
      console.error("❌ NFT data fetch failed:", error.message);
      
      // Return fallback data for known collections even on error
      const contractLower = contract.toLowerCase();
      if (COLLECTION_FLOORS[contractLower]) {
        console.error("⚠️ Returning fallback data for known collection");
        const ethPrice = await getEthPrice();
        const floorPrice = COLLECTION_FLOORS[contractLower].eth;
        
        const fallbackResult: NFTMetadata = {
          contract: contract,
          tokenId: tokenId,
          collectionName: COLLECTION_FLOORS[contractLower].name,
          collectionSymbol: "",
          floorPrice: floorPrice,
          floorPriceUsd: floorPrice * ethPrice,
          imageUrl: `https://via.placeholder.com/400?text=${COLLECTION_FLOORS[contractLower].name.replace(/ /g, '+')}+${tokenId}`,
          traits: [{ key: "type", value: "NFT", rarity: 0.5 }],
          lastSalePrice: 0,
          lastSaleDate: "",
          ownerOf: "",
          contractType: "ERC721",
        };
        return JSON.stringify(fallbackResult, null, 2);
      }
      
      return JSON.stringify({ 
        error: "Failed to fetch NFT data", 
        details: error.message 
      });
    }
  },
  {
    name: "get_nft_metadata",
    description: "Fetch NFT metadata, traits, and collection info using Moralis",
    schema: z.object({
      contract: z.string().describe("NFT contract address"),
      tokenId: z.string().describe("Token ID"),
    }),
  }
);