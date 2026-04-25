"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCachedAvailabilitySummaries } from "@/lib/availability";
import { productCatalog } from "@/data/productCatalog";
import { db } from "@/lib/db";
import { getCurrentUserContext, type CurrentUserContext } from "@/lib/currentUser";
import { deviceToInventorySpecs, findDeviceById } from "@/lib/devices/deviceCatalog";
import { DEVICE_CATEGORIES } from "@/lib/devices/deviceTypes";
import { rankProductsForInput } from "@/lib/recommendation/productEngine";
import { buildToastHref } from "@/lib/ui/toasts";

const allowedConditions = new Set(["POOR", "FAIR", "GOOD", "EXCELLENT", "UNKNOWN"]);
const allowedCategories = new Set([...DEVICE_CATEGORIES, "storage", "cable_management", "other", "unknown"]);

function getStringValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getNullableString(formData: FormData, key: string): string | null {
  const value = getStringValue(formData, key);
  return value.length > 0 ? value : null;
}

function getAgeValue(formData: FormData): number | null {
  const rawValue = getStringValue(formData, "ageYears");
  if (!rawValue) return null;

  const parsed = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsed) || parsed < 0) return null;

  return parsed;
}

function getCategoryValue(formData: FormData): string {
  const value = getStringValue(formData, "category").toLowerCase().replaceAll("-", "_");
  return allowedCategories.has(value) ? value : "other";
}

function getCatalogImport(formData: FormData): { catalogProductId: string | null; specsJson: string | null } {
  const catalogProductId = getNullableString(formData, "catalogProductId");
  const catalogDevice = findDeviceById(catalogProductId);

  if (catalogDevice) {
    return {
      catalogProductId: catalogDevice.id,
      specsJson: JSON.stringify(deviceToInventorySpecs(catalogDevice)),
    };
  }

  const postedSpecsJson = getStringValue(formData, "specsJson");
  if (postedSpecsJson) {
    try {
      const parsed = JSON.parse(postedSpecsJson) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return {
          catalogProductId,
          specsJson: postedSpecsJson,
        };
      }
    } catch {
      // Ignore malformed client snapshots and fall back to plain manual entry.
    }
  }

  return {
    catalogProductId: null,
    specsJson: null,
  };
}

function getConditionValue(formData: FormData): string {
  const value = getStringValue(formData, "condition").toUpperCase();
  return allowedConditions.has(value) ? value : "UNKNOWN";
}

function revalidateInventoryViews(): void {
  revalidatePath("/inventory");
  revalidatePath("/recommendations");
}

async function requireCurrentUserContext(): Promise<CurrentUserContext> {
  const context = await getCurrentUserContext();
  if (!context) {
    redirect(buildToastHref("/onboarding", "profile_required"));
  }

  return context;
}

export async function addInventoryItemAction(formData: FormData): Promise<void> {
  const { profileRecord } = await requireCurrentUserContext();
  const catalogImport = getCatalogImport(formData);

  await db.inventoryItem.create({
    data: {
      userProfileId: profileRecord.id,
      category: getCategoryValue(formData),
      brand: getNullableString(formData, "brand"),
      model: getNullableString(formData, "model"),
      exactModel: getNullableString(formData, "exactModel"),
      catalogProductId: catalogImport.catalogProductId,
      specsJson: catalogImport.specsJson,
      condition: getConditionValue(formData),
      ageYears: getAgeValue(formData),
      notes: getNullableString(formData, "notes"),
      source: "MANUAL",
    },
  });

  revalidateInventoryViews();
  redirect(buildToastHref("/inventory", "item_added"));
}

export async function updateInventoryItemAction(formData: FormData): Promise<void> {
  const { profileRecord } = await requireCurrentUserContext();
  const itemId = getStringValue(formData, "itemId");
  const catalogImport = getCatalogImport(formData);

  if (!itemId) return;

  await db.inventoryItem.updateMany({
    where: {
      id: itemId,
      userProfileId: profileRecord.id,
    },
    data: {
      category: getCategoryValue(formData),
      brand: getNullableString(formData, "brand"),
      model: getNullableString(formData, "model"),
      exactModel: getNullableString(formData, "exactModel"),
      catalogProductId: catalogImport.catalogProductId,
      specsJson: catalogImport.specsJson,
      condition: getConditionValue(formData),
      ageYears: getAgeValue(formData),
      notes: getNullableString(formData, "notes"),
      source: "MANUAL",
    },
  });

  revalidateInventoryViews();
  redirect(buildToastHref("/inventory", "item_updated"));
}

export async function deleteInventoryItemAction(formData: FormData): Promise<void> {
  const { profileRecord } = await requireCurrentUserContext();
  const itemId = getStringValue(formData, "itemId");

  if (!itemId) return;

  await db.inventoryItem.deleteMany({
    where: {
      id: itemId,
      userProfileId: profileRecord.id,
    },
  });

  revalidateInventoryViews();
  redirect(buildToastHref("/inventory", "item_deleted"));
}

export async function loadDemoInventoryAction(): Promise<void> {
  const { profileRecord } = await requireCurrentUserContext();

  await db.$transaction([
    db.inventoryItem.deleteMany({
      where: { userProfileId: profileRecord.id },
    }),
    db.inventoryItem.createMany({
      data: [
        {
          userProfileId: profileRecord.id,
          category: "laptop",
          brand: "Apple",
          model: "MacBook Air M1",
          exactModel: "8GB RAM",
          condition: "GOOD",
          ageYears: 4,
          notes: "Main computer. Solid battery life, but the single laptop screen slows multitasking.",
          source: "DEMO",
        },
        {
          userProfileId: profileRecord.id,
          category: "mouse",
          brand: "Generic",
          model: "Basic mouse",
          condition: "FAIR",
          ageYears: 2,
          notes: "Cheap plastic mouse. Fine for basics, but not very comfortable for long sessions.",
          source: "DEMO",
        },
        {
          userProfileId: profileRecord.id,
          category: "chair",
          brand: "Generic",
          model: "Cheap chair",
          condition: "POOR",
          ageYears: 5,
          notes: "Minimal support and noticeable back discomfort by the afternoon.",
          source: "DEMO",
        },
        {
          userProfileId: profileRecord.id,
          category: "desk_lamp",
          model: "Overhead room light only",
          exactModel: "No dedicated task lamp",
          condition: "POOR",
          ageYears: 3,
          notes: "Poor lighting at the desk with shadows during calls and late-night work.",
          source: "DEMO",
        },
      ],
    }),
  ]);

  revalidateInventoryViews();
  redirect(buildToastHref("/inventory", "demo_inventory_ready"));
}

function priorityForScore(score: number): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 80) return "CRITICAL";
  if (score >= 65) return "HIGH";
  if (score >= 45) return "MEDIUM";
  return "LOW";
}

export async function generateRecommendationsAction(): Promise<void> {
  const context = await requireCurrentUserContext();
  const availabilityByProductId = await getCachedAvailabilitySummaries(productCatalog);
  const recommendations = rankProductsForInput({
    ...context.recommendationInput,
    availabilityByProductId,
  }).slice(0, 8);

  await db.recommendation.deleteMany({
    where: { userProfileId: context.profileRecord.id },
  });

  if (recommendations.length > 0) {
    await db.recommendation.createMany({
      data: recommendations.map((recommendation) => ({
        userProfileId: context.profileRecord.id,
        category: recommendation.product.category,
        productModelId: recommendation.product.id,
        score: recommendation.score,
        priority: priorityForScore(recommendation.score),
        problemSolved: JSON.stringify(
          context.profile.problems.filter((problem) => recommendation.product.solves.includes(problem)).slice(0, 4),
        ),
        explanation: recommendation.explanation.problemSolved,
      })),
    });
  }

  revalidatePath("/recommendations");
  redirect(buildToastHref("/recommendations", "recommendations_ready"));
}
