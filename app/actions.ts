"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCachedAvailabilitySummaries } from "@/lib/availability";
import { productCatalog } from "@/data/productCatalog";
import {
  buildHackathonDemoRecommendationInput,
  hackathonDemoInventoryRecords,
  hackathonDemoProfile,
  serializeHackathonDemoProfile,
} from "@/lib/recommendation/demoMode";
import { rankProductsForInput } from "@/lib/recommendation/productEngine";
import { buildToastHref } from "@/lib/ui/toasts";

const DEMO_WATCHED_PRODUCT_ID = "stand-nexstand-k2";
const DEMO_WATCHED_PRODUCT_TARGET_CENTS = 2500;
const DEMO_WATCHED_PRODUCT_OLD_PRICE_CENTS = 4499;

function priorityForScore(score: number): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 80) return "CRITICAL";
  if (score >= 65) return "HIGH";
  if (score >= 45) return "MEDIUM";
  return "LOW";
}

export async function runLaptopOnlyStudentDemoAction(): Promise<void> {
  const profileData = serializeHackathonDemoProfile();
  const availabilityByProductId = await getCachedAvailabilitySummaries(productCatalog);
  const recommendationInput = {
    ...buildHackathonDemoRecommendationInput(),
    availabilityByProductId,
  };
  const recommendations = rankProductsForInput(recommendationInput).slice(0, 8);
  const watchedRecommendation =
    recommendations.find((recommendation) => recommendation.product.id === DEMO_WATCHED_PRODUCT_ID) ??
    recommendations.find((recommendation) => recommendation.product.category === "laptop_stand") ??
    recommendations[0];
  const watchedProduct = productCatalog.find((product) => product.id === watchedRecommendation?.product.id);

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
    await tx.inventoryItem.deleteMany({
      where: { userProfileId: hackathonDemoProfile.id },
    });
    await tx.recommendation.deleteMany({
      where: { userProfileId: hackathonDemoProfile.id },
    });

    await tx.inventoryItem.createMany({
      data: hackathonDemoInventoryRecords.map((item) => ({
        ...item,
        userProfileId: hackathonDemoProfile.id,
      })),
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

    if (watchedRecommendation && watchedProduct) {
      await tx.savedProduct.create({
        data: {
          userProfileId: hackathonDemoProfile.id,
          productModelId: watchedRecommendation.product.id,
          targetPriceCents: DEMO_WATCHED_PRODUCT_TARGET_CENTS,
          notifyThreshold: 80,
        },
      });

      await tx.availabilitySnapshot.deleteMany({
        where: {
          productModelId: watchedRecommendation.product.id,
          provider: "mock",
        },
      });
      await tx.availabilitySnapshot.create({
        data: {
          productModelId: watchedRecommendation.product.id,
          provider: "mock",
          title: `${watchedProduct.name} older demo listing`,
          brand: watchedProduct.brand,
          model: watchedProduct.model,
          retailer: "Mock Marketplace",
          available: true,
          priceCents: DEMO_WATCHED_PRODUCT_OLD_PRICE_CENTS,
          totalPriceCents: DEMO_WATCHED_PRODUCT_OLD_PRICE_CENTS,
          url: `https://mock-marketplace.example/listings/${watchedRecommendation.product.id}-demo-old`,
          condition: "new",
          confidence: 88,
          checkedAt: new Date(Date.now() - 1000 * 60 * 60 * 14),
        },
      });
    }
  });

  revalidatePath("/");
  revalidatePath("/inventory");
  revalidatePath("/recommendations");
  revalidatePath("/alerts");
  revalidatePath("/admin/api-usage");
  redirect(buildToastHref("/recommendations", "recommendations_ready"));
}
