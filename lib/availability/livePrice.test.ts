import { describe, expect, it } from "vitest";
import { buildLivePriceCardState, buildLivePriceCardStateFromResponse, buttonLabelForLivePrice } from "./livePrice";
import type { AvailabilitySummary } from "./types";

function summary(overrides: Partial<AvailabilitySummary> = {}): AvailabilitySummary {
  return {
    provider: "pricesapi",
    productModelId: "device-1",
    status: "available",
    label: "Available",
    listings: [],
    bestListing: null,
    checkedAt: null,
    refreshSource: "not_configured",
    ...overrides,
  };
}

describe("buildLivePriceCardState", () => {
  it("labels unchecked recommendations correctly", () => {
    const state = buildLivePriceCardState(summary(), 29900);
    expect(state.statusLabel).toBe("Live price not checked");
    expect(buttonLabelForLivePrice(state)).toBe("Check live deals");
  });

  it("labels cached recommendations correctly", () => {
    const state = buildLivePriceCardState(
      summary({
        checkedAt: new Date("2026-04-25T12:00:00Z"),
        refreshSource: "cached",
        bestListing: {
          provider: "pricesapi",
          productModelId: "device-1",
          title: "Offer",
          brand: "Brand",
          model: "Model",
          retailer: "Seller",
          available: true,
          priceCents: 25000,
          totalPriceCents: 25000,
          condition: "new",
          url: "https://example.com",
          confidence: 90,
          checkedAt: new Date("2026-04-25T12:00:00Z"),
        },
      }),
      29900,
    );

    expect(state.statusLabel).toBe("Cached price");
    expect(buttonLabelForLivePrice(state)).toBeNull();
  });

  it("labels stale cached recommendations correctly", () => {
    const state = buildLivePriceCardState(
      summary({
        checkedAt: new Date("2026-04-24T12:00:00Z"),
        refreshSource: "cached",
        isStale: true,
      }),
      29900,
    );

    expect(state.statusLabel).toBe("Stale cached price");
    expect(buttonLabelForLivePrice(state)).toBe("Refresh live price");
  });

  it("labels live checked recommendations correctly", () => {
    const state = buildLivePriceCardState(
      summary({
        checkedAt: new Date("2026-04-25T12:00:00Z"),
        refreshSource: "live",
      }),
      29900,
    );

    expect(state.statusLabel).toBe("Live price checked");
  });
});

describe("buildLivePriceCardStateFromResponse", () => {
  it("maps fresh live responses to live checked state", () => {
    const state = buildLivePriceCardStateFromResponse({
      status: "fresh",
      bestOffer: {
        seller: "Seller",
        title: "Offer",
        priceCents: 25000,
        totalPriceCents: 25000,
        url: "https://example.com",
      },
      offers: [],
      offerCount: 1,
      estimatedMarketPriceCents: 25500,
      fetchedAt: "2026-04-25T12:00:00.000Z",
      expiresAt: "2026-04-25T18:00:00.000Z",
      quota: {
        requestsUsedThisMinute: 2,
        requestsUsedThisMonth: 20,
        remainingMinuteRequests: 8,
        remainingMonthlyRequests: 980,
        limitPerMinute: 10,
        limitPerMonth: 1000,
      },
    }, 29900);

    expect(state.status).toBe("live_checked");
    expect(state.statusLabel).toBe("Live price checked");
    expect(state.bestOffer?.seller).toBe("Seller");
  });

  it("preserves quota messaging when quota is exhausted", () => {
    const state = buildLivePriceCardStateFromResponse({
      status: "quota_limited",
      bestOffer: null,
      offers: [],
      offerCount: 0,
      estimatedMarketPriceCents: null,
      fetchedAt: null,
      expiresAt: null,
      quota: {
        requestsUsedThisMinute: 10,
        requestsUsedThisMonth: 1000,
        remainingMinuteRequests: 0,
        remainingMonthlyRequests: 0,
        limitPerMinute: 10,
        limitPerMonth: 1000,
      },
      message: "Live price quota reached. Showing cached/catalog estimate.",
    }, 29900);

    expect(state.status).toBe("not_checked");
    expect(state.quotaReached).toBe(true);
    expect(state.message).toContain("quota reached");
    expect(state.catalogEstimateCents).toBe(29900);
  });
});
