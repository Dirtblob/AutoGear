"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { productCatalog } from "@/data/seeds/productCatalog";
import { db } from "@/lib/db";
import { refreshPrices } from "@/lib/jobs/refreshPrices";
import { getPricesApiProviderName } from "@/lib/availability/pricesApiProvider";
import { deleteDevInventoryItems, replaceDevInventoryItems } from "@/lib/inventory/mongoInventory";
import { getPricesApiUsageSnapshot } from "@/lib/quota/pricesApiQuota";
import {
  buildHackathonDemoRecommendationInput,
  hackathonDemoInventoryRecords,
  hackathonDemoProfile,
  serializeHackathonDemoProfile,
} from "@/lib/recommendation/demoMode";
import { rankProductsForInput } from "@/lib/recommendation/productEngine";
import { getCachedAvailabilitySummaries } from "@/lib/availability";
import { buildToastHref } from "@/lib/ui/toasts";
import { recordBackgroundJobError } from "@/lib/admin/debugState";
import { buildRecommendationNarrationId } from "@/lib/llm/explanationCache";
import { narrateRecommendation } from "@/lib/llm/recommendationNarrator";
import { getCategoryRecommendations } from "@/lib/recommendation/categoryEngine";

function priorityForScore(score: number): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 80) return "CRITICAL";
  if (score >= 65) return "HIGH";
  if (score >= 45) return "MEDIUM";
  return "LOW";
}

function revalidateAdminPaths(): void {
  revalidatePath("/");
  revalidatePath("/inventory");
  revalidatePath("/recommendations");
  revalidatePath("/settings");
  revalidatePath("/admin");
  revalidatePath("/admin/api-usage");
}

export async function runAdminDemoProfileAction(): Promise<void> {
  const profileData = serializeHackathonDemoProfile();
  const availabilityByProductId = await getCachedAvailabilitySummaries(productCatalog);
  const recommendationInput = {
    ...buildHackathonDemoRecommendationInput(),
    availabilityByProductId,
  };
  const recommendations = rankProductsForInput(recommendationInput).slice(0, 8);

  await db.$transaction(async (tx) => {
    await tx.userProfile.upsert({
      where: { id: hackathonDemoProfile.id },
      update: profileData,
      create: {
        id: hackathonDemoProfile.id,
        ...profileData,
      },
    });

    await tx.savedProduct.deleteMany({
      where: { userProfileId: hackathonDemoProfile.id },
    });
    await tx.watchlistAlert.deleteMany({
      where: { userProfileId: hackathonDemoProfile.id },
    });
    await tx.recommendation.deleteMany({
      where: { userProfileId: hackathonDemoProfile.id },
    });

    if (recommendations.length > 0) {
      await tx.recommendation.createMany({
        data: recommendations.map((recommendation) => ({
          userProfileId: hackathonDemoProfile.id,
          category: recommendation.product.category,
          productModelId: recommendation.product.id,
          score: recommendation.score,
          priority: priorityForScore(recommendation.score),
          problemSolved: JSON.stringify(
            recommendationInput.profile.problems
              .filter((problem) => recommendation.product.solves.includes(problem))
              .slice(0, 4),
          ),
          explanation: recommendation.explanation.problemSolved,
        })),
      });
    }
  });

  await replaceDevInventoryItems(
    hackathonDemoInventoryRecords.map((item) => ({
      ...item,
      brand: item.brand ?? "Unknown",
      catalogProductId: null,
      specsJson: null,
    })),
  );

  revalidateAdminPaths();
  redirect(buildToastHref("/admin", "demo_profile_ready"));
}

export async function runAdminPriceRefreshAction(): Promise<void> {
  const providerName = getPricesApiProviderName();
  const snapshot = await getPricesApiUsageSnapshot(providerName);
  const hasCapacity = snapshot.monthlyRemaining > 0 && snapshot.dailyRemaining > 0 && snapshot.minuteRemaining > 0;

  if (!hasCapacity) {
    redirect(buildToastHref("/admin", "price_refresh_quota_blocked"));
  }

  try {
    const lowDailyQuota = snapshot.dailyRemaining < 10;
    await refreshPrices();
    revalidateAdminPaths();
    redirect(buildToastHref("/admin", lowDailyQuota ? "price_refresh_low_quota" : "price_refresh_completed"));
  } catch (error) {
    await recordBackgroundJobError({
      jobName: "refreshPrices",
      message: error instanceof Error ? error.message : "Unknown refresh failure",
    });
    throw error;
  }
}

export async function testGemmaExplanationAction(): Promise<void> {
  const availabilityByProductId = await getCachedAvailabilitySummaries(productCatalog);
  const recommendationInput = {
    ...buildHackathonDemoRecommendationInput(),
    availabilityByProductId,
  };
  const categoryRecommendations = getCategoryRecommendations(recommendationInput);
  const productRecommendation = rankProductsForInput(recommendationInput)[0];

  if (!productRecommendation) {
    redirect(buildToastHref("/admin", "gemma_explanation_fallback", "info"));
  }

  const categoryRecommendation =
    categoryRecommendations.find((entry) => entry.category === productRecommendation.product.category) ?? {
      category: productRecommendation.product.category,
      score: productRecommendation.score,
      reasons: productRecommendation.reasons,
    };

  const result = await narrateRecommendation(
    {
      profile: recommendationInput.profile,
      inventory: recommendationInput.inventory,
      exactCurrentModelsProvided: recommendationInput.exactCurrentModelsProvided,
      categoryRecommendation,
      productRecommendation,
      availability: availabilityByProductId[productRecommendation.product.id],
    },
    {
      cache: {
        recommendationId: buildRecommendationNarrationId(recommendationInput.profile.id, categoryRecommendation.category),
      },
    },
  );

  revalidatePath("/admin");
  redirect(
    buildToastHref(
      "/admin",
      result.source === "gemma" ? "gemma_explanation_ready" : "gemma_explanation_fallback",
      result.source === "gemma" ? "success" : "info",
    ),
  );
}

export async function clearAdminDemoDataAction(): Promise<void> {
  await db.$transaction([
    db.watchlistAlert.deleteMany({
      where: { userProfileId: hackathonDemoProfile.id },
    }),
    db.savedProduct.deleteMany({
      where: { userProfileId: hackathonDemoProfile.id },
    }),
    db.recommendation.deleteMany({
      where: { userProfileId: hackathonDemoProfile.id },
    }),
    db.userProfile.deleteMany({
      where: { id: hackathonDemoProfile.id },
    }),
  ]);
  await deleteDevInventoryItems();

  revalidateAdminPaths();
  redirect(buildToastHref("/admin", "profile_deleted"));
}
