import { LENDING_PROTOCOLS, COLLECTION_TIERS, RISK_WEIGHTS, HEALTH_SCORE_THRESHOLDS } from '../utils/constants';
import { RelayService } from '../services/relayService';

export interface RiskAssessment {
  collectionAddress: string;
  collectionName: string;
  floorPrice: number;
  twapPrice: number;
  ltvRecommendations: Record<string, LTVRecommendation>;
  riskScore: number;
  volatilityIndex: number;
  liquidityScore: number;
  isBluechip: boolean;
  recommendations: string[];
  timestamp: number;
}

export interface LTVRecommendation {
  baseLTV: number;
  adjustedLTV: number;
  liquidationThreshold: number;
  healthScore: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  maxLoanAmount: number;
  protocolName: string;
}

export class RiskAgent {
  private relayService: RelayService;

  constructor() {
    this.relayService = new RelayService();
  }

  /**
   * Calculate volatility index based on TWAP vs spot differential
   */
  private calculateVolatilityIndex(floor: number, twap: number): number {
    if (floor === 0 || twap === 0) return 0.5;
    const differential = Math.abs(floor - twap) / Math.max(floor, twap);
    return parseFloat(Math.min(differential * 2, 1).toFixed(2));
  }

  /**
   * Calculate liquidity score based on 24h volume and owner count
   */
  private calculateLiquidityScore(volume24h: number, ownerCount: number): number {
    const volumeScore = Math.min(volume24h / 100, 1);
    const ownerScore = Math.min(ownerCount / 1000, 1);
    return parseFloat(((volumeScore * 0.6) + (ownerScore * 0.4)).toFixed(2));
  }

  /**
   * Check if collection is bluechip
   */
  private isBluechipCollection(address: string): boolean {
    return COLLECTION_TIERS.BLUECHIP.some(
      bluechip => bluechip.toLowerCase() === address.toLowerCase()
    );
  }

  /**
   * Calculate health score using liquidation threshold model
   */
  private calculateHealthScore(
    collateralValue: number,
    loanAmount: number,
    liquidationThreshold: number
  ): number {
    if (loanAmount === 0) return 3.0;
    return parseFloat(((collateralValue * liquidationThreshold) / loanAmount).toFixed(2));
  }

  /**
   * Get risk level from health score
   */
  private getRiskLevel(healthScore: number): 'Low' | 'Medium' | 'High' | 'Critical' {
    if (healthScore >= HEALTH_SCORE_THRESHOLDS.LOW) return 'Low';
    if (healthScore >= HEALTH_SCORE_THRESHOLDS.MEDIUM) return 'Medium';
    if (healthScore >= HEALTH_SCORE_THRESHOLDS.HIGH) return 'High';
    return 'Critical';
  }

  /**
   * Main collection risk assessment
   */
  async assessCollection(collectionAddress: string): Promise<RiskAssessment> {
    // Fetch real-time data
    const summary = await this.relayService.getCollectionSummary(collectionAddress);
    const isBluechip = this.isBluechipCollection(collectionAddress);
    
    // Calculate risk metrics
    const volatilityIndex = this.calculateVolatilityIndex(
      summary.floorPrice,
      summary.twapPrice
    );
    
    const liquidityScore = this.calculateLiquidityScore(
      summary.volume24h,
      summary.ownerCount
    );

    // Overall risk score (0-100)
    const riskScore = Math.min(100, Math.round(
      (volatilityIndex * RISK_WEIGHTS.VOLATILITY * 100) +
      ((1 - liquidityScore) * RISK_WEIGHTS.LIQUIDITY * 100) +
      (isBluechip ? 0 : RISK_WEIGHTS.BLUECHIP_STATUS * 100) +
      (summary.volume24h < 10 ? RISK_WEIGHTS.VOLUME_TREND * 100 : 0)
    ));

    // Generate LTV recommendations for each protocol
    const ltvRecommendations: Record<string, LTVRecommendation> = {};

    for (const [protocolName, config] of Object.entries(LENDING_PROTOCOLS)) {
      // Base LTV by tier
      let baseLTV = isBluechip 
        ? config.ltv.BLUECHIP 
        : config.ltv.STANDARD;

      // Risk adjustments
      let adjustedLTV = baseLTV * (1 - (volatilityIndex * 0.3));
      adjustedLTV = adjustedLTV * (0.8 + (liquidityScore * 0.4));
      
      // Apply caps
      const maxLTV = isBluechip ? config.ltv.BLUECHIP : config.ltv.STANDARD;
      adjustedLTV = Math.min(adjustedLTV, maxLTV * 1.1);
      adjustedLTV = Math.max(adjustedLTV, 0.05);

      // Calculate max loan
      const maxLoanAmount = parseFloat((summary.twapPrice * adjustedLTV).toFixed(4));

      // Calculate health score
      const healthScore = this.calculateHealthScore(
        summary.twapPrice,
        maxLoanAmount,
        config.liquidationThreshold
      );

      ltvRecommendations[protocolName] = {
        protocolName: config.name,
        baseLTV: parseFloat(baseLTV.toFixed(3)),
        adjustedLTV: parseFloat(adjustedLTV.toFixed(3)),
        liquidationThreshold: config.liquidationThreshold,
        healthScore,
        riskLevel: this.getRiskLevel(healthScore),
        maxLoanAmount
      };
    }

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (volatilityIndex > 0.4) {
      recommendations.push('⚠️ High volatility detected - Use BendDAO/JPEG’d for oracle protection');
    }
    
    if (!isBluechip) {
      recommendations.push('📊 Non-bluechip collection - Blend or NFTfi offer better rates');
    }
    
    if (liquidityScore < 0.3) {
      recommendations.push('💧 Low liquidity - Consider shorter loan terms (7-14 days)');
    }

    if (summary.volume24h < 5) {
      recommendations.push('📉 Very low 24h volume - Reduce LTV by 20-30%');
    }

    if (summary.floorPrice > summary.twapPrice * 1.2) {
      recommendations.push('🛡️ Floor price > TWAP by 20%+ - Possible manipulation, use TWAP for valuation');
    }

    return {
      collectionAddress,
      collectionName: summary.name,
      floorPrice: summary.floorPrice,
      twapPrice: summary.twapPrice,
      ltvRecommendations,
      riskScore,
      volatilityIndex,
      liquidityScore,
      isBluechip,
      recommendations,
      timestamp: Date.now()
    };
  }
}
