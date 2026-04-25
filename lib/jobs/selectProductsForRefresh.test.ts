import { describe, expect, it } from "vitest";
import { selectProductsForRefresh } from "./selectProductsForRefresh";

function refreshDb(overrides: {
  savedProducts?: Array<{ productModelId: string; targetPriceCents: number | null; createdAt: Date }>;
  recommendations?: Array<{ productModelId: string | null; score: number; createdAt: Date }>;
  recentlyViewedProducts?: Array<{ productModelId: string; viewedAt: Date }>;
  availabilitySnapshots?: Array<{ productModelId: string; provider: string; checkedAt: Date }>;
} = {}) {
  return {
    savedProduct: {
      findMany: async () => overrides.savedProducts ?? [],
    },
    recommendation: {
      findMany: async () => overrides.recommendations ?? [],
    },
    recentlyViewedProduct: {
      findMany: async () => overrides.recentlyViewedProducts ?? [],
      upsert: async () => undefined,
    },
    availabilitySnapshot: {
      findMany: async () => overrides.availabilitySnapshots ?? [],
    },
  };
}

describe("selectProductsForRefresh", () => {
  it("prefers watchlisted products over normal recommendations", async () => {
    const currentDate = new Date("2026-04-25T12:00:00Z");

    const productIds = await selectProductsForRefresh(
      {
        currentDate,
        remainingQuota: { dailyRemaining: 5, monthlyRemaining: 5 },
      },
      refreshDb({
        savedProducts: [{ productModelId: "watch-1", targetPriceCents: 9900, createdAt: currentDate }],
        recommendations: [
          { productModelId: "rec-1", score: 90, createdAt: currentDate },
          { productModelId: "rec-2", score: 85, createdAt: currentDate },
        ],
      }),
    );

    expect(productIds[0]).toBe("watch-1");
  });

  it("skips products checked within their refresh window", async () => {
    const currentDate = new Date("2026-04-25T12:00:00Z");

    const productIds = await selectProductsForRefresh(
      {
        currentDate,
        remainingQuota: { dailyRemaining: 5, monthlyRemaining: 5 },
      },
      refreshDb({
        savedProducts: [{ productModelId: "watch-1", targetPriceCents: 9900, createdAt: currentDate }],
        recommendations: [{ productModelId: "rec-1", score: 90, createdAt: currentDate }],
        availabilitySnapshots: [
          {
            productModelId: "watch-1",
            provider: "pricesapi",
            checkedAt: new Date("2026-04-25T03:30:00Z"),
          },
          {
            productModelId: "rec-1",
            provider: "pricesapi",
            checkedAt: new Date("2026-04-24T10:00:00Z"),
          },
        ],
      }),
    );

    expect(productIds).toEqual(["rec-1"]);
  });

  it("never selects more products than remaining quota", async () => {
    const currentDate = new Date("2026-04-25T12:00:00Z");

    const productIds = await selectProductsForRefresh(
      {
        currentDate,
        remainingQuota: { dailyRemaining: 2, monthlyRemaining: 4 },
      },
      refreshDb({
        savedProducts: [
          { productModelId: "watch-1", targetPriceCents: 9900, createdAt: currentDate },
          { productModelId: "watch-2", targetPriceCents: 10900, createdAt: currentDate },
          { productModelId: "watch-3", targetPriceCents: 12900, createdAt: currentDate },
        ],
      }),
    );

    expect(productIds).toHaveLength(2);
  });
});
