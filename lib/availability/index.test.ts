import { beforeEach, describe, expect, it, vi } from "vitest";

const { findManyMock, createManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  createManyMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    availabilitySnapshot: {
      findMany: findManyMock,
      createMany: createManyMock,
    },
  },
}));

vi.mock("@/lib/quota/pricesApiQuota", () => ({
  recordPricesApiUsage: vi.fn(),
  reservePricesApiCall: vi.fn().mockResolvedValue(true),
}));

describe("getAvailabilitySummaries", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    createManyMock.mockReset();
  });

  it("falls back to cached prices when quota is exhausted", async () => {
    findManyMock.mockResolvedValue([
      {
        productModelId: "monitor-dell-s2722qc",
        provider: "pricesapi",
        title: "Dell S2722QC 27-inch 4K USB-C Monitor",
        brand: "Dell",
        model: "S2722QC",
        retailer: "Display Depot",
        available: true,
        priceCents: 29999,
        shippingCents: 1500,
        totalPriceCents: 31499,
        condition: "new",
        url: "https://example.com/dell-s2722qc",
        imageUrl: "https://example.com/dell-s2722qc.jpg",
        confidence: 95,
        checkedAt: new Date("2026-04-24T12:00:00Z"),
      },
    ]);

    const [{ getAvailabilitySummaries }, { PricesApiQuotaLimitedError }] = await Promise.all([
      import("./index"),
      import("./pricesApiProvider"),
    ]);
    const summaries = await getAvailabilitySummaries(
      [
        {
          id: "monitor-dell-s2722qc",
          brand: "Dell",
          model: "S2722QC",
          displayName: "Dell S2722QC 27-inch 4K USB-C Monitor",
          category: "monitor",
        },
      ],
      {
        provider: {
          name: "pricesapi",
          search: vi.fn().mockRejectedValue(new PricesApiQuotaLimitedError("pricesapi")),
        },
        refreshProductIds: ["monitor-dell-s2722qc"],
      },
    );

    expect(summaries["monitor-dell-s2722qc"]).toMatchObject({
      refreshSource: "cached",
      refreshSkippedReason: "free_tier_quota",
      status: "available",
    });
    expect(summaries["monitor-dell-s2722qc"]?.bestListing?.totalPriceCents).toBe(31499);
  });
});
