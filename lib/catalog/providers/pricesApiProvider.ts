import type { CatalogOffer, CatalogProvider, CatalogProviderResult, CatalogSearchQuery } from "../catalogTypes";
import { normalizePriceCents } from "../specNormalizer";

export interface PricesApiListing {
  id: string;
  title: string;
  brand?: string;
  model?: string;
  url?: string;
  price?: number | string;
  condition?: CatalogOffer["condition"];
}

export interface PricesApiClient {
  search(query: CatalogSearchQuery): Promise<PricesApiListing[]>;
}

export function createPricesApiProvider(client: PricesApiClient): CatalogProvider {
  return {
    name: "pricesapi",
    source: "prices_api",
    async search(query): Promise<CatalogProviderResult[]> {
      const listings = await client.search(query);
      return listings.map((listing) => ({
        sourceId: listing.id,
        category: query.category ?? "storage",
        brand: listing.brand ?? "Unknown",
        model: listing.model,
        displayName: listing.title,
        estimatedPriceCents: normalizePriceCents(listing.price),
        offers: [
          {
            source: "prices_api",
            provider: "pricesapi",
            title: listing.title,
            url: listing.url,
            priceCents: normalizePriceCents(listing.price),
            condition: listing.condition ?? "unknown",
            confidence: 0.72,
            checkedAt: new Date(),
          },
        ],
      }));
    },
  };
}

export const pricesApiProvider: CatalogProvider = {
  name: "pricesapi-unconfigured",
  source: "prices_api",
  async search() {
    return [];
  },
};
