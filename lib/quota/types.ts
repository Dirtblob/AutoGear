export type ApiUsagePeriodType = "minute" | "day" | "month";

export interface PricesApiUsagePolicy {
  provider: "pricesapi";
  limitPerMinute: number;
  limitPerMonth: number;
}

export interface PricesApiUsageSnapshot {
  policy: PricesApiUsagePolicy;
  minuteCallsUsed: number;
  monthlyCallsUsed: number;
  minuteRemaining: number;
  monthlyRemaining: number;
}

export interface CanUsePricesApiOptions {
  now?: Date;
  requestCount?: number;
}

export interface ApiUsageEventInput {
  provider?: "pricesapi";
  eventType?: "price_lookup";
  query: string;
  normalizedQuery: string;
  deviceCatalogId?: string;
  userId?: string;
  success: boolean;
  requestCount?: number;
  createdAt?: Date;
}
