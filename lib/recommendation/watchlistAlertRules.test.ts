import { describe, expect, it } from "vitest";
import { buildWatchlistAlertDrafts } from "./watchlistAlertRules";

describe("buildWatchlistAlertDrafts", () => {
  it("creates availability and target alerts when a watched product comes back in stock below target", () => {
    const alerts = buildWatchlistAlertDrafts({
      productName: "BenQ ScreenBar",
      previousAvailable: false,
      currentAvailable: true,
      previousPriceCents: null,
      currentPriceCents: 8900,
      targetPriceCents: 9500,
      previousScore: 74,
      currentScore: 82,
      previousRank: 5,
      currentRank: 2,
      provider: "mock",
      url: "https://example.com/screenbar",
    });

    expect(alerts.map((alert) => alert.title)).toEqual([
      "Now available",
      "Price fell below your target",
      "Entered the top 3",
    ]);
  });

  it("creates drop and score alerts only when thresholds are crossed", () => {
    const alerts = buildWatchlistAlertDrafts({
      productName: "Dell S2722QC",
      previousAvailable: true,
      currentAvailable: true,
      previousPriceCents: 30000,
      currentPriceCents: 25000,
      targetPriceCents: 24000,
      previousScore: 68,
      currentScore: 79,
      previousRank: 4,
      currentRank: 4,
      provider: "pricesapi",
      url: "https://example.com/dell",
    });

    expect(alerts.map((alert) => alert.title)).toEqual([
      "Price dropped by 15% or more",
      "Recommendation score jumped",
    ]);
  });

  it("does not create alerts when the watched product stays below the same threshold", () => {
    const alerts = buildWatchlistAlertDrafts({
      productName: "Logitech MX Keys",
      previousAvailable: true,
      currentAvailable: true,
      previousPriceCents: 9000,
      currentPriceCents: 8900,
      targetPriceCents: 9500,
      previousScore: 83,
      currentScore: 85,
      previousRank: 2,
      currentRank: 2,
      provider: "mock",
      url: "https://example.com/mx-keys",
    });

    expect(alerts).toHaveLength(0);
  });
});
