import "server-only";

import { getMongoDatabase } from "@/lib/mongodb";
import type { InventoryItem, ProductRecommendation, RecommendationExplanation, ScoreBreakdown } from "./types";

interface RecommendationLogScores {
  score: number;
  finalRecommendationScore: number;
  fitScore: number;
  traitDeltaScore: number;
  scoreBreakdown: ScoreBreakdown;
}

interface RecommendationLogEntry {
  deviceCatalogId: string;
  scores: RecommendationLogScores;
  explanation: RecommendationExplanation;
  profileFieldsUsed: string[];
  missingDeviceSpecs: string[];
  confidenceLevel: ProductRecommendation["confidenceLevel"];
}

export interface RecommendationLogDocument {
  userId: string;
  inputInventoryItemIds: string[];
  recommendedDeviceCatalogIds: string[];
  recommendations: RecommendationLogEntry[];
  createdAt: Date;
}

function deviceCatalogIdForRecommendation(recommendation: ProductRecommendation): string {
  return recommendation.product.catalogDeviceId ?? recommendation.product.id;
}

function profileFieldName(fieldPath: string): string {
  return fieldPath.replace(/^(user_private_profiles|user_profiles)\./, "");
}

function profileFieldsUsedForLog(recommendation: ProductRecommendation): string[] {
  return Array.from(new Set((recommendation.profileFieldsUsed ?? []).map(profileFieldName))).sort();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactPrivateText(value: string, redactions: string[]): string {
  return redactions
    .map((redaction) => redaction.trim())
    .filter((redaction) => redaction.length >= 3)
    .reduce(
      (text, redaction) => text.replace(new RegExp(escapeRegExp(redaction), "gi"), "[private field]"),
      value,
    );
}

function explanationForLog(
  explanation: RecommendationExplanation,
  privateTextRedactions: string[] = [],
): RecommendationExplanation {
  return {
    problemSolved: redactPrivateText(explanation.problemSolved, privateTextRedactions),
    whyNow: redactPrivateText(explanation.whyNow, privateTextRedactions),
    whyThisModel: redactPrivateText(explanation.whyThisModel, privateTextRedactions),
    tradeoff: redactPrivateText(explanation.tradeoff, privateTextRedactions),
    confidenceLevel: explanation.confidenceLevel,
  };
}

export function buildRecommendationRunLogDocument(input: {
  userId: string;
  inventory: InventoryItem[];
  recommendations: ProductRecommendation[];
  privateTextRedactions?: string[];
  createdAt?: Date;
}): RecommendationLogDocument {
  const recommendedDeviceCatalogIds = input.recommendations.map(deviceCatalogIdForRecommendation);

  return {
    userId: input.userId,
    inputInventoryItemIds: input.inventory.map((item) => item.id),
    recommendedDeviceCatalogIds,
    recommendations: input.recommendations.map((recommendation) => ({
      deviceCatalogId: deviceCatalogIdForRecommendation(recommendation),
      scores: {
        score: recommendation.score,
        finalRecommendationScore: recommendation.finalRecommendationScore,
        fitScore: recommendation.fitScore,
        traitDeltaScore: recommendation.traitDeltaScore,
        scoreBreakdown: recommendation.scoreBreakdown,
      },
      explanation: explanationForLog(recommendation.explanation, input.privateTextRedactions),
      profileFieldsUsed: profileFieldsUsedForLog(recommendation),
      missingDeviceSpecs: recommendation.missingDeviceSpecs,
      confidenceLevel: recommendation.confidenceLevel,
    })),
    createdAt: input.createdAt ?? new Date(),
  };
}

export async function saveRecommendationRunLog(input: {
  userId: string;
  inventory: InventoryItem[];
  recommendations: ProductRecommendation[];
  allowRecommendationHistory?: boolean;
  privateTextRedactions?: string[];
  createdAt?: Date;
}): Promise<void> {
  if (input.allowRecommendationHistory === false) return;

  const database = await getMongoDatabase();
  const collection = database.collection<RecommendationLogDocument>("recommendation_logs");

  await collection.insertOne(buildRecommendationRunLogDocument(input));
}
