/**
 * REAL PROTOCOL PARAMETERS
 * Based on BendDAO BIP#9/BIP#10, JPEG'd PIP-58/PIP-71, Blend Whitepaper
 */

export interface ProtocolConfig {
  name: string;
  type: 'P2Pool' | 'P2P';
  ltv: {
    BLUECHIP: number;
    STANDARD: number;
    RARE_MULTIPLIER: number;
  };
  liquidationThreshold: number;
  liquidationPenalty: number;
  auctionDuration: number;
  supportsPartialRepayment: boolean;
  oracleRequired: boolean;
  bestFor: string;
}

export const LENDING_PROTOCOLS: Record<string, ProtocolConfig> = {
  BEND_DAO: {
    name: 'BendDAO',
    type: 'P2Pool',
    ltv: {
      BLUECHIP: 0.30,      // 30% max LTV
      STANDARD: 0.20,      // 20% for non-bluechip
      RARE_MULTIPLIER: 1.3 // 30% boost for rare traits
    },
    liquidationThreshold: 0.70, // 70% after BIP#9
    liquidationPenalty: 0.05,   // 5% liquidation fee
    auctionDuration: 4 * 60 * 60, // 4 hours (reduced from 48h)
    supportsPartialRepayment: false,
    oracleRequired: true,
    bestFor: 'Bluechip instant loans with oracle protection'
  },
  
  JPEGD: {
    name: "JPEG'd",
    type: 'P2Pool',
    ltv: {
      BLUECHIP: 0.25,      // 25% max (PIP-58)
      STANDARD: 0.10,      // 10% minimum
      RARE_MULTIPLIER: 1.25 // 25% boost
    },
    liquidationThreshold: 0.75,
    liquidationPenalty: 0.10,   // 10% penalty
    auctionDuration: 12 * 60 * 60, // 12 hours (PIP-71)
    supportsPartialRepayment: true,
    oracleRequired: true,
    bestFor: 'Punk/BAYC/MAYC holders seeking highest LTV'
  },
  
  BLEND: {
    name: 'Blend',
    type: 'P2P',
    ltv: {
      BLUECHIP: 0.40,      // Market-determined, typically 40%
      STANDARD: 0.30,
      RARE_MULTIPLIER: 1.5  // 50% boost for exceptional rarities
    },
    liquidationThreshold: 0.85, // Dutch auction based
    liquidationPenalty: 0.0,    // No penalty, auction-based
    auctionDuration: 24 * 60 * 60, // 24 hours max auction
    supportsPartialRepayment: true,
    oracleRequired: false,
    bestFor: 'Long-tail NFTs and collection offers'
  },
  
  NFTFI: {
    name: 'NFTfi',
    type: 'P2P',
    ltv: {
      BLUECHIP: 0.35,
      STANDARD: 0.25,
      RARE_MULTIPLIER: 1.2
    },
    liquidationThreshold: 0.80,
    liquidationPenalty: 0.0,
    auctionDuration: 0,
    supportsPartialRepayment: false,
    oracleRequired: false,
    bestFor: 'Custom loan terms with specific borrowers'
  },
  
  PARA_SPACE: {
    name: 'ParaSpace',
    type: 'P2Pool',
    ltv: {
      BLUECHIP: 0.35,
      STANDARD: 0.25,
      RARE_MULTIPLIER: 1.6 // 60% boost for top traits
    },
    liquidationThreshold: 0.75,
    liquidationPenalty: 0.075, // 7.5% penalty
    auctionDuration: 6 * 60 * 60, // 6 hours
    supportsPartialRepayment: true,
    oracleRequired: true,
    bestFor: 'Rare trait NFTs with highest rarity multipliers'
  }
};

export const COLLECTION_TIERS = {
  BLUECHIP: [
    '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d', // BAYC
    '0x60e4d786628fea6478f785a6d7e704777c86a7c6', // MAYC
    '0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb', // CryptoPunks
    '0xed5af388653567af2f388e6224dc7c4b3241c544', // Azuki
    '0x8a90cab2b38dba80c64b7734e58ee1db38b8992e', // Doodles
    '0x5cc5b05a8a13e3fbdb0bb9fccd98d38e50f90c38'  // Moonbirds
  ],
  
  ESTABLISHED: [
    '0x49cf6f5d44e70224e2e23fdcdd2c053f30ada28b', // CloneX
    '0x524cab2ec691245740bebc45cb7addb2fe7b177a', // Pudgy Penguins
    '0x306b1ea3ecdf94aB739F1910bbda052Ed4A9f949'  // Otherdeed
  ]
};

export const RISK_WEIGHTS = {
  VOLATILITY: 0.35,
  LIQUIDITY: 0.30,
  BLUECHIP_STATUS: 0.20,
  VOLUME_TREND: 0.15
};

export const HEALTH_SCORE_THRESHOLDS = {
  LOW: 1.5,
  MEDIUM: 1.2,
  HIGH: 1.0,
  CRITICAL: 0.0
};
