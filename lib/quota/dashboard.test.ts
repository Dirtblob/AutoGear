import { describe, expect, it } from "vitest";
import { buildPricesApiDashboardMetrics } from "./dashboard";
import type { PricesApiUsageSnapshot } from "./types";

function snapshot(overrides: Partial<PricesApiUsageSnapshot> = {}): PricesApiUsageSnapshot {
  return {
    policy: {
      provider: "pricesapi",
      limitPerMinute: 10,
      limitPerMonth: 1000,
    },
    minuteCallsUsed: 2,
    monthlyCallsUsed: 250,
    minuteRemaining: 8,
    monthlyRemaining: 750,
    ...overrides,
  };
}

describe("buildPricesApiDashboardMetrics", () => {
  it("computes a safe daily average from the remaining monthly budget", () => {
    const metrics = buildPricesApiDashboardMetrics(snapshot(), new Date("2026-04-25T12:00:00Z"));

    expect(metrics.calendarDaysRemaining).toBe(5);
    expect(metrics.safeAverageCallsPerDay).toBe(150);
  });

  it("returns no quota exhaustion estimate when there is no burn rate yet", () => {
    const metrics = buildPricesApiDashboardMetrics(
      snapshot({
        monthlyCallsUsed: 0,
        monthlyRemaining: 1000,
      }),
      new Date("2026-04-02T12:00:00Z"),
    );

    expect(metrics.estimatedQuotaDaysRemaining).toBeNull();
  });
});
