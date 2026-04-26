import { afterEach, describe, expect, it, vi } from "vitest";
import { getAvailabilitySummaries } from "./index";
import { createPricesApiProvider } from "./pricesApiProvider";
import type { AvailabilityProductModel } from "./types";

const { reservePricesApiCallMock, finalizeApiUsageEventMock, findPriceSnapshotMock, writePriceSnapshotMock } = vi.hoisted(() => ({
  reservePricesApiCallMock: vi.fn(),
  finalizeApiUsageEventMock: vi.fn(),
  findPriceSnapshotMock: vi.fn(),
  writePriceSnapshotMock: vi.fn(),
}));

vi.mock("@/lib/quota/pricesApiQuota", () => ({
  reservePricesApiCall: reservePricesApiCallMock,
  finalizeApiUsageEvent: finalizeApiUsageEventMock,
}));

vi.mock("./priceSnapshots", () => ({
  findPriceSnapshot: findPriceSnapshotMock,
  normalizePriceSnapshotQuery: (query: string) => query.trim().toLowerCase().replace(/\s+/g, " "),
  priceSnapshotToSearchResponse: (
    productModel: AvailabilityProductModel,
    snapshot: {
      provider: string;
      offers?: Array<{
        title: string;
        brand: string;
        model: string;
        retailer: string;
        available: boolean;
        priceCents: number;
        shippingCents?: number | null;
        totalPriceCents: number;
        condition: string;
        url: string;
        imageUrl?: string;
        confidence: number;
      }>;
      fetchedAt: Date;
      expiresAt: Date;
    },
    options: {
      refreshSource: "live" | "cached" | "not_configured";
      refreshSkippedReason?: "free_tier_quota" | "refresh_window" | "cache_only";
    },
  ) => ({
    listings: (snapshot.offers ?? []).map((offer) => ({
      provider: snapshot.provider,
      productModelId: productModel.id,
      title: offer.title,
      brand: offer.brand,
      model: offer.model,
      retailer: offer.retailer,
      available: offer.available,
      priceCents: offer.priceCents,
      shippingCents: offer.shippingCents ?? undefined,
      totalPriceCents: offer.totalPriceCents,
      condition: offer.condition,
      url: offer.url,
      imageUrl: offer.imageUrl,
      confidence: offer.confidence,
      checkedAt: snapshot.fetchedAt,
    })),
    checkedAt: snapshot.fetchedAt,
    refreshSource: options.refreshSource,
    refreshSkippedReason: options.refreshSkippedReason,
    isStale: snapshot.expiresAt.getTime() <= Date.now(),
  }),
  writePriceSnapshot: writePriceSnapshotMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    availabilitySnapshot: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue(undefined),
    },
    priceRefreshPolicy: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    apiUsage: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

const originalEnv = {
  AVAILABILITY_PROVIDER: process.env.AVAILABILITY_PROVIDER,
  PRICES_API_BASE_URL: process.env.PRICES_API_BASE_URL,
  PRICES_API_KEY: process.env.PRICES_API_KEY,
  PRICES_API_COUNTRY: process.env.PRICES_API_COUNTRY,
  PRICES_API_PROVIDER_NAME: process.env.PRICES_API_PROVIDER_NAME,
  PRICE_API_BASE_URL: process.env.PRICE_API_BASE_URL,
  PRICE_API_KEY: process.env.PRICE_API_KEY,
  PRICE_API_COUNTRY: process.env.PRICE_API_COUNTRY,
};

function restoreEnv(name: keyof typeof originalEnv): void {
  const value = originalEnv[name];

  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function restoreAllEnv(): void {
  (Object.keys(originalEnv) as Array<keyof typeof originalEnv>).forEach(restoreEnv);
}

function productModel(overrides: Partial<AvailabilityProductModel> = {}): AvailabilityProductModel {
  return {
    id: "monitor-dell-s2722qc",
    brand: "Dell",
    model: "S2722QC",
    displayName: "Dell S2722QC 27-inch 4K USB-C Monitor",
    category: "monitor",
    estimatedPriceCents: 29900,
    allowUsed: true,
    searchQueries: ["Dell S2722QC price"],
    ...overrides,
  };
}

function mockPricesApiFetch() {
  return vi.fn(async (input: URL | RequestInfo) => {
    const url = input instanceof URL ? input : new URL(String(input));

    if (url.pathname === "/api/v1/products/search") {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            query: url.searchParams.get("q"),
            results: [
              {
                id: "wrong-monitor",
                title: "Dell S2721QS 27-inch 4K Monitor",
                image: "https://example.com/wrong.jpg",
                offerCount: 8,
              },
              {
                id: "12345",
                title: "Dell S2722QC 27-inch 4K USB-C Monitor",
                image: "https://example.com/dell.jpg",
                offerCount: 2,
              },
            ],
            total: 2,
          },
        }),
      } as Response;
    }

    if (url.pathname === "/api/v1/products/12345/offers") {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: "12345",
            title: "Dell S2722QC 27-inch 4K USB-C Monitor",
            image: "https://example.com/dell.jpg",
            offerCount: 3,
            offers: [
              {
                seller: "Parts Bin",
                price: 49,
                stock: "In stock",
                delivery_info: "$9.99 delivery",
                productTitle: "Dell S2722QC replacement parts only",
                url: "https://example.com/parts",
              },
              {
                seller: "Best Buy",
                seller_url: "https://www.bestbuy.com",
                price: 299.99,
                currency: "USD",
                rating: 4.8,
                reviewCount: 1892,
                stock: "In stock",
                delivery_info: "Free delivery by Fri",
                productTitle: "Dell S2722QC 27-inch 4K USB-C Monitor",
                url: "https://example.com/dell-s2722qc",
              },
              {
                seller: "Warehouse",
                price: 289.99,
                stock: "Out of stock",
                productTitle: "Dell S2722QC 27-inch 4K USB-C Monitor Open Box",
                url: "https://example.com/open-box",
              },
            ],
          },
        }),
      } as Response;
    }

    return {
      ok: false,
      json: async () => ({}),
    } as Response;
  });
}

afterEach(() => {
  restoreAllEnv();
  reservePricesApiCallMock.mockReset();
  finalizeApiUsageEventMock.mockReset();
  findPriceSnapshotMock.mockReset();
  writePriceSnapshotMock.mockReset();
});

describe("pricesApiProvider", () => {
  it("is disabled when PRICES_API_KEY is missing", async () => {
    process.env.AVAILABILITY_PROVIDER = "pricesapi";
    process.env.PRICES_API_BASE_URL = "https://api.pricesapi.io";
    delete process.env.PRICES_API_KEY;
    delete process.env.PRICE_API_KEY;

    const summaries = await getAvailabilitySummaries([productModel({ id: "fallback-monitor" })], { persistSnapshots: false });

    expect(summaries["fallback-monitor"]?.provider).toBe("mock");
  });

  it("normalizes the PricesAPI search and offers endpoints into availability listings", async () => {
    reservePricesApiCallMock.mockResolvedValueOnce("event-search").mockResolvedValueOnce("event-offers");
    findPriceSnapshotMock.mockResolvedValue(null);
    const fetchMock = mockPricesApiFetch();
    const provider = createPricesApiProvider({
      apiKey: "test-key",
      baseUrl: "https://api.pricesapi.io",
      fetchImpl: fetchMock as typeof fetch,
    });

    const response = await provider?.search(productModel());
    const listings = response?.listings ?? [];

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        href: "https://api.pricesapi.io/api/v1/products/search?q=Dell+S2722QC&limit=10",
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ "x-api-key": "test-key" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        href: "https://api.pricesapi.io/api/v1/products/12345/offers?country=us",
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ "x-api-key": "test-key" }),
      }),
    );
    expect(response?.refreshSource).toBe("live");
    expect(listings).toHaveLength(2);
    expect(listings?.[0]).toMatchObject({
      provider: "pricesapi",
      productModelId: "monitor-dell-s2722qc",
      title: "Dell S2722QC 27-inch 4K USB-C Monitor",
      retailer: "Best Buy",
      available: true,
      priceCents: 29999,
      shippingCents: 0,
      totalPriceCents: 29999,
      condition: "unknown",
      url: "https://example.com/dell-s2722qc",
      imageUrl: "https://example.com/dell.jpg",
    });
    expect(listings?.[0]?.confidence).toBeGreaterThanOrEqual(60);
    expect(listings?.some((listing) => listing.url === "https://example.com/parts")).toBe(false);
    expect(listings?.[1]).toMatchObject({
      retailer: "Warehouse",
      available: false,
      totalPriceCents: 28999,
      condition: "open_box",
    });
    expect(writePriceSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedQuery: "dell s2722qc",
      }),
    );
    expect(finalizeApiUsageEventMock).toHaveBeenCalledWith("event-search", true);
    expect(finalizeApiUsageEventMock).toHaveBeenCalledWith("event-offers", true);
  });

  it("uses old PRICE_API_* env vars as a temporary fallback", async () => {
    reservePricesApiCallMock.mockResolvedValueOnce("event-search").mockResolvedValueOnce("event-offers");
    findPriceSnapshotMock.mockResolvedValue(null);
    process.env.PRICE_API_BASE_URL = "https://legacy.example.test";
    process.env.PRICE_API_KEY = "legacy-key";
    process.env.PRICE_API_COUNTRY = "ca";
    delete process.env.PRICES_API_BASE_URL;
    delete process.env.PRICES_API_KEY;
    delete process.env.PRICES_API_COUNTRY;

    const fetchMock = mockPricesApiFetch();
    const provider = createPricesApiProvider({ fetchImpl: fetchMock as typeof fetch });

    await provider?.search(productModel());

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        href: "https://legacy.example.test/api/v1/products/search?q=Dell+S2722QC&limit=10",
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ "x-api-key": "legacy-key" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        href: "https://legacy.example.test/api/v1/products/12345/offers?country=ca",
      }),
      expect.any(Object),
    );
  });

  it("returns a fresh cached snapshot without calling PricesAPI", async () => {
    reservePricesApiCallMock.mockResolvedValue("event");
    findPriceSnapshotMock.mockResolvedValue({
      provider: "pricesapi",
      offers: [
        {
          title: "Dell S2722QC 27-inch 4K USB-C Monitor",
          brand: "Dell",
          model: "S2722QC",
          retailer: "Cached Store",
          available: true,
          priceCents: 28499,
          shippingCents: 0,
          totalPriceCents: 28499,
          condition: "unknown",
          url: "https://example.com/cached",
          imageUrl: "https://example.com/cached.jpg",
          confidence: 91,
        },
      ],
      fetchedAt: new Date("2026-04-25T12:00:00Z"),
      expiresAt: new Date("2099-04-25T13:00:00Z"),
    });
    const fetchMock = mockPricesApiFetch();
    const provider = createPricesApiProvider({
      apiKey: "test-key",
      baseUrl: "https://api.pricesapi.io",
      fetchImpl: fetchMock as typeof fetch,
    });

    const response = await provider?.search(productModel());

    expect(response?.refreshSource).toBe("cached");
    expect(response?.isStale).toBe(false);
    expect(response?.listings[0]?.retailer).toBe("Cached Store");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(reservePricesApiCallMock).not.toHaveBeenCalled();
  });

  it("returns a stale cached snapshot unless refresh is forced", async () => {
    reservePricesApiCallMock.mockResolvedValue("event");
    findPriceSnapshotMock.mockResolvedValue({
      provider: "pricesapi",
      offers: [
        {
          title: "Dell S2722QC 27-inch 4K USB-C Monitor",
          brand: "Dell",
          model: "S2722QC",
          retailer: "Stale Store",
          available: true,
          priceCents: 28999,
          shippingCents: 0,
          totalPriceCents: 28999,
          condition: "unknown",
          url: "https://example.com/stale",
          imageUrl: "https://example.com/stale.jpg",
          confidence: 89,
        },
      ],
      fetchedAt: new Date("2026-04-24T12:00:00Z"),
      expiresAt: new Date("2026-04-24T13:00:00Z"),
    });
    const fetchMock = mockPricesApiFetch();
    const provider = createPricesApiProvider({
      apiKey: "test-key",
      baseUrl: "https://api.pricesapi.io",
      fetchImpl: fetchMock as typeof fetch,
    });

    const response = await provider?.search(productModel());

    expect(response?.refreshSource).toBe("cached");
    expect(response?.refreshSkippedReason).toBe("cache_only");
    expect(response?.isStale).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
