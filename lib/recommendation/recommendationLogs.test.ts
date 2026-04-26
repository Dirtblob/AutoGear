import { describe, expect, it, vi } from "vitest";
import type { ProductRecommendation } from "./types";
import { buildRecommendationRunLogDocument, saveRecommendationRunLog } from "./recommendationLogs";

vi.mock("server-only", () => ({}));

function recommendation(): ProductRecommendation {
  return {
    product: {
      id: "mongo-object-id",
      catalogDeviceId: "catalog-device-id",
      name: "Test Monitor",
      brand: "Test",
      category: "monitor",
      priceUsd: 300,
      shortDescription: "A monitor.",
      strengths: ["Clear text"],
      solves: ["eye_strain"],
      constraints: {},
      scoreHints: {
        comfort: 8,
        productivity: 8,
        accessibility: 7,
        value: 7,
      },
    },
    finalRecommendationScore: 87,
    fitScore: 82,
    traitDeltaScore: 78,
    score: 87,
    breakdown: {
      problemFit: 90,
      ergonomicFit: 82,
      traitDeltaFit: 78,
      constraintFit: 88,
      valueFit: 75,
      compatibilityFit: 80,
      availabilityFit: 70,
      confidence: 85,
      finalScore: 87,
    },
    scoreBreakdown: {
      problemFit: 90,
      ergonomicFit: 82,
      traitDeltaFit: 78,
      constraintFit: 88,
      valueFit: 75,
      compatibilityFit: 80,
      availabilityFit: 70,
      confidence: 85,
      finalScore: 87,
    },
    fit: "excellent",
    reasons: ["Strong fit"],
    explanation: {
      problemSolved: "Since you work as a Designer, Test Monitor helps.",
      whyNow: "Designer workflows benefit from a better screen.",
      whyThisModel: "It balances value and clarity.",
      tradeoff: "It takes desk space.",
      confidenceLevel: "high",
    },
    tradeoffs: ["It takes desk space."],
    whyNotCheaper: "Cheaper options lose clarity.",
    whyNotMoreExpensive: "More expensive options are not needed.",
    currentBestPriceCents: null,
    priceDeltaFromExpected: null,
    lastCheckedAt: null,
    availabilityStatus: "unknown",
    rankingChangedReason: "Baseline ranking.",
    profileFieldsUsed: [
      "user_private_profiles.handLengthMm",
      "user_private_profiles.palmWidthMm",
      "user_private_profiles.gripStyle",
    ],
    missingDeviceSpecs: [],
    confidenceLevel: "high",
  };
}

describe("recommendation logs", () => {
  it("stores lean recommendation history without raw private field values", () => {
    const log = buildRecommendationRunLogDocument({
      userId: "user-1",
      inventory: [{ id: "inventory-1", name: "Current monitor", category: "monitor", condition: "fair", painPoints: [] }],
      recommendations: [recommendation()],
      privateTextRedactions: ["Designer"],
      createdAt: new Date("2026-04-25T12:00:00.000Z"),
    });

    expect(log.userId).toBe("user-1");
    expect(log.inputInventoryItemIds).toEqual(["inventory-1"]);
    expect(log.recommendedDeviceCatalogIds).toEqual(["catalog-device-id"]);
    expect(log.recommendations[0]?.profileFieldsUsed).toEqual(["gripStyle", "handLengthMm", "palmWidthMm"]);
    expect(log.recommendations[0]?.scores.finalRecommendationScore).toBe(87);
    expect(JSON.stringify(log)).not.toContain("Designer");
  });

  it("does not connect to MongoDB when recommendation history is disabled", async () => {
    await expect(
      saveRecommendationRunLog({
        userId: "user-1",
        inventory: [],
        recommendations: [],
        allowRecommendationHistory: false,
      }),
    ).resolves.toBeUndefined();
  });
});
