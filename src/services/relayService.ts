import axios, { AxiosInstance } from 'axios';
import NodeCache from 'node-cache';

// Types
export interface PriceData {
  floor: number;
  twap: number;
  timestamp: number;
}

export interface CollectionMetadata {
  name: string;
  address: string;
  tokenCount: number;
  volume24h: number;
  volume7d: number;
  salesCount24h: number;
  ownerCount: number;
  floorPrice: number;
}

export interface Sale {
  price: {
    amount: {
      native: string;
    };
  };
  timestamp: number;
}

export class RelayService {
  private client: AxiosInstance;
  private cache: NodeCache;
  private baseUrl: string;
  private useMockData: boolean;

  constructor() {
    this.baseUrl = process.env.RELAY_API_URL || 'https://api.relay.link';
    this.useMockData = process.env.NODE_ENV === 'development';
    this.cache = new NodeCache({ stdTTL: 300 }); // 5 minute cache
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'NFT-Lending-Agent/1.0'
      }
    });
  }

  /**
   * Get floor price with TWAP smoothing (5-minute window)
   * Public endpoint - NO AUTHENTICATION REQUIRED
   */
  async getFloorPriceWithTWAP(collectionAddress: string): Promise<PriceData> {
    const cacheKey = `twap-${collectionAddress}`;
    const cached = this.cache.get<PriceData>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // Get current floor price
      const collectionsRes = await this.client.get('/collections/v5', {
        params: { 
          id: collectionAddress,
          includeTopBid: true 
        }
      });

      // Get recent sales for TWAP calculation
      const salesRes = await this.client.get('/sales/v6', {
        params: {
          collection: collectionAddress,
          limit: 100,
          sortBy: 'timestamp',
          sortDirection: 'desc'
        }
      });

      const currentFloor = parseFloat(
        collectionsRes.data.collections?.[0]?.floorAsk?.price?.amount?.native || '0'
      );

      // Calculate TWAP from last 5 minutes of sales
      const fiveMinAgo = Math.floor(Date.now() / 1000) - 300;
      const recentSales = (salesRes.data.sales || []).filter(
        (sale: Sale) => sale.timestamp > fiveMinAgo
      );

      let twap = currentFloor;
      if (recentSales.length > 0) {
        const totalPrice = recentSales.reduce(
          (sum: number, sale: Sale) => sum + parseFloat(sale.price?.amount?.native || '0'),
          0
        );
        twap = totalPrice / recentSales.length;
      }

      // Blend floor and TWAP (60/40 split - industry standard)
      const blendedPrice = (currentFloor * 0.6) + (twap * 0.4);
      
      const result: PriceData = {
        floor: parseFloat(currentFloor.toFixed(4)),
        twap: parseFloat(blendedPrice.toFixed(4)),
        timestamp: Date.now()
      };

      this.cache.set(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Relay API error:', error);
      
      // Return mock data for development
      if (this.useMockData) {
        console.log('⚠️ Using mock price data for development');
        return {
          floor: 15.5,
          twap: 14.8,
          timestamp: Date.now()
        };
      }
      throw new Error('Failed to fetch pricing data from Relay API');
    }
  }

  /**
   * Get collection metadata
   */
  async getCollectionMetadata(collectionAddress: string): Promise<CollectionMetadata> {
    try {
      const response = await this.client.get('/collections/v5', {
        params: {
          id: collectionAddress,
          includeSalesCount: true,
          includeTopBid: true
        }
      });

      const collection = response.data.collections?.[0] || {};
      const priceData = await this.getFloorPriceWithTWAP(collectionAddress);
      
      return {
        name: collection.name || 'Unknown Collection',
        address: collection.id || collectionAddress,
        tokenCount: collection.tokenCount || 0,
        volume24h: parseFloat(collection.volume?.['1day']?.amount?.native || '0'),
        volume7d: parseFloat(collection.volume?.['7day']?.amount?.native || '0'),
        salesCount24h: collection.salesCount?.['1day'] || 0,
        ownerCount: collection.ownerCount || 0,
        floorPrice: priceData.floor
      };
    } catch (error) {
      console.error('Error fetching metadata:', error);
      
      if (this.useMockData) {
        return {
          name: 'BAYC (Mock)',
          address: collectionAddress,
          tokenCount: 10000,
          volume24h: 1250.5,
          volume7d: 8750.3,
          salesCount24h: 45,
          ownerCount: 5400,
          floorPrice: 15.5
        };
      }
      throw new Error('Failed to fetch collection metadata');
    }
  }

  /**
   * Get complete collection summary
   */
  async getCollectionSummary(collectionAddress: string) {
    const [priceData, metadata] = await Promise.all([
      this.getFloorPriceWithTWAP(collectionAddress),
      this.getCollectionMetadata(collectionAddress)
    ]);

    return {
      ...metadata,
      twapPrice: priceData.twap,
      floorToTWAPRatio: parseFloat((metadata.floorPrice / priceData.twap).toFixed(2)),
      lastUpdated: priceData.timestamp,
      dataSource: 'Relay Public API'
    };
  }
}