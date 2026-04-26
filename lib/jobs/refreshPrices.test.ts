import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAvailabilitySummariesMock,
  getCachedAvailabilitySummariesMock,
  selectProductsForRefreshMock,
  getPricesApiUsageSnapshotMock,
  rerankRecommendationsMock,
  createWatchlistAlertsMock,
  isPricesApiConfiguredMock,
  jobRunCreateMock,
} = vi.hoisted(() => ({
  getAvailabilitySummariesMock: vi.fn(),
  getCachedAvailabilitySummariesMock: vi.fn(),
  selectProductsForRefreshMock: vi.fn(),
  getPricesApiUsageSnapshotMock: vi.fn(),
  rerankRecommendationsMock: vi.fn(),
  createWatchlistAlertsMock: vi.fn(),
  isPricesApiConfiguredMock: vi.fn(),
  jobRunCreateMock: vi.fn(),
}));

vi.mock("@/lib/availability", () => ({
  getAvailabilitySummaries: getAvailabilitySummariesMock,
  getCachedAvailabilitySummaries: getCachedAvailabilitySummariesMock,
}));

vi.mock("@/lib/jobs/selectProductsForRefresh", () => ({
  selectProductsForRefresh: selectProductsForRefreshMock,
}));

vi.mock("@/lib/quota/pricesApiQuota", () => ({
  getPricesApiUsageSnapshot: getPricesApiUsageSnapshotMock,
}));

vi.mock("@/lib/jobs/rerankRecommendations", () => ({
  rerankRecommendations: rerankRecommendationsMock,
}));

vi.mock("@/lib/jobs/watchlistAlerts", () => ({
  createWatchlistAlerts: createWatchlistAlertsMock,
}));

vi.mock("@/lib/availability/pricesApiProvider", () => ({
  getPricesApiProviderName: vi.fn(() => "pricesapi"),
  isPricesApiConfigured: isPricesApiConfiguredMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    jobRun: {
      create: jobRunCreateMock,
    },
  },
}));

describe("refreshPrices", () => {
  beforeEach(() => {
    process.env.AVAILABILITY_PROVIDER = "pricesapi";
    getAvailabilitySummariesMock.mockReset();
    getCachedAvailabilitySummariesMock.mockReset();
    selectProductsForRefreshMock.mockReset();
    getPricesApiUsageSnapshotMock.mockReset();
    rerankRecommendationsMock.mockReset();
    createWatchlistAlertsMock.mockReset();
    isPricesApiConfiguredMock.mockReset();
    jobRunCreateMock.mockReset();
  });

  it("stops live refreshes when quota runs out and records the job summary", async () => {
    isPricesApiConfiguredMock.mockReturnValue(true);
    selectProductsForRefreshMock.mockResolvedValue([
      "monitor-dell-s2722qc",
      "monitor-lg-34wp65c-b",
      "monitor-asus-proart-pa278cv",
    ]);
    getCachedAvailabilitySummariesMock.mockResolvedValue({
      "monitor-dell-s2722qc": {
        provider: "pricesapi",
        productModelId: "monitor-dell-s2722qc",
        status: "available",
        label: "Available",
        listings: [],
        bestListing: null,
        checkedAt: new Date("2026-04-24T00:00:00Z"),
        refreshSource: "cached",
      },
      "monitor-lg-34wp65c-b": {
        provider: "pricesapi",
        productModelId: "monitor-lg-34wp65c-b",
        status: "available",
        label: "Available",
        listings: [],
        bestListing: null,
        checkedAt: new Date("2026-04-24T00:00:00Z"),
        refreshSource: "cached",
      },
      "monitor-asus-proart-pa278cv": {
        provider: "pricesapi",
        productModelId: "monitor-asus-proart-pa278cv",
        status: "available",
        label: "Available",
        listings: [],
        bestListing: null,
        checkedAt: new Date("2026-04-24T00:00:00Z"),
        refreshSource: "cached",
      },
    });
    getPricesApiUsageSnapshotMock
      .mockResolvedValueOnce({
        policy: { provider: "pricesapi", limitPerMinute: 10, limitPerMonth: 1000 },
        monthlyCallsUsed: 10,
        minuteCallsUsed: 2,
        monthlyRemaining: 940,
        minuteRemaining: 6,
      })
      .mockResolvedValueOnce({
        policy: { provider: "pricesapi", limitPerMinute: 10, limitPerMonth: 1000 },
        monthlyCallsUsed: 10,
        minuteCallsUsed: 2,
        monthlyRemaining: 940,
        minuteRemaining: 1,
      })
      .mockResolvedValueOnce({
        policy: { provider: "pricesapi", limitPerMinute: 10, limitPerMonth: 1000 },
        monthlyCallsUsed: 11,
        minuteCallsUsed: 10,
        monthlyRemaining: 939,
        minuteRemaining: 0,
      })
      .mockResolvedValueOnce({
        policy: { provider: "pricesapi", limitPerMinute: 10, limitPerMonth: 1000 },
        monthlyCallsUsed: 11,
        minuteCallsUsed: 10,
        monthlyRemaining: 939,
        minuteRemaining: 0,
      });
    getAvailabilitySummariesMock.mockResolvedValue({
      "monitor-dell-s2722qc": {
        provider: "pricesapi",
        productModelId: "monitor-dell-s2722qc",
        status: "available",
        label: "Available",
        listings: [],
        bestListing: null,
        checkedAt: new Date("2026-04-25T00:00:00Z"),
        refreshSource: "live",
      },
    });
    rerankRecommendationsMock.mockResolvedValue({
      profileCount: 1,
      recommendationCount: 8,
    });
    createWatchlistAlertsMock.mockResolvedValue(2);
    jobRunCreateMock.mockResolvedValue({ id: "job-1" });

    const { refreshPrices } = await import("./refreshPrices");
    const result = await refreshPrices();

    expect(getAvailabilitySummariesMock).toHaveBeenCalledTimes(1);
    expect(result.productsEligible).toBe(3);
    expect(result.productsChecked).toBe(1);
    expect(result.productsSkippedDueToQuota).toBe(2);
    expect(result.apiCallsUsed).toBe(1);
    expect(result.pricesApiCallsUsed).toBe(1);
    expect(result.remainingMonthlyCalls).toBe(939);
    expect(result.remainingDailyCalls).toBe(939);
    expect(result.remainingMinuteCalls).toBe(0);
    expect(result.alertsCreated).toBe(2);
    expect(result.summaries["monitor-lg-34wp65c-b"]?.refreshSkippedReason).toBe("free_tier_quota");
    expect(jobRunCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productsEligible: 3,
        productsChecked: 1,
        productsSkippedDueToQuota: 2,
        apiCallsUsed: 1,
        pricesApiCallsUsed: 1,
        remainingMonthlyCalls: 939,
        remainingDailyCalls: 939,
        remainingMinuteCalls: 0,
      }),
    });
    expect(rerankRecommendationsMock).toHaveBeenCalledTimes(1);
    expect(createWatchlistAlertsMock).toHaveBeenCalledTimes(1);
  });
});
