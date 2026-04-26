import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AvailabilityProductModel, AvailabilitySummary } from "./types";

const {
  getAvailabilitySummariesMock,
  getPricesApiProviderMock,
  getPricesApiProviderNameMock,
  getPricesApiUsageSnapshotMock,
  isPricesApiConfiguredMock,
} = vi.hoisted(() => ({
  getAvailabilitySummariesMock: vi.fn(),
  getPricesApiProviderMock: vi.fn(),
  getPricesApiProviderNameMock: vi.fn(),
  getPricesApiUsageSnapshotMock: vi.fn(),
  isPricesApiConfiguredMock: vi.fn(),
}));

vi.mock("./index", () => ({
  getAvailabilitySummaries: getAvailabilitySummariesMock,
}));

vi.mock("./pricesApiProvider", () => ({
  getPricesApiProvider: getPricesApiProviderMock,
  getPricesApiProviderName: getPricesApiProviderNameMock,
  isPricesApiConfigured: isPricesApiConfiguredMock,
}));

vi.mock("@/lib/quota/pricesApiQuota", () => ({
  getPricesApiUsageSnapshot: getPricesApiUsageSnapshotMock,
}));

const originalAutoRefreshEnv = process.env.AUTO_REFRESH_TOP_RECOMMENDATION_PRICE;

function productModel(overrides: Partial<AvailabilityProductModel> = {}): AvailabilityProductModel {
  return {
    id: "monitor-dell-s2722qc",
    brand: "Dell",
    model: "S2722QC",
    displayName: "Dell S2722QC 27-inch 4K USB-C Monitor",
    category: "monitor",
    estimatedPriceCents: 29900,
    ...overrides,
  };
}

function availabilitySummary(overrides: Partial<AvailabilitySummary> = {}): AvailabilitySummary {
  const checkedAt = overrides.checkedAt ?? new Date("2026-04-25T12:00:00Z");

  return {
    provider: "pricesapi",
    productModelId: "monitor-dell-s2722qc",
    status: "available",
    label: "Available",
    listings: [],
    bestListing: {
      provider: "pricesapi",
      productModelId: "monitor-dell-s2722qc",
      title: "Dell S2722QC 27-inch 4K USB-C Monitor",
      brand: "Dell",
      model: "S2722QC",
      retailer: "Best Buy",
      available: true,
      priceCents: 29999,
      shippingCents: 0,
      totalPriceCents: 29999,
      condition: "unknown",
      url: "https://example.com/dell",
      confidence: 92,
      checkedAt,
    },
    checkedAt,
    refreshSource: "cached",
    isStale: false,
    ...overrides,
  };
}

function quotaSnapshot(overrides: { monthlyRemaining?: number; minuteRemaining?: number; limitPerMonth?: number } = {}) {
  const limitPerMonth = overrides.limitPerMonth ?? 1000;
  const monthlyRemaining = overrides.monthlyRemaining ?? 300;
  const minuteRemaining = overrides.minuteRemaining ?? 4;

  return {
    policy: {
      provider: "pricesapi" as const,
      limitPerMinute: 10,
      limitPerMonth,
    },
    minuteCallsUsed: 10 - minuteRemaining,
    monthlyCallsUsed: limitPerMonth - monthlyRemaining,
    minuteRemaining,
    monthlyRemaining,
  };
}

beforeEach(() => {
  process.env.AUTO_REFRESH_TOP_RECOMMENDATION_PRICE = "true";
  getAvailabilitySummariesMock.mockReset();
  getPricesApiProviderMock.mockReset();
  getPricesApiProviderNameMock.mockReset().mockReturnValue("pricesapi");
  getPricesApiUsageSnapshotMock.mockReset().mockResolvedValue(quotaSnapshot());
  isPricesApiConfiguredMock.mockReset().mockReturnValue(true);
});

afterEach(() => {
  if (originalAutoRefreshEnv === undefined) {
    delete process.env.AUTO_REFRESH_TOP_RECOMMENDATION_PRICE;
  } else {
    process.env.AUTO_REFRESH_TOP_RECOMMENDATION_PRICE = originalAutoRefreshEnv;
  }
  vi.restoreAllMocks();
});

describe("maybeAutoRefreshTopRecommendationPrice", () => {
  it("does not call PricesAPI when auto refresh is disabled", async () => {
    delete process.env.AUTO_REFRESH_TOP_RECOMMENDATION_PRICE;
    const { maybeAutoRefreshTopRecommendationPrice } = await import("./autoRefresh");

    const result = await maybeAutoRefreshTopRecommendationPrice({
      productModel: productModel(),
      availabilityByProductId: {},
      userId: "user-1",
    });

    expect(result).toBeNull();
    expect(getPricesApiUsageSnapshotMock).not.toHaveBeenCalled();
    expect(getAvailabilitySummariesMock).not.toHaveBeenCalled();
  });

  it("does not refresh when the top recommendation already has fresh cached pricing", async () => {
    const { maybeAutoRefreshTopRecommendationPrice } = await import("./autoRefresh");

    const result = await maybeAutoRefreshTopRecommendationPrice({
      productModel: productModel(),
      availabilityByProductId: {
        "monitor-dell-s2722qc": availabilitySummary(),
      },
      currentDate: new Date("2026-04-25T13:00:00Z"),
    });

    expect(result).toBeNull();
    expect(getPricesApiUsageSnapshotMock).not.toHaveBeenCalled();
    expect(getAvailabilitySummariesMock).not.toHaveBeenCalled();
  });

  it("skips auto refresh when monthly quota would fall to the 20% reserve", async () => {
    getPricesApiUsageSnapshotMock.mockResolvedValue(quotaSnapshot({ monthlyRemaining: 202 }));
    const { maybeAutoRefreshTopRecommendationPrice } = await import("./autoRefresh");

    const result = await maybeAutoRefreshTopRecommendationPrice({
      productModel: productModel(),
      availabilityByProductId: {},
    });

    expect(result).toBeNull();
    expect(getPricesApiProviderMock).not.toHaveBeenCalled();
    expect(getAvailabilitySummariesMock).not.toHaveBeenCalled();
  });

  it("skips auto refresh when the minute quota cannot cover one product refresh", async () => {
    getPricesApiUsageSnapshotMock.mockResolvedValue(quotaSnapshot({ minuteRemaining: 1 }));
    const { maybeAutoRefreshTopRecommendationPrice } = await import("./autoRefresh");

    const result = await maybeAutoRefreshTopRecommendationPrice({
      productModel: productModel(),
      availabilityByProductId: {},
    });

    expect(result).toBeNull();
    expect(getPricesApiProviderMock).not.toHaveBeenCalled();
    expect(getAvailabilitySummariesMock).not.toHaveBeenCalled();
  });

  it("refreshes only the top product when enabled and quota is healthy", async () => {
    const model = productModel();
    const refreshedSummary = availabilitySummary({
      refreshSource: "live",
      checkedAt: new Date("2026-04-25T14:00:00Z"),
    });
    const provider = { name: "pricesapi", search: vi.fn() };
    getPricesApiProviderMock.mockReturnValue(provider);
    getAvailabilitySummariesMock.mockResolvedValue({
      "monitor-dell-s2722qc": refreshedSummary,
    });
    const { maybeAutoRefreshTopRecommendationPrice } = await import("./autoRefresh");

    const result = await maybeAutoRefreshTopRecommendationPrice({
      productModel: model,
      availabilityByProductId: {},
      userId: "user-1",
    });

    expect(result?.availabilitySummary).toBe(refreshedSummary);
    expect(result?.productModelId).toBe("monitor-dell-s2722qc");
    expect(result?.priceSnapshot).toMatchObject({
      bestOffer: {
        totalPriceCents: 29999,
      },
      estimatedMarketPriceCents: 29999,
      priceStatus: "cached",
      fetchedAt: new Date("2026-04-25T14:00:00Z"),
    });
    expect(getAvailabilitySummariesMock).toHaveBeenCalledTimes(1);
    expect(getAvailabilitySummariesMock).toHaveBeenCalledWith([model], {
      provider,
      persistSnapshots: true,
      manualRefresh: true,
      refreshProductIds: ["monitor-dell-s2722qc"],
    });
  });

  it("keeps cached/catalog pricing when a live refresh returns no usable price", async () => {
    getPricesApiProviderMock.mockReturnValue({ name: "pricesapi", search: vi.fn() });
    getAvailabilitySummariesMock.mockResolvedValue({
      "monitor-dell-s2722qc": availabilitySummary({
        status: "unavailable",
        label: "Unavailable",
        bestListing: null,
        listings: [],
        refreshSource: "live",
      }),
    });
    const { maybeAutoRefreshTopRecommendationPrice } = await import("./autoRefresh");

    const result = await maybeAutoRefreshTopRecommendationPrice({
      productModel: productModel(),
      availabilityByProductId: {},
    });

    expect(result).toBeNull();
  });

  it("returns null when the refresh attempt fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    getPricesApiProviderMock.mockReturnValue({ name: "pricesapi", search: vi.fn() });
    getAvailabilitySummariesMock.mockRejectedValue(new Error("PricesAPI failed"));
    const { maybeAutoRefreshTopRecommendationPrice } = await import("./autoRefresh");

    const result = await maybeAutoRefreshTopRecommendationPrice({
      productModel: productModel(),
      availabilityByProductId: {},
    });

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });
});
