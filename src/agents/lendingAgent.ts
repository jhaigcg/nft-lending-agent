import { LENDING_PROTOCOLS } from '../utils/constants';

export interface LoanTerm {
  protocol: string;
  type: string;
  maxLoan: number;
  ltv: number;
  interestRate: string;
  auctionDuration: string;
  partialRepayment: string;
  oracleRequired: string;
  bestFor: string;
}

export interface LiquidationSimulation {
  protocol: string;
  triggerPrice: number;
  currentPrice: number;
  priceDropPercentage: number;
  auctionDuration: number;
  estimatedRecoveryRate: number;
  lenderLossGivenDefault: number;
  borrowerEquity: number;
  auctionStressTest: {
    successRate: number;
    timeToLiquidation: number;
    worstCaseRecovery: number;
  };
}

export class LendingAgent {
  /**
   * Compare loan terms across all protocols
   */
  compareLoanTerms(floorPrice: number, isBluechip: boolean): LoanTerm[] {
    const results: LoanTerm[] = [];

    for (const [protocol, config] of Object.entries(LENDING_PROTOCOLS)) {
      const baseLTV = isBluechip ? config.ltv.BLUECHIP : config.ltv.STANDARD;
      const maxLoan = floorPrice * baseLTV;
      
      // Estimate interest rates based on protocol type
      let annualInterest: number;
      if (config.type === 'P2Pool') {
        annualInterest = isBluechip ? 0.12 : 0.18;
      } else {
        annualInterest = isBluechip ? 0.15 : 0.25;
      }

      results.push({
        protocol: config.name,
        type: config.type,
        maxLoan: parseFloat(maxLoan.toFixed(4)),
        ltv: baseLTV,
        interestRate: `${(annualInterest * 100).toFixed(1)}% APR`,
        auctionDuration: config.auctionDuration > 0 ? `${config.auctionDuration / 3600}h` : 'N/A',
        partialRepayment: config.supportsPartialRepayment ? '✅ Yes' : '❌ No',
        oracleRequired: config.oracleRequired ? '✅ Yes' : '❌ No',
        bestFor: config.bestFor
      });
    }

    return results.sort((a, b) => b.maxLoan - a.maxLoan);
  }

  /**
   * Simulate liquidation using Dutch auction model
   */
  async simulateLiquidation(
    collectionAddress: string,
    loanAmount: number,
    protocolName: string,
    floorPrice: number,
    twapPrice: number
  ): Promise<LiquidationSimulation> {
    const protocol = LENDING_PROTOCOLS[protocolName as keyof typeof LENDING_PROTOCOLS];
    
    if (!protocol) {
      throw new Error(`Protocol ${protocolName} not found`);
    }

    // Use TWAP for more stable liquidation calculations
    const collateralValue = twapPrice;
    const triggerPrice = loanAmount / protocol.liquidationThreshold;
    const priceDrop = Math.max(0, (collateralValue - triggerPrice) / collateralValue);
    
    // Dutch auction success probability
    const successRate = Math.max(0.1, Math.min(0.95, 
      0.9 - (priceDrop * 0.5)
    ));
    
    return {
      protocol: protocol.name,
      triggerPrice: parseFloat(triggerPrice.toFixed(4)),
      currentPrice: floorPrice,
      priceDropPercentage: parseFloat((priceDrop * 100).toFixed(2)),
      auctionDuration: protocol.auctionDuration,
      estimatedRecoveryRate: parseFloat(
        Math.min(0.95, (collateralValue / loanAmount) * 0.9).toFixed(2)
      ),
      lenderLossGivenDefault: parseFloat(
        Math.max(0, loanAmount - collateralValue * 0.85).toFixed(4)
      ),
      borrowerEquity: parseFloat(
        Math.max(0, collateralValue - loanAmount).toFixed(4)
      ),
      auctionStressTest: {
        successRate: parseFloat(successRate.toFixed(2)),
        timeToLiquidation: Math.round(
          protocol.auctionDuration > 0 
            ? protocol.auctionDuration * (1 + (1 - priceDrop)) / 3600
            : 24
        ),
        worstCaseRecovery: parseFloat((collateralValue * 0.85).toFixed(4))
      }
    };
  }

  /**
   * Calculate optimal loan amounts based on risk tolerance
   */
  calculateOptimalLoan(
    floorPrice: number,
    twapPrice: number,
    riskScore: number,
    isBluechip: boolean
  ): {
    conservative: number;
    moderate: number;
    aggressive: number;
  } {
    const baseValue = twapPrice;
    const riskMultiplier = 1 - (riskScore / 200);
    
    return {
      conservative: parseFloat((baseValue * 0.15 * riskMultiplier).toFixed(4)),
      moderate: parseFloat((baseValue * 0.25 * (isBluechip ? 1.2 : 1)).toFixed(4)),
      aggressive: parseFloat((baseValue * 0.35 * (isBluechip ? 1.1 : 0.9)).toFixed(4))
    };
  }
}
