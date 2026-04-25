"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { productCatalog } from "@/data/productCatalog";
import { db } from "@/lib/db";
import { buildRecommendationNarrationId } from "@/lib/llm/explanationCache";
import { narrateRecommendation } from "@/lib/llm/recommendationNarrator";
import { getCategoryRecommendations } from "@/lib/recommendation/categoryEngine";
import { getProductRecommendations } from "@/lib/recommendation/productEngine";
import { getAvailabilityForProduct, loadRecommendationContext, productIdAliases } from "@/lib/userData";
import { buildToastHref } from "@/lib/ui/toasts";

export async function toggleSavedProduct(formData: FormData): Promise<void> {
  const profileId = String(formData.get("profileId") ?? "").trim();
  const productId = String(formData.get("productId") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "/recommendations").trim() || "/recommendations";

  if (!profileId || !productId) return;

  const aliases = productIdAliases(productId);
  const existing = await db.savedProduct.findFirst({
    where: {
      userProfileId: profileId,
      productModelId: { in: aliases },
    },
  });

  if (existing) {
    await db.savedProduct.deleteMany({
      where: {
        userProfileId: profileId,
        productModelId: { in: aliases },
      },
    });
    revalidatePath("/recommendations");
    redirect(buildToastHref(returnTo, "product_unsaved"));
  } else {
    await db.savedProduct.create({
      data: {
        userProfileId: profileId,
        productModelId: productId,
      },
    });
    revalidatePath("/recommendations");
    redirect(buildToastHref(returnTo, "product_saved"));
  }
}

export async function refreshRecommendationExplanation(formData: FormData): Promise<void> {
  const productId = String(formData.get("productId") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "/recommendations").trim() || "/recommendations";

  if (!productId) {
    redirect(buildToastHref(returnTo, "gemma_explanation_fallback", "info"));
  }

  const context = await loadRecommendationContext();
  if (!context) {
    redirect(buildToastHref(returnTo, "gemma_explanation_fallback", "info"));
  }

  const recommendationInput = {
    profile: context.profile,
    inventory: context.inventory,
    exactCurrentModelsProvided: context.exactCurrentModelsProvided,
    ports: context.ports,
    deviceType: context.deviceType,
    usedItemsOkay: context.usedItemsOkay,
    availabilityByProductId: context.availabilityByProductId,
  };
  const product = productCatalog.find((candidate) => candidate.id === productId);
  const categoryRecommendation = getCategoryRecommendations(recommendationInput).find(
    (candidate) => candidate.category === product?.category,
  );

  if (!product || !categoryRecommendation) {
    redirect(buildToastHref(returnTo, "gemma_explanation_fallback", "info"));
  }

  const productRecommendation = getProductRecommendations(
    recommendationInput,
    categoryRecommendation,
    productCatalog,
  ).find((candidate) => candidate.product.id === productId);

  if (!productRecommendation) {
    redirect(buildToastHref(returnTo, "gemma_explanation_fallback", "info"));
  }

  const result = await narrateRecommendation(
    {
      profile: context.profile,
      inventory: context.inventory,
      exactCurrentModelsProvided: context.exactCurrentModelsProvided,
      categoryRecommendation,
      productRecommendation,
      availability: getAvailabilityForProduct(context.availabilityByProductId, productRecommendation.product.id),
    },
    {
      cache: {
        recommendationId: buildRecommendationNarrationId(context.profileId, categoryRecommendation.category),
      },
    },
  );

  revalidatePath("/");
  revalidatePath("/recommendations");
  revalidatePath("/admin");
  redirect(
    buildToastHref(
      returnTo,
      result.source === "gemma" ? "gemma_explanation_ready" : "gemma_explanation_fallback",
      result.source === "gemma" ? "success" : "info",
    ),
  );
}
