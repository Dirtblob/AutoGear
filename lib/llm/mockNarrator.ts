import type { LLMRecommendationInput, LLMRecommendationOutput } from "./types";

function toSentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function joinSentences(values: Array<string | null | undefined>): string {
  return values
    .map((value) => (value ? toSentence(value) : ""))
    .filter(Boolean)
    .join(" ");
}

function formatUsd(cents: number | null): string | null {
  if (cents === null) return null;
  return `$${(cents / 100).toFixed(2)}`;
}

function buildAvailabilitySentence(input: LLMRecommendationInput): string {
  const priceText = formatUsd(input.availability.bestListingPriceCents);

  if (input.availability.status === "unavailable") {
    return "Current availability is marked unavailable, so treat this as a fit recommendation rather than a ready-to-buy pick.";
  }

  if (input.availability.refreshSkippedReason === "free_tier_quota") {
    return joinSentences([
      priceText ? `The latest price shown is cached at ${priceText}` : "Pricing is based on cached data",
      "because the live refresh was skipped after hitting the free-tier quota",
    ]);
  }

  if (input.availability.refreshSource === "cached") {
    return priceText
      ? `Pricing is currently based on cached data, with the best cached price at ${priceText}.`
      : "Availability is based on cached data, so the current price should be rechecked before buying.";
  }

  if (input.availability.status === "available" && priceText) {
    return `Current availability shows this model in stock around ${priceText}.`;
  }

  return "Live availability still needs confirmation before treating this as a purchase-ready recommendation.";
}

function buildMissingDataSentence(input: LLMRecommendationInput): string | null {
  const searchableText = `${input.userProfileSummary} ${input.inventorySummary}`.toLowerCase();

  if (
    searchableText.includes("exact model") ||
    searchableText.includes("specs are missing") ||
    searchableText.includes("not provided") ||
    searchableText.includes("unknown")
  ) {
    return "Some current-item specs are still missing, so final fit and compatibility should be confirmed.";
  }

  return null;
}

function buildFollowUpQuestion(input: LLMRecommendationInput): string {
  const missingDataSentence = buildMissingDataSentence(input);
  if (missingDataSentence) {
    return "Can you confirm the exact current model or any important ports and size limits before buying?";
  }

  if (input.availability.status !== "available") {
    return "Do you want to keep this as a target model or swap to something that is easier to buy right now?";
  }

  return "Do you want to prioritize buying this now, or compare one similarly scored alternative first?";
}

export function buildMockRecommendationOutput(input: LLMRecommendationInput): LLMRecommendationOutput {
  const { categoryRecommendation, productRecommendation, scoreBreakdown } = input;
  const missingDataSentence = buildMissingDataSentence(input);
  const availabilitySentence = buildAvailabilitySentence(input);
  const deltaSentence = input.deviceDelta
    ? `${productRecommendation.name} is compared against ${input.deviceDelta.currentDevice.missing ? "no current device in that category" : input.deviceDelta.currentDevice.label} with a ${input.deviceDelta.netImprovementScore}/100 net improvement score.`
    : null;
  const deltaReasonSentence = input.deviceDelta
    ? "This is ranked highly because it improves the exact traits connected to the stated problems."
    : null;

  return {
    headline: `${productRecommendation.name} is the strongest ${categoryRecommendation.category.replaceAll("_", " ")} upgrade right now`,
    explanation: joinSentences([
      productRecommendation.deterministicExplanation.problemSolved,
      deltaSentence,
      `${productRecommendation.name} keeps the deterministic score at ${productRecommendation.score}/100, with ${scoreBreakdown.problemFit}/100 problem fit and ${scoreBreakdown.valueFit}/100 value fit.`,
      availabilitySentence,
    ]),
    tradeoffs: joinSentences([
      productRecommendation.deterministicExplanation.tradeoff,
      input.availability.status === "unavailable"
        ? "It may need a substitute if you want something you can buy immediately."
        : undefined,
    ]),
    whyThisHelps: joinSentences([
      deltaReasonSentence,
      productRecommendation.deterministicExplanation.whyNow,
      productRecommendation.deterministicExplanation.whyThisModel,
    ]),
    whyNotCheaper: toSentence(productRecommendation.whyNotCheaper),
    whyNotMoreExpensive: toSentence(productRecommendation.whyNotMoreExpensive),
    confidenceNote: joinSentences([
      `This keeps the existing deterministic score breakdown unchanged, including ${scoreBreakdown.finalScore}/100 overall confidence in the ranking.`,
      input.deviceDelta ? `The device delta is explanatory only and does not let narration change the score.` : undefined,
      availabilitySentence,
      missingDataSentence,
    ]),
    followUpQuestion: buildFollowUpQuestion(input),
  };
}
