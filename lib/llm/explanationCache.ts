import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import type { LLMRecommendationInput, LLMRecommendationOutput, RecommendationNarrationSource } from "./types";
import { llmRecommendationOutputSchema } from "./types";

export interface RecommendationExplanationCacheKey {
  recommendationId: string;
  productId: string;
  inputHash: string;
}

export interface CachedRecommendationExplanation {
  output: LLMRecommendationOutput;
  source: RecommendationNarrationSource;
  model: string;
  error?: string | null;
  updatedAt: Date;
}

interface ExplanationCacheRecord {
  outputJson: string;
  source: string;
  model: string;
  error: string | null;
  updatedAt: Date;
}

interface ExplanationCacheDbClient {
  recommendationExplanationCache: {
    findUnique(args: {
      where: {
        recommendationId_productId_inputHash: RecommendationExplanationCacheKey;
      };
    }): Promise<ExplanationCacheRecord | null>;
    upsert(args: {
      where: {
        recommendationId_productId_inputHash: RecommendationExplanationCacheKey;
      };
      update: {
        model: string;
        source: string;
        outputJson: string;
        error?: string | null;
      };
      create: RecommendationExplanationCacheKey & {
        model: string;
        source: string;
        outputJson: string;
        error?: string | null;
      };
    }): Promise<ExplanationCacheRecord>;
  };
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`)
    .join(",")}}`;
}

function parseSource(value: string): RecommendationNarrationSource {
  return value === "gemma" ? "gemma" : "deterministic_fallback";
}

export function buildRecommendationNarrationId(profileId: string, category: string): string {
  return `${profileId}:${category}`;
}

export function buildRecommendationInputHash(input: LLMRecommendationInput): string {
  return createHash("sha256")
    .update(stableSerialize({ version: 1, input }))
    .digest("hex");
}

export function buildRecommendationExplanationCacheKey(
  recommendationId: string,
  input: LLMRecommendationInput,
): RecommendationExplanationCacheKey {
  return {
    recommendationId,
    productId: input.productRecommendation.id,
    inputHash: buildRecommendationInputHash(input),
  };
}

export async function findCachedRecommendationExplanation(
  key: RecommendationExplanationCacheKey,
  cacheDb: ExplanationCacheDbClient = db as unknown as ExplanationCacheDbClient,
): Promise<CachedRecommendationExplanation | null> {
  const record = await cacheDb.recommendationExplanationCache.findUnique({
    where: {
      recommendationId_productId_inputHash: key,
    },
  });

  if (!record) return null;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(record.outputJson) as unknown;
  } catch {
    return null;
  }

  const parsedOutput = llmRecommendationOutputSchema.safeParse(parsedJson);
  if (!parsedOutput.success) return null;

  return {
    output: parsedOutput.data,
    source: parseSource(record.source),
    model: record.model,
    error: record.error,
    updatedAt: record.updatedAt,
  };
}

export async function upsertRecommendationExplanationCache(
  key: RecommendationExplanationCacheKey,
  value: {
    model: string;
    source: RecommendationNarrationSource;
    output: LLMRecommendationOutput;
    error?: string | null;
  },
  cacheDb: ExplanationCacheDbClient = db as unknown as ExplanationCacheDbClient,
): Promise<void> {
  await cacheDb.recommendationExplanationCache.upsert({
    where: {
      recommendationId_productId_inputHash: key,
    },
    update: {
      model: value.model,
      source: value.source,
      outputJson: JSON.stringify(value.output),
      error: value.error ?? null,
    },
    create: {
      ...key,
      model: value.model,
      source: value.source,
      outputJson: JSON.stringify(value.output),
      error: value.error ?? null,
    },
  });
}
