import { db } from "@/lib/db";
import type { CanUsePricesApiOptions, ApiUsagePeriodType, PricesApiUsagePolicy, PricesApiUsageSnapshot } from "./types";

const DEFAULT_MONTHLY_HARD_LIMIT = 950;
const DEFAULT_DAILY_SOFT_LIMIT = 30;
const DEFAULT_MINUTE_HARD_LIMIT = 8;
const DEFAULT_RESERVE_MONTHLY_CALLS = 50;

interface QuotaDbClient {
  priceRefreshPolicy: {
    findUnique(args: { where: { provider: string } }): Promise<{
      provider: string;
      monthlyHardLimit: number;
      dailySoftLimit: number;
      minuteHardLimit: number;
      reserveMonthlyCalls: number;
    } | null>;
  };
  apiUsage: {
    findUnique(args: {
      where: {
        provider_periodType_periodKey: {
          provider: string;
          periodType: ApiUsagePeriodType;
          periodKey: string;
        };
      };
    }): Promise<{ callCount: number } | null>;
    upsert(args: {
      where: {
        provider_periodType_periodKey: {
          provider: string;
          periodType: ApiUsagePeriodType;
          periodKey: string;
        };
      };
      update: {
        callCount: {
          increment: number;
        };
      };
      create: {
        provider: string;
        periodType: ApiUsagePeriodType;
        periodKey: string;
        callCount: number;
      };
    }): Promise<unknown>;
  };
}

export function buildPeriodKey(periodType: ApiUsagePeriodType, now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");
  const minute = String(now.getUTCMinutes()).padStart(2, "0");

  if (periodType === "month") return `${year}-${month}`;
  if (periodType === "day") return `${year}-${month}-${day}`;
  return `${year}-${month}-${day}-${hour}:${minute}`;
}

export function buildDefaultPriceRefreshPolicy(provider: string): PricesApiUsagePolicy {
  return {
    provider,
    monthlyHardLimit: DEFAULT_MONTHLY_HARD_LIMIT,
    dailySoftLimit: DEFAULT_DAILY_SOFT_LIMIT,
    minuteHardLimit: DEFAULT_MINUTE_HARD_LIMIT,
    reserveMonthlyCalls: DEFAULT_RESERVE_MONTHLY_CALLS,
  };
}

export async function getPriceRefreshPolicy(
  provider: string,
  quotaDb: QuotaDbClient = db as unknown as QuotaDbClient,
): Promise<PricesApiUsagePolicy> {
  const storedPolicy = await quotaDb.priceRefreshPolicy.findUnique({
    where: { provider },
  });

  if (!storedPolicy) {
    return buildDefaultPriceRefreshPolicy(provider);
  }

  return {
    provider: storedPolicy.provider,
    monthlyHardLimit: storedPolicy.monthlyHardLimit,
    dailySoftLimit: storedPolicy.dailySoftLimit,
    minuteHardLimit: storedPolicy.minuteHardLimit,
    reserveMonthlyCalls: storedPolicy.reserveMonthlyCalls,
  };
}

export async function getPricesApiUsageSnapshot(
  provider: string,
  now: Date = new Date(),
  quotaDb: QuotaDbClient = db as unknown as QuotaDbClient,
): Promise<PricesApiUsageSnapshot> {
  const policy = await getPriceRefreshPolicy(provider, quotaDb);
  const [minuteUsage, dailyUsage, monthlyUsage] = await Promise.all([
    quotaDb.apiUsage.findUnique({
      where: {
        provider_periodType_periodKey: {
          provider,
          periodType: "minute",
          periodKey: buildPeriodKey("minute", now),
        },
      },
    }),
    quotaDb.apiUsage.findUnique({
      where: {
        provider_periodType_periodKey: {
          provider,
          periodType: "day",
          periodKey: buildPeriodKey("day", now),
        },
      },
    }),
    quotaDb.apiUsage.findUnique({
      where: {
        provider_periodType_periodKey: {
          provider,
          periodType: "month",
          periodKey: buildPeriodKey("month", now),
        },
      },
    }),
  ]);

  const minuteCallsUsed = minuteUsage?.callCount ?? 0;
  const dailyCallsUsed = dailyUsage?.callCount ?? 0;
  const monthlyCallsUsed = monthlyUsage?.callCount ?? 0;
  const minuteRemaining = Math.max(0, policy.minuteHardLimit - minuteCallsUsed);
  const dailyRemaining = Math.max(0, policy.dailySoftLimit - dailyCallsUsed);
  const monthlyRemaining = Math.max(0, policy.monthlyHardLimit - monthlyCallsUsed);
  const reserveRemaining = Math.max(0, policy.reserveMonthlyCalls - Math.max(0, monthlyCallsUsed - policy.monthlyHardLimit));

  return {
    policy,
    minuteCallsUsed,
    dailyCallsUsed,
    monthlyCallsUsed,
    minuteRemaining,
    dailyRemaining,
    monthlyRemaining,
    reserveRemaining,
  };
}

export async function canUsePricesApi(
  provider: string,
  options: CanUsePricesApiOptions = {},
  quotaDb: QuotaDbClient = db as unknown as QuotaDbClient,
): Promise<boolean> {
  const snapshot = await getPricesApiUsageSnapshot(provider, options.now ?? new Date(), quotaDb);

  if (snapshot.monthlyRemaining <= 0) return false;
  if (snapshot.minuteRemaining <= 0) return false;
  if (!options.manualRefresh && snapshot.dailyRemaining <= 0) return false;

  return true;
}

export async function recordPricesApiUsage(
  provider: string,
  now: Date = new Date(),
  quotaDb: QuotaDbClient = db as unknown as QuotaDbClient,
): Promise<void> {
  const periods: ApiUsagePeriodType[] = ["minute", "day", "month"];

  await Promise.all(
    periods.map((periodType) =>
      quotaDb.apiUsage.upsert({
        where: {
          provider_periodType_periodKey: {
            provider,
            periodType,
            periodKey: buildPeriodKey(periodType, now),
          },
        },
        update: {
          callCount: {
            increment: 1,
          },
        },
        create: {
          provider,
          periodType,
          periodKey: buildPeriodKey(periodType, now),
          callCount: 1,
        },
      }),
    ),
  );
}

let pricesApiReservationQueue: Promise<unknown> = Promise.resolve();

function enqueuePricesApiReservation<T>(task: () => Promise<T>): Promise<T> {
  const nextTask = pricesApiReservationQueue.then(task, task);
  pricesApiReservationQueue = nextTask.catch(() => undefined);
  return nextTask;
}

export async function reservePricesApiCall(
  provider: string,
  options: CanUsePricesApiOptions = {},
  quotaDb: QuotaDbClient = db as unknown as QuotaDbClient,
): Promise<boolean> {
  return enqueuePricesApiReservation(async () => {
    const now = options.now ?? new Date();
    const allowed = await canUsePricesApi(provider, { ...options, now }, quotaDb);

    if (!allowed) {
      return false;
    }

    await recordPricesApiUsage(provider, now, quotaDb);
    return true;
  });
}
