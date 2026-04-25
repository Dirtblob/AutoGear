import type {
  CategoryRecommendation,
  InventoryItem,
  ProductRecommendation,
  UserProfile,
} from "@/lib/recommendation/types";
import type { AvailabilitySummary } from "@/lib/availability";
import { buildLLMRecommendationInput } from "./recommendationNarrator";
import type { LLMAvailabilityInput, RejectedAlternativeSummary } from "./types";
import { buildRecommendationNarrationPrompt, recommendationNarratorSystemPrompt } from "./promptTemplates";

export type TrainingExampleSource = "generated" | "edited" | "approved";

export const trainingExampleSystemPrompt =
  "You are LifeUpgrade's explanation engine. You explain deterministic product recommendations created by the app. Do not change rankings, scores, prices, specs, or availability. Do not invent products or user details. Only explain the provided recommendation. If information is missing, mention uncertainty. Return only valid JSON. Do not use markdown.";

export interface TrainingExample {
  id: string;
  createdAt: Date;
  inputJson: string;
  targetOutputJson: string;
  source: TrainingExampleSource;
  qualityRating?: number | null;
  notes?: string | null;
}

export interface RecommendationTrainingInputPayload {
  recommendationKey: string;
  capturedAt: string;
  promptPreview: {
    system: string;
    user: string;
  };
  structuredInput: {
    userProfileSummary: string;
    inventorySummary: string;
    profile: UserProfile;
    inventory: InventoryItem[];
    categoryRecommendation: Pick<
      CategoryRecommendation,
      "category" | "score" | "priority" | "reasons" | "problemsAddressed" | "missingOrUpgradeReason" | "explanation"
    >;
    recommendation: Pick<
      ProductRecommendation,
      | "score"
      | "scoreBreakdown"
      | "fit"
      | "reasons"
      | "explanation"
      | "tradeoffs"
      | "whyNotCheaper"
      | "whyNotMoreExpensive"
      | "availabilityStatus"
      | "rankingChangedReason"
    > & {
      product: ProductRecommendation["product"];
    };
    availability: LLMAvailabilityInput;
    availabilitySnapshot: {
      provider: string;
      retailer: string | null;
      available: boolean;
      priceCents: number | null;
      shippingCents: number | null;
      totalPriceCents: number | null;
      checkedAtIso: string;
      condition: string | null;
      url: string | null;
    } | null;
    rejectedAlternatives: RejectedAlternativeSummary[];
    cachedPriceStatus: string | null;
    deterministicExplanation: string;
    llmExplanation: string;
  };
}

export interface RecommendationTrainingTargetPayload {
  idealExplanation: string | null;
  deterministicExplanation: string;
  llmExplanation: string;
  selectedAssistantExplanation: string;
}

interface BuildStoredTrainingExampleParams {
  id?: string;
  createdAt?: Date;
  profile: UserProfile;
  inventory: InventoryItem[];
  categoryRecommendation: CategoryRecommendation;
  recommendation: ProductRecommendation;
  availability?: AvailabilitySummary;
  availabilitySnapshot?: {
    provider: string;
    retailer: string | null;
    available: boolean;
    priceCents: number | null;
    shippingCents: number | null;
    totalPriceCents: number | null;
    checkedAt: Date;
    condition: string | null;
    url: string | null;
  } | null;
  rejectedAlternatives?: RejectedAlternativeSummary[];
  deterministicExplanation: string;
  llmExplanation: string;
  idealExplanation?: string | null;
  source: TrainingExampleSource;
  qualityRating?: number | null;
  notes?: string | null;
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function serializeJson(value: unknown): string {
  return JSON.stringify(value);
}

function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeQualityRating(value: number | null | undefined): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  const normalized = Math.round(value);
  if (normalized < 1 || normalized > 5) return null;
  return normalized;
}

export function buildRecommendationKey(profileId: string, productId: string): string {
  return `${profileId}:${productId}`;
}

export function buildDeterministicRecommendationExplanation(recommendation: ProductRecommendation): string {
  const sections = [
    recommendation.explanation.problemSolved,
    recommendation.explanation.whyNow,
    recommendation.explanation.whyThisModel,
    `Tradeoff: ${recommendation.explanation.tradeoff}`,
    `Why not cheaper: ${recommendation.whyNotCheaper}`,
    `Why not more expensive: ${recommendation.whyNotMoreExpensive}`,
  ].map((section) => section.trim());

  return sections.filter(Boolean).join("\n\n");
}

function cachedPriceStatusMessage(availability: LLMAvailabilityInput): string | null {
  if (availability.refreshSkippedReason === "free_tier_quota") {
    return "Price and availability are based on cached data because the live refresh hit the free-tier quota.";
  }

  if (availability.refreshSource === "cached") {
    return "Price and availability are based on cached data.";
  }

  return null;
}

function buildTrainingInputPayload({
  createdAt = new Date(),
  profile,
  inventory,
  categoryRecommendation,
  recommendation,
  availability,
  availabilitySnapshot,
  rejectedAlternatives,
  deterministicExplanation,
  llmExplanation,
}: Omit<BuildStoredTrainingExampleParams, "id" | "idealExplanation" | "notes" | "qualityRating" | "source"> & {
  createdAt?: Date;
}): RecommendationTrainingInputPayload {
  const llmInput = buildLLMRecommendationInput({
    profile,
    inventory,
    categoryRecommendation,
    productRecommendation: recommendation,
    availability,
    rejectedAlternatives,
  });

  return {
    recommendationKey: buildRecommendationKey(profile.id, recommendation.product.id),
    capturedAt: createdAt.toISOString(),
    promptPreview: {
      system: recommendationNarratorSystemPrompt,
      user: buildRecommendationNarrationPrompt(llmInput),
    },
    structuredInput: {
      userProfileSummary: llmInput.userProfileSummary,
      inventorySummary: llmInput.inventorySummary,
      profile,
      inventory,
      categoryRecommendation: {
        category: categoryRecommendation.category,
        score: categoryRecommendation.score,
        priority: categoryRecommendation.priority,
        reasons: categoryRecommendation.reasons,
        problemsAddressed: categoryRecommendation.problemsAddressed,
        missingOrUpgradeReason: categoryRecommendation.missingOrUpgradeReason,
        explanation: categoryRecommendation.explanation,
      },
      recommendation: {
        product: recommendation.product,
        score: recommendation.score,
        scoreBreakdown: recommendation.scoreBreakdown,
        fit: recommendation.fit,
        reasons: recommendation.reasons,
        explanation: recommendation.explanation,
        tradeoffs: recommendation.tradeoffs,
        whyNotCheaper: recommendation.whyNotCheaper,
        whyNotMoreExpensive: recommendation.whyNotMoreExpensive,
        availabilityStatus: recommendation.availabilityStatus,
        rankingChangedReason: recommendation.rankingChangedReason,
      },
      availability: llmInput.availability,
      availabilitySnapshot: availabilitySnapshot
        ? {
            provider: availabilitySnapshot.provider,
            retailer: availabilitySnapshot.retailer,
            available: availabilitySnapshot.available,
            priceCents: availabilitySnapshot.priceCents,
            shippingCents: availabilitySnapshot.shippingCents,
            totalPriceCents: availabilitySnapshot.totalPriceCents,
            checkedAtIso: availabilitySnapshot.checkedAt.toISOString(),
            condition: availabilitySnapshot.condition,
            url: availabilitySnapshot.url,
          }
        : null,
      rejectedAlternatives: [...llmInput.rejectedAlternatives],
      cachedPriceStatus: cachedPriceStatusMessage(llmInput.availability),
      deterministicExplanation,
      llmExplanation,
    },
  };
}

export function selectAssistantExplanation(
  source: TrainingExampleSource,
  idealExplanation: string | null | undefined,
  llmExplanation: string,
  deterministicExplanation: string,
): string {
  const edited = trimmedOrNull(idealExplanation);

  if ((source === "edited" || source === "approved") && edited) {
    return edited;
  }

  return llmExplanation.trim() || deterministicExplanation.trim();
}

function buildTrainingTargetPayload({
  idealExplanation,
  deterministicExplanation,
  llmExplanation,
  source,
}: Pick<
  BuildStoredTrainingExampleParams,
  "idealExplanation" | "deterministicExplanation" | "llmExplanation" | "source"
>): RecommendationTrainingTargetPayload {
  return {
    idealExplanation: trimmedOrNull(idealExplanation),
    deterministicExplanation: deterministicExplanation.trim(),
    llmExplanation: llmExplanation.trim(),
    selectedAssistantExplanation: selectAssistantExplanation(
      source,
      idealExplanation,
      llmExplanation,
      deterministicExplanation,
    ),
  };
}

export function buildStoredTrainingExample({
  id = "",
  createdAt = new Date(),
  profile,
  inventory,
  categoryRecommendation,
  recommendation,
  availability,
  availabilitySnapshot,
  rejectedAlternatives,
  deterministicExplanation,
  llmExplanation,
  idealExplanation,
  source,
  qualityRating,
  notes,
}: BuildStoredTrainingExampleParams): TrainingExample {
  const inputPayload = buildTrainingInputPayload({
    createdAt,
    profile,
    inventory,
    categoryRecommendation,
    recommendation,
    availability,
    availabilitySnapshot,
    rejectedAlternatives,
    deterministicExplanation,
    llmExplanation,
  });
  const targetPayload = buildTrainingTargetPayload({
    deterministicExplanation,
    llmExplanation,
    idealExplanation,
    source,
  });

  return {
    id,
    createdAt,
    inputJson: serializeJson(inputPayload),
    targetOutputJson: serializeJson(targetPayload),
    source,
    qualityRating: normalizeQualityRating(qualityRating),
    notes: trimmedOrNull(notes),
  };
}

export function parseTrainingInputPayload(example: Pick<TrainingExample, "inputJson">): RecommendationTrainingInputPayload | null {
  return safeJsonParse<RecommendationTrainingInputPayload>(example.inputJson);
}

export function parseTrainingTargetPayload(
  example: Pick<TrainingExample, "targetOutputJson">,
): RecommendationTrainingTargetPayload | null {
  return safeJsonParse<RecommendationTrainingTargetPayload>(example.targetOutputJson);
}

export function getTrainingExampleRecommendationKey(example: Pick<TrainingExample, "inputJson">): string | null {
  return parseTrainingInputPayload(example)?.recommendationKey ?? null;
}

export function buildGemmaTrainingMessages(
  example: Pick<TrainingExample, "inputJson" | "targetOutputJson">,
): { messages: Array<{ role: "system" | "user" | "assistant"; content: string }> } {
  const input = parseTrainingInputPayload(example);
  const target = parseTrainingTargetPayload(example);

  if (!input || !target) {
    return {
      messages: [
        {
          role: "system",
          content: recommendationNarratorSystemPrompt,
        },
        {
          role: "user",
          content: "{}",
        },
        {
          role: "assistant",
          content: "",
        },
      ],
    };
  }

  return {
    messages: [
      {
        role: "system",
        content: trainingExampleSystemPrompt,
      },
      {
        role: "user",
        content: JSON.stringify(input.structuredInput, null, 2),
      },
      {
        role: "assistant",
        content: target.selectedAssistantExplanation,
      },
    ],
  };
}

export function exportTrainingExamplesToJsonl(
  examples: Array<Pick<TrainingExample, "inputJson" | "targetOutputJson">>,
): string {
  return examples.map((example) => serializeJson(buildGemmaTrainingMessages(example))).join("\n");
}
