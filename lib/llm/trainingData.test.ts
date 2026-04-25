import { describe, expect, it } from "vitest";
import type {
  CategoryRecommendation,
  InventoryItem,
  ProductRecommendation,
  UserProfile,
} from "@/lib/recommendation/types";
import {
  buildDeterministicRecommendationExplanation,
  buildStoredTrainingExample,
  buildGemmaTrainingMessages,
  exportTrainingExamplesToJsonl,
  parseTrainingInputPayload,
  parseTrainingTargetPayload,
} from "./trainingData";

const profile: UserProfile = {
  id: "profile-1",
  name: "Sam",
  ageRange: "25-34",
  profession: "Designer",
  budgetUsd: 400,
  spendingStyle: "balanced",
  preferences: ["minimal desk"],
  problems: ["eye_strain", "neck_pain"],
  accessibilityNeeds: [],
  roomConstraints: ["shared_space"],
  constraints: {
    deskWidthInches: 48,
    roomLighting: "low",
    sharesSpace: true,
    portableSetup: false,
  },
};

const inventory: InventoryItem[] = [
  {
    id: "inventory-1",
    name: "Laptop only setup",
    category: "monitor",
    condition: "fair",
    painPoints: ["eye_strain", "neck_pain"],
  },
];

const categoryRecommendation: CategoryRecommendation = {
  category: "monitor",
  score: 88,
  priority: "high",
  problemsAddressed: ["eye_strain", "neck_pain"],
  missingOrUpgradeReason: "Current screen setup is cramped.",
  explanation: "A better monitor reduces posture and screen-strain issues.",
  reasons: ["Directly addresses eye strain", "Creates a better posture anchor"],
  relatedProblems: ["eye_strain", "neck_pain"],
  missingFromInventory: false,
};

const recommendation: ProductRecommendation = {
  product: {
    id: "monitor-dell-s2722qc",
    name: "Dell S2722QC",
    brand: "Dell",
    category: "monitor",
    priceUsd: 299,
    shortDescription: "27-inch 4K USB-C monitor",
    strengths: ["sharp 4K panel", "single-cable USB-C"],
    solves: ["eye_strain", "neck_pain", "low_productivity"],
    constraints: {
      minDeskWidthInches: 34,
    },
    scoreHints: {
      comfort: 84,
      productivity: 90,
      accessibility: 72,
      value: 82,
    },
  },
  score: 91,
  breakdown: {
    problemFit: 92,
    traitDeltaFit: 88,
    constraintFit: 88,
    valueFit: 84,
    compatibilityFit: 81,
    availabilityFit: 70,
    confidence: 75,
    finalScore: 91,
  },
  scoreBreakdown: {
    problemFit: 92,
    traitDeltaFit: 88,
    constraintFit: 88,
    valueFit: 84,
    compatibilityFit: 81,
    availabilityFit: 70,
    confidence: 75,
    finalScore: 91,
  },
  fit: "excellent",
  reasons: ["Directly addresses eye strain", "Fits the desk width comfortably"],
  explanation: {
    problemSolved: "This solves eye strain by moving work onto a larger readable display.",
    whyNow: "The current screen setup is cramped and already causing posture issues.",
    whyThisModel: "This model balances USB-C convenience with strong value.",
    tradeoff: "It takes permanent desk space.",
    confidenceLevel: "high",
  },
  tradeoffs: ["Takes more desk space than the laptop-only setup."],
  whyNotCheaper: "Cheaper monitors here usually give up USB-C convenience or panel quality.",
  whyNotMoreExpensive: "More expensive monitors add polish, but not enough extra relief for this budget.",
  isAspirational: false,
  currentBestPriceCents: null,
  priceDeltaFromExpected: null,
  lastCheckedAt: null,
  availabilityStatus: "unknown",
  rankingChangedReason: "No live availability data yet.",
};

describe("trainingData", () => {
  it("stores structured input and the edited explanation target", () => {
    const deterministicExplanation = buildDeterministicRecommendationExplanation(recommendation);
    const example = buildStoredTrainingExample({
      id: "example-1",
      createdAt: new Date("2026-04-25T12:00:00.000Z"),
      profile,
      inventory,
      categoryRecommendation,
      recommendation,
      deterministicExplanation,
      llmExplanation: "A 27-inch 4K monitor gives Sam a much easier screen to read.",
      idealExplanation: "This monitor is the best next step because it cuts eye strain and improves posture without blowing the budget.",
      source: "edited",
      qualityRating: 5,
      notes: "Strong example with concrete tradeoff language.",
    });

    const inputPayload = parseTrainingInputPayload(example);
    const targetPayload = parseTrainingTargetPayload(example);

    expect(inputPayload?.recommendationKey).toBe("profile-1:monitor-dell-s2722qc");
    expect(inputPayload?.structuredInput.recommendation.product.name).toBe("Dell S2722QC");
    expect(targetPayload?.selectedAssistantExplanation).toBe(
      "This monitor is the best next step because it cuts eye strain and improves posture without blowing the budget.",
    );
    expect(example.qualityRating).toBe(5);
    expect(example.notes).toBe("Strong example with concrete tradeoff language.");
  });

  it("exports JSONL using system, user, and assistant messages", () => {
    const deterministicExplanation = buildDeterministicRecommendationExplanation(recommendation);
    const example = buildStoredTrainingExample({
      profile,
      inventory,
      categoryRecommendation,
      recommendation,
      deterministicExplanation,
      llmExplanation: "A 27-inch 4K monitor gives Sam a much easier screen to read.",
      idealExplanation: "",
      source: "generated",
    });

    const messageRecord = buildGemmaTrainingMessages(example);
    const jsonl = exportTrainingExamplesToJsonl([example]);
    const parsedLine = JSON.parse(jsonl) as { messages: Array<{ role: string; content: string }> };

    expect(messageRecord.messages.map((message) => message.role)).toEqual(["system", "user", "assistant"]);
    expect(parsedLine.messages[1].content).toContain("\"deterministicExplanation\"");
    expect(parsedLine.messages[2].content).toBe("A 27-inch 4K monitor gives Sam a much easier screen to read.");
  });
});
