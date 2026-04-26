import type { PricesApiUsageSnapshot } from "./types";

export interface PricesApiDashboardMetrics {
  averageDailyBurn: number;
  calendarDaysRemaining: number;
  estimatedQuotaDaysRemaining: number | null;
  safeAverageCallsPerDay: number;
}

function getDaysInUtcMonth(now: Date): number {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
}

export function buildPricesApiDashboardMetrics(
  snapshot: PricesApiUsageSnapshot,
  now: Date = new Date(),
): PricesApiDashboardMetrics {
  const daysInMonth = getDaysInUtcMonth(now);
  const dayOfMonth = Math.max(1, now.getUTCDate());
  const calendarDaysRemaining = Math.max(0, daysInMonth - dayOfMonth);
  const averageDailyBurn = snapshot.monthlyCallsUsed / dayOfMonth;
  const estimatedQuotaDaysRemaining =
    averageDailyBurn > 0 ? Math.max(0, Math.ceil(snapshot.monthlyRemaining / averageDailyBurn)) : null;
  const safeAverageCallsPerDay =
    calendarDaysRemaining > 0
      ? Math.floor(snapshot.monthlyRemaining / calendarDaysRemaining)
      : snapshot.monthlyRemaining;

  return {
    averageDailyBurn,
    calendarDaysRemaining,
    estimatedQuotaDaysRemaining,
    safeAverageCallsPerDay,
  };
}
