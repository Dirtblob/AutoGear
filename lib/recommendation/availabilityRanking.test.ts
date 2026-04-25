import { describe, expect, it } from "vitest";
import type { AvailabilitySummary } from "@/lib/availability";
import { rerankProductRecommendationsWithAvailability, scoreAvailabilityAdjustment } from "./availabilityRanking";
import type { ProductRecommendation } from "./types";

function recommendation(
  id: string,
  score: number,
  priceUsd: number,
): ProductRecommendation {
  return {
    product: {
      id,
      name: id,
      brand: "Test",
      category: "monitor",
      priceUsd,
      shortDescription: "Test product.",
      strengths: ["Practical"],
      solves: ["eye_strain"],
      constraints: {},
      scoreHints: {
        comfort: 7,
        productivity: 7,
        accessibility: 7,
        value: 7,
      },
    },
    score,
    fit: "strong",
    reasons: ["Good fit"],
    explanation: {
      problemSolved: "Helpful",
      whyNow: "Now",
      whyThisModel: "Model",
      tradeoff: "Tradeoff",
      confidenceLevel: "high",
    },
    tradeoffs: [],
    whyNotCheaper: "Cheaper misses the fit",
    whyNotMoreExpensive: "More expensive is not needed",
    currentBestPriceCents: null,
    priceDeltaFromExpected: null,
    lastCheckedAt: null,
    availabilityStatus: "unknown",
    rankingChangedReason: "Baseline ranking",
    scoreBreakdown: {
      problemFit: score,
      traitDeltaFit: score,
      constraintFit: score,
      valueFit: score,
      compatibilityFit: score,
      availabilityFit: score,
      confidence: score,
      finalScore: score,
    },
  };
}

function summary(
  productModelId: string,
  priceCents: number,
  status: AvailabilitySummary["status"] = "available",
): AvailabilitySummary {
  return {
    provider: "pricesapi",
    productModelId,
    status,
    label: status === "available" ? "Available" : "Unavailable",
    listings: [],
    bestListing:
      status === "available"
        ? {
            provider: "pricesapi",
            productModelId,
            title: productModelId,
            brand: "Test",
            model: "Model",
            retailer: "Shop",
            available: true,
            priceCents,
            totalPriceCents: priceCents,
            condition: "new",
            url: "https://example.com",
            confidence: 90,
            checkedAt: new Date("2026-04-25T00:00:00Z"),
          }
        : null,
    checkedAt: new Date("2026-04-25T00:00:00Z"),
    refreshSource: "cached",
  };
}

describe("availabilityRanking", () => {
  it("boosts products with strong cached prices", () => {
    const boosted = scoreAvailabilityAdjustment(recommendation("boosted", 80, 200), summary("boosted", 14000));

    expect(boosted).toBeGreaterThan(0);
  });

  it("reranks tied recommendations using cached availability snapshots", () => {
    const ranked = rerankProductRecommendationsWithAvailability(
      [recommendation("baseline", 80, 200), recommendation("discounted", 80, 200)],
      {
        discounted: summary("discounted", 14000),
      },
    );

    expect(ranked[0]?.product.id).toBe("discounted");
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });
});
