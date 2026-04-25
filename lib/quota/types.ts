export type ApiUsagePeriodType = "minute" | "day" | "month";

export interface ApiUsageCounter {
  provider: string;
  periodType: ApiUsagePeriodType;
  periodKey: string;
  callCount: number;
}

export interface PricesApiUsagePolicy {
  provider: string;
  monthlyHardLimit: number;
  dailySoftLimit: number;
  minuteHardLimit: number;
  reserveMonthlyCalls: number;
}

export interface PricesApiUsageSnapshot {
  policy: PricesApiUsagePolicy;
  minuteCallsUsed: number;
  dailyCallsUsed: number;
  monthlyCallsUsed: number;
  minuteRemaining: number;
  dailyRemaining: number;
  monthlyRemaining: number;
  reserveRemaining: number;
}

export interface CanUsePricesApiOptions {
  now?: Date;
  manualRefresh?: boolean;
}
