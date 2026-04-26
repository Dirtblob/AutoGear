import { compareAvailabilityResults } from "./offerMatcher";
import type { AvailabilityProductModel, AvailabilityProvider, AvailabilityResult } from "./types";

const conditions = ["new", "open_box", "used", "refurbished"] as const;

const listingScenarios = [
  [],
  [{ multiplier: 0.76, condition: "used", confidence: 84 }],
  [
    { multiplier: 0.92, condition: "new", confidence: 93 },
    { multiplier: 1.28, condition: "new", confidence: 81 },
  ],
  [
    { multiplier: 1.18, condition: "new", confidence: 90 },
    { multiplier: 1.34, condition: "open_box", confidence: 78 },
    { multiplier: 1.42, condition: "new", confidence: 74 },
  ],
  [
    { multiplier: 0.68, condition: "refurbished", confidence: 80 },
    { multiplier: 0.86, condition: "used", confidence: 82 },
    { multiplier: 0.97, condition: "new", confidence: 91 },
  ],
] as const;

function checksum(value: string): number {
  return value.split("").reduce((total, character) => total + character.charCodeAt(0), 0);
}

function formatListingTitle(productModel: AvailabilityProductModel, condition: string, listingNumber: number): string {
  const normalizedCondition = condition.replaceAll("_", " ");
  return `${productModel.brand} ${productModel.model ?? productModel.displayName ?? productModel.id} (${normalizedCondition}) listing ${listingNumber}`;
}

export const mockAvailabilityProvider: AvailabilityProvider = {
  name: "mock",
  async search(productModel) {
    const seed = checksum(productModel.id);
    const scenario = listingScenarios[seed % listingScenarios.length];
    const checkedAt = new Date();

    if (scenario.length === 0) {
      return {
        listings: [],
        checkedAt,
        refreshSource: "live",
        isStale: false,
      };
    }

    const listings = scenario.map((listing, index) => {
      const fallbackCondition = conditions[(seed + index) % conditions.length];
      const condition = listing.condition ?? fallbackCondition;
      const estimatedPriceCents = productModel.estimatedPriceCents ?? 0;
      const priceCents = Math.max(500, Math.round(estimatedPriceCents * listing.multiplier));

      return {
        provider: "mock",
        productModelId: productModel.id,
        title: formatListingTitle(productModel, condition, index + 1),
        brand: productModel.brand,
        model: productModel.model ?? productModel.displayName ?? productModel.id,
        retailer: "Mock Marketplace",
        available: true,
        priceCents,
        totalPriceCents: priceCents,
        condition,
        url: `https://mock-marketplace.example/listings/${productModel.id}-${index + 1}`,
        confidence: listing.confidence,
        checkedAt,
      } satisfies AvailabilityResult;
    }).sort(compareAvailabilityResults);

    return {
      listings,
      checkedAt,
      refreshSource: "live",
      isStale: false,
    };
  },
};
