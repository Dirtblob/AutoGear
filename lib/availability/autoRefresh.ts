import "server-only";

import { getPricesApiUsageSnapshot } from "@/lib/quota/pricesApiQuota";
import type { RecommendationBestOffer, RecommendationPriceSnapshot } from "@/lib/recommendation/types";
import { getAvailabilitySummaries } from "./index";
import { isFreshAvailabilitySummary } from "./cachePolicy";
import { getPricesApiProvider, getPricesApiProviderName, isPricesApiConfigured } from "./pricesApiProvider";
import type { AvailabilityProductModel, AvailabilityResult, AvailabilitySummary } from "./types";

const AUTO_REFRESH_TOP_RECOMMENDATION_PRICE_ENV = "AUTO_REFRESH_TOP_RECOMMENDATION_PRICE";
const ESTIMATED_PRICE_REFRESH_CALLS = 2;
const MONTHLY_QUOTA_RESERVE_RATIO = 0.2;

type AvailabilityLookup = Map<string, AvailabilitySummary> | Record<string, AvailabilitySummary | undefined>;

export interface AutoRefreshTopRecommendationPriceInput {
  productModel: AvailabilityProductModel | undefined;
  availabilityByProductId: AvailabilityLookup;
  userId?: string;
  currentDate?: Date;
}

export interface AutoRefreshTopRecommendationPriceResult {
  productModelId: string;
  availabilitySummary: AvailabilitySummary;
  priceSnapshot?: RecommendationPriceSnapshot;
}

function booleanEnvValue(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

function summaryForProduct(
  availabilityByProductId: AvailabilityLookup,
  productModelId: string,
): AvailabilitySummary | undefined {
  if (availabilityByProductId instanceof Map) {
    return availabilityByProductId.get(productModelId);
  }

  return availabilityByProductId[productModelId];
}

export function isAutoRefreshTopRecommendationPriceEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return booleanEnvValue(env[AUTO_REFRESH_TOP_RECOMMENDATION_PRICE_ENV]);
}

function recommendationBestOffer(listing: AvailabilityResult): RecommendationBestOffer {
  return {
    title: listing.title,
    brand: listing.brand,
    model: listing.model,
    retailer: listing.retailer,
    available: listing.available,
    priceCents: listing.priceCents,
    shippingCents: listing.shippingCents ?? null,
    totalPriceCents: listing.totalPriceCents,
    condition: listing.condition,
    url: listing.url,
    imageUrl: listing.imageUrl,
    confidence: listing.confidence,
  };
}

function estimateMarketPriceCents(summary: AvailabilitySummary): number | null {
  const listings = summary.listings.length > 0 ? summary.listings : summary.bestListing ? [summary.bestListing] : [];
  const availablePrices = listings
    .filter((listing) => listing.available)
    .map((listing) => listing.totalPriceCents);
  const prices = (availablePrices.length > 0 ? availablePrices : listings.map((listing) => listing.totalPriceCents))
    .filter((price) => Number.isFinite(price))
    .sort((left, right) => left - right);

  if (prices.length === 0) {
    return null;
  }

  const middle = Math.floor(prices.length / 2);
  if (prices.length % 2 === 1) {
    return prices[middle] ?? null;
  }

  const left = prices[middle - 1];
  const right = prices[middle];
  return left === undefined || right === undefined ? prices[0] ?? null : Math.round((left + right) / 2);
}

function priceSnapshotFromSummary(summary: AvailabilitySummary): RecommendationPriceSnapshot | undefined {
  if (!summary.checkedAt) {
    return undefined;
  }

  const bestOffer = summary.bestListing ? recommendationBestOffer(summary.bestListing) : null;
  const estimatedMarketPriceCents = estimateMarketPriceCents(summary);
  if (!bestOffer && estimatedMarketPriceCents === null) {
    return undefined;
  }

  return {
    bestOffer,
    estimatedMarketPriceCents,
    priceStatus: summary.isStale ? "stale" : "cached",
    fetchedAt: summary.checkedAt,
  };
}

export async function maybeAutoRefreshTopRecommendationPrice(
  input: AutoRefreshTopRecommendationPriceInput,
): Promise<AutoRefreshTopRecommendationPriceResult | null> {
  const productModel = input.productModel;
  if (!productModel || !isAutoRefreshTopRecommendationPriceEnabled() || !isPricesApiConfigured()) {
    return null;
  }

  const currentDate = input.currentDate ?? new Date();
  const cachedSummary = summaryForProduct(input.availabilityByProductId, productModel.id);
  if (isFreshAvailabilitySummary(cachedSummary, currentDate)) {
    return null;
  }

  const providerName = getPricesApiProviderName();
  const quotaSnapshot = await getPricesApiUsageSnapshot(providerName, currentDate);
  const monthlyReserve = quotaSnapshot.policy.limitPerMonth * MONTHLY_QUOTA_RESERVE_RATIO;
  const monthlyRemainingAfterRefresh = quotaSnapshot.monthlyRemaining - ESTIMATED_PRICE_REFRESH_CALLS;

  if (
    monthlyRemainingAfterRefresh <= monthlyReserve ||
    quotaSnapshot.minuteRemaining < ESTIMATED_PRICE_REFRESH_CALLS
  ) {
    return null;
  }

  const provider = getPricesApiProvider({
    manualRefresh: true,
    userId: input.userId,
  });

  if (!provider) {
    return null;
  }

  try {
    const summaries = await getAvailabilitySummaries([productModel], {
      provider,
      persistSnapshots: true,
      manualRefresh: true,
      refreshProductIds: [productModel.id],
    });

    const availabilitySummary = summaries[productModel.id];
    if (!availabilitySummary) {
      return null;
    }

    const priceSnapshot = priceSnapshotFromSummary(availabilitySummary);
    if (!priceSnapshot && availabilitySummary.refreshSource === "live") {
      return null;
    }

    return {
      productModelId: productModel.id,
      availabilitySummary,
      priceSnapshot,
    };
  } catch (error) {
    console.warn(`Auto price refresh failed for ${productModel.id}. Using cached/catalog price.`, error);
    return null;
  }
}
