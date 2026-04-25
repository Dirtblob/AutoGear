import { describe, expect, it } from "vitest";
import { buildPeriodKey, canUsePricesApi, reservePricesApiCall } from "./pricesApiQuota";
import type { ApiUsagePeriodType } from "./types";

interface UsageRecord {
  provider: string;
  periodType: ApiUsagePeriodType;
  periodKey: string;
  callCount: number;
}

function quotaDb(records: UsageRecord[] = []) {
  return {
    priceRefreshPolicy: {
      findUnique: async () => null,
    },
    apiUsage: {
      findUnique: async ({
        where,
      }: {
        where: {
          provider_periodType_periodKey: {
            provider: string;
            periodType: ApiUsagePeriodType;
            periodKey: string;
          };
        };
      }) =>
        records.find(
          (record) =>
            record.provider === where.provider_periodType_periodKey.provider &&
            record.periodType === where.provider_periodType_periodKey.periodType &&
            record.periodKey === where.provider_periodType_periodKey.periodKey,
        ) ?? null,
      upsert: async ({
        where,
        update,
        create,
      }: {
        where: {
          provider_periodType_periodKey: {
            provider: string;
            periodType: ApiUsagePeriodType;
            periodKey: string;
          };
        };
        create: UsageRecord;
        update: {
          callCount: {
            increment: number;
          };
        };
      }) => {
        const existing = records.find(
          (record) =>
            record.provider === where.provider_periodType_periodKey.provider &&
            record.periodType === where.provider_periodType_periodKey.periodType &&
            record.periodKey === where.provider_periodType_periodKey.periodKey,
        );

        if (existing) {
          existing.callCount += update.callCount.increment;
        } else {
          records.push({ ...create });
        }
      },
    },
  };
}

describe("canUsePricesApi", () => {
  it("blocks calls after monthly usage reaches 950", async () => {
    const now = new Date("2026-04-25T10:15:00Z");

    const allowed = await canUsePricesApi(
      "pricesapi",
      { now },
      quotaDb([
        {
          provider: "pricesapi",
          periodType: "month",
          periodKey: buildPeriodKey("month", now),
          callCount: 950,
        },
      ]),
    );

    expect(allowed).toBe(false);
  });

  it("blocks calls after 8 calls in the same minute", async () => {
    const now = new Date("2026-04-25T10:15:00Z");

    const allowed = await canUsePricesApi(
      "pricesapi",
      { now },
      quotaDb([
        {
          provider: "pricesapi",
          periodType: "minute",
          periodKey: buildPeriodKey("minute", now),
          callCount: 8,
        },
      ]),
    );

    expect(allowed).toBe(false);
  });

  it("reserves calls before use so the next quota check sees the spend", async () => {
    const now = new Date("2026-04-25T10:15:00Z");
    const records: UsageRecord[] = [];
    const db = quotaDb(records);

    await expect(reservePricesApiCall("pricesapi", { now }, db)).resolves.toBe(true);

    expect(
      records.find((record) => record.periodType === "minute" && record.periodKey === buildPeriodKey("minute", now))
        ?.callCount,
    ).toBe(1);
  });

  it("uses the 30 call daily soft cap for automatic refreshes", async () => {
    const now = new Date("2026-04-25T10:15:00Z");

    await expect(
      canUsePricesApi(
        "pricesapi",
        { now },
        quotaDb([
          {
            provider: "pricesapi",
            periodType: "day",
            periodKey: buildPeriodKey("day", now),
            callCount: 30,
          },
        ]),
      ),
    ).resolves.toBe(false);
  });
});
