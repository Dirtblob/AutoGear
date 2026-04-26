import { beforeEach, describe, expect, it } from "vitest";
import {
  canCallPricesApi,
  getPricesApiUsageForCurrentMinute,
  getPricesApiUsageForCurrentMonth,
  getPricesApiUsageSnapshot,
  recordApiUsageEvent,
  reservePricesApiCall,
} from "./pricesApiQuota";

interface EventRecord {
  _id: string;
  provider: "pricesapi";
  eventType: "price_lookup";
  query: string;
  normalizedQuery: string;
  deviceCatalogId?: string;
  userId?: string;
  success: boolean;
  requestCount: number;
  createdAt: Date;
}

function quotaCollection(records: EventRecord[] = []) {
  let nextId = records.length + 1;

  return {
    insertOne: async (document: Omit<EventRecord, "_id">) => {
      const insertedId = `event-${nextId++}`;
      records.push({ _id: insertedId, ...document });
      return { insertedId };
    },
    updateOne: async (filter: { _id: string }, update: { $set: { success: boolean } }) => {
      const target = records.find((record) => record._id === filter._id);
      if (target) {
        target.success = update.$set.success;
      }
      return {};
    },
    aggregate: (pipeline: Record<string, unknown>[]) => ({
      toArray: async () => {
        const match = pipeline[0]?.$match as { provider: string; createdAt: { $gte: Date; $lt: Date } };
        const total = records
          .filter(
            (record) =>
              record.provider === match.provider &&
              record.createdAt >= match.createdAt.$gte &&
              record.createdAt < match.createdAt.$lt,
          )
          .reduce((sum, record) => sum + record.requestCount, 0);

        return total > 0 ? [{ total }] : [];
      },
    }),
  };
}

describe("pricesApiQuota", () => {
  beforeEach(() => {
    process.env.PRICES_API_LIMIT_PER_MINUTE = "10";
    process.env.PRICES_API_LIMIT_PER_MONTH = "1000";
  });

  it("records usage events", async () => {
    const records: EventRecord[] = [];
    const id = await recordApiUsageEvent(
      {
        query: "Dell S2722QC",
        normalizedQuery: "dell s2722qc",
        success: true,
        requestCount: 1,
        createdAt: new Date("2026-04-25T10:15:00Z"),
      },
      quotaCollection(records),
    );

    expect(id).toBe("event-1");
    expect(records[0]).toMatchObject({
      provider: "pricesapi",
      eventType: "price_lookup",
      query: "Dell S2722QC",
      normalizedQuery: "dell s2722qc",
      success: true,
      requestCount: 1,
    });
  });

  it("sums usage for the current minute and month", async () => {
    const now = new Date("2026-04-25T10:15:30Z");
    const records: EventRecord[] = [
      {
        _id: "a",
        provider: "pricesapi",
        eventType: "price_lookup",
        query: "A",
        normalizedQuery: "a",
        success: true,
        requestCount: 2,
        createdAt: new Date("2026-04-25T10:15:05Z"),
      },
      {
        _id: "b",
        provider: "pricesapi",
        eventType: "price_lookup",
        query: "B",
        normalizedQuery: "b",
        success: false,
        requestCount: 3,
        createdAt: new Date("2026-04-25T10:14:59Z"),
      },
      {
        _id: "c",
        provider: "pricesapi",
        eventType: "price_lookup",
        query: "C",
        normalizedQuery: "c",
        success: true,
        requestCount: 4,
        createdAt: new Date("2026-04-10T11:00:00Z"),
      },
    ];

    const collection = quotaCollection(records);

    await expect(getPricesApiUsageForCurrentMinute(now, collection)).resolves.toBe(2);
    await expect(getPricesApiUsageForCurrentMonth(now, collection)).resolves.toBe(9);
  });

  it("blocks calls when the minute quota is exceeded", async () => {
    const now = new Date("2026-04-25T10:15:30Z");
    const records: EventRecord[] = [
      {
        _id: "a",
        provider: "pricesapi",
        eventType: "price_lookup",
        query: "A",
        normalizedQuery: "a",
        success: true,
        requestCount: 10,
        createdAt: new Date("2026-04-25T10:15:05Z"),
      },
    ];

    await expect(canCallPricesApi("pricesapi", { now }, quotaCollection(records))).resolves.toBe(false);
  });

  it("blocks calls when the monthly quota is exceeded", async () => {
    const now = new Date("2026-04-25T10:15:30Z");
    const records: EventRecord[] = [
      {
        _id: "a",
        provider: "pricesapi",
        eventType: "price_lookup",
        query: "A",
        normalizedQuery: "a",
        success: true,
        requestCount: 1000,
        createdAt: new Date("2026-04-10T10:15:05Z"),
      },
    ];

    await expect(canCallPricesApi("pricesapi", { now }, quotaCollection(records))).resolves.toBe(false);
  });

  it("reserves usage immediately so the next quota check sees the spend", async () => {
    const now = new Date("2026-04-25T10:15:30Z");
    const records: EventRecord[] = [];
    const collection = quotaCollection(records);

    await expect(
      reservePricesApiCall(
        "pricesapi",
        {
          now,
          query: "Dell S2722QC",
          normalizedQuery: "dell s2722qc",
          requestCount: 1,
        },
        collection,
      ),
    ).resolves.toBe("event-1");

    await expect(getPricesApiUsageForCurrentMinute(now, collection)).resolves.toBe(1);
  });

  it("builds a snapshot with remaining minute and monthly quota", async () => {
    const now = new Date("2026-04-25T10:15:30Z");
    const records: EventRecord[] = [
      {
        _id: "a",
        provider: "pricesapi",
        eventType: "price_lookup",
        query: "A",
        normalizedQuery: "a",
        success: true,
        requestCount: 2,
        createdAt: new Date("2026-04-25T10:15:05Z"),
      },
      {
        _id: "b",
        provider: "pricesapi",
        eventType: "price_lookup",
        query: "B",
        normalizedQuery: "b",
        success: true,
        requestCount: 7,
        createdAt: new Date("2026-04-01T10:15:05Z"),
      },
    ];

    await expect(getPricesApiUsageSnapshot("pricesapi", now, quotaCollection(records))).resolves.toMatchObject({
      minuteCallsUsed: 2,
      monthlyCallsUsed: 9,
      minuteRemaining: 8,
      monthlyRemaining: 991,
      policy: {
        limitPerMinute: 10,
        limitPerMonth: 1000,
      },
    });
  });
});
