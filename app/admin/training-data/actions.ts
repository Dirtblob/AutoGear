"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { productCatalog } from "@/data/seeds/productCatalog";
import { db } from "@/lib/db";
import {
  buildDeterministicRecommendationExplanation,
  buildRecommendationKey,
  buildStoredTrainingExample,
  getTrainingExampleRecommendationKey,
} from "@/lib/llm/trainingData";
import { getTrainingScenarios } from "@/lib/llm/trainingScenarios";
import { getCategoryRecommendations } from "@/lib/recommendation/categoryEngine";
import { getProductRecommendations } from "@/lib/recommendation/productEngine";

function buildStatusHrefWithCount(status: string, count: number): string {
  return `/admin/training-data?status=${encodeURIComponent(status)}&count=${encodeURIComponent(String(count))}`;
}

function buildScenariosStatusHref(
  scenarios: number,
  recommendations: number,
  saved: number,
  skipped: number,
): string {
  const params = new URLSearchParams({
    status: "scenarios_generated",
    scenarios: String(scenarios),
    recommendations: String(recommendations),
    saved: String(saved),
    skipped: String(skipped),
  });
  return `/admin/training-data?${params.toString()}`;
}

export async function deleteAllTrainingExamplesAction(): Promise<void> {
  const result = await db.trainingExample.deleteMany();

  revalidatePath("/admin/training-data");
  redirect(buildStatusHrefWithCount("deleted_all", result.count));
}

export async function deleteLowQualityTrainingExamplesAction(): Promise<void> {
  const result = await db.trainingExample.deleteMany({
    where: {
      OR: [{ qualityRating: null }, { qualityRating: { lt: 3 } }],
    },
  });

  revalidatePath("/admin/training-data");
  redirect(buildStatusHrefWithCount("deleted_low_quality", result.count));
}

async function findExistingKeySet(): Promise<Set<string>> {
  const existingExamples = await db.trainingExample.findMany({
    select: { inputJson: true },
  });
  const keys = new Set<string>();
  for (const example of existingExamples) {
    const key = getTrainingExampleRecommendationKey(example);
    if (key) keys.add(key);
  }
  return keys;
}

export async function generateTrainingExamplesFromScenariosAction(): Promise<void> {
  const scenarios = getTrainingScenarios();
  const existingKeys = await findExistingKeySet();

  let scenariosProcessed = 0;
  let totalRecommendations = 0;
  let totalSaved = 0;
  let totalSkipped = 0;

  for (const scenario of scenarios) {
    const input = {
      profile: scenario.profile,
      inventory: scenario.inventory,
      exactCurrentModelsProvided: scenario.exactCurrentModelsProvided,
      usedItemsOkay: scenario.usedItemsOkay,
      deviceType: scenario.deviceType,
      ports: scenario.ports,
    } as const;

    const categoryRecommendations = getCategoryRecommendations(input);

    for (const categoryRecommendation of categoryRecommendations) {
      const rankedRecommendations = getProductRecommendations(
        input,
        categoryRecommendation,
        productCatalog,
      ).slice(0, 2);

      for (const recommendation of rankedRecommendations) {
        totalRecommendations += 1;
        const key = buildRecommendationKey(scenario.profile.id, recommendation.product.id);

        if (existingKeys.has(key)) {
          totalSkipped += 1;
          continue;
        }

        const rejectedAlternatives = rankedRecommendations
          .filter((c) => c.product.id !== recommendation.product.id)
          .slice(0, 3)
          .map((c) => ({ label: c.product.name, reason: c.reasons[0] ?? c.whyNotCheaper }));

        const deterministicExplanation = buildDeterministicRecommendationExplanation(recommendation);
        const example = buildStoredTrainingExample({
          profile: scenario.profile,
          inventory: scenario.inventory,
          categoryRecommendation,
          recommendation,
          rejectedAlternatives: rejectedAlternatives.length > 0 ? rejectedAlternatives : undefined,
          deterministicExplanation,
          llmExplanation: deterministicExplanation,
          source: "generated",
          notes: `Synthetic scenario: ${scenario.label}`,
        });

        await db.trainingExample.create({
          data: {
            inputJson: example.inputJson,
            targetOutputJson: example.targetOutputJson,
            source: example.source,
            qualityRating: example.qualityRating ?? null,
            notes: example.notes ?? null,
          },
        });

        existingKeys.add(key);
        totalSaved += 1;
      }
    }

    scenariosProcessed += 1;
  }

  revalidatePath("/admin/training-data");
  redirect(buildScenariosStatusHref(scenariosProcessed, totalRecommendations, totalSaved, totalSkipped));
}
