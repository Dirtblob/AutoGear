import type { AvailabilitySummary } from "./types";

export const PRICE_CACHE_FRESHNESS_MS = 12 * 60 * 60 * 1000;

export function isFreshPriceCheck(
  checkedAt: Date | null | undefined,
  currentDate: Date = new Date(),
  freshnessMs: number = PRICE_CACHE_FRESHNESS_MS,
): boolean {
  if (!checkedAt) return false;

  const ageMs = Math.max(0, currentDate.getTime() - checkedAt.getTime());
  return ageMs < freshnessMs;
}

export function isFreshAvailabilitySummary(
  summary: AvailabilitySummary | undefined,
  currentDate: Date = new Date(),
): boolean {
  if (!summary?.checkedAt || summary.isStale === true) return false;
  return isFreshPriceCheck(summary.checkedAt, currentDate);
}
