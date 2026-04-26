"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCachedAvailabilitySummaries } from "@/lib/availability";
import { maybeAutoRefreshTopRecommendationPrice } from "@/lib/availability/autoRefresh";
import { loadCachedRecommendationPriceSnapshots } from "@/lib/availability/priceSnapshots";
import { db } from "@/lib/db";
import { getCurrentUserContext, type CurrentUserContext } from "@/lib/currentUser";
import { deviceToInventorySpecs } from "@/lib/devices/deviceInventorySpecs";
import { findMongoDeviceById } from "@/lib/devices/mongoDeviceCatalog";
import { DEVICE_CATEGORIES } from "@/lib/devices/deviceTypes";
import {
  createDevInventoryItem,
  deleteDevInventoryItem,
  type MongoInventoryCreateInput,
  replaceDevInventoryItems,
  updateDevInventoryItem,
  validateInventoryCreateInput,
} from "@/lib/inventory/mongoInventory";
import { loadMongoRecommendationProducts, recommendationProductToAvailabilityModel } from "@/lib/recommendation/mongoDeviceProducts";
import { rankProductsForInput } from "@/lib/recommendation/productEngine";
import { saveRecommendationRunLog } from "@/lib/recommendation/recommendationLogs";
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

function getRequiredString(formData: FormData, key: string): string {
  return getStringValue(formData, key);
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

export interface InventoryFormActionState {
  error: string | null;
  fieldErrors: Record<string, string>;
}

function validationState(fieldErrors: Record<string, string>): InventoryFormActionState {
  return {
    error: "Please fix the highlighted inventory fields.",
    fieldErrors,
  };
}

async function getCatalogImport(formData: FormData): Promise<{
  catalogProductId: string | null;
  specs: Record<string, unknown> | null;
  error?: string;
}> {
  const catalogProductId = getNullableString(formData, "catalogProductId");
  const catalogDevice = await findMongoDeviceById(catalogProductId);

  if (catalogDevice) {
    return {
      catalogProductId: catalogDevice._id,
      specs: deviceToInventorySpecs(catalogDevice),
    };
  }

  const postedSpecsJson = getStringValue(formData, "specsJson");
  if (postedSpecsJson) {
    try {
      const parsed = JSON.parse(postedSpecsJson) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return {
          catalogProductId,
          specs: parsed as Record<string, unknown>,
        };
      }
    } catch {
      return {
        catalogProductId,
        specs: null,
        error: "Specs must be valid JSON.",
      };
    }

    return {
      catalogProductId,
      specs: null,
      error: "Specs must be valid JSON.",
    };
  }

  return {
    catalogProductId: null,
    specs: null,
  };
}

function getConditionValue(formData: FormData): MongoInventoryCreateInput["condition"] {
  const value = getStringValue(formData, "condition").toUpperCase();
  return allowedConditions.has(value) ? (value as MongoInventoryCreateInput["condition"]) : "UNKNOWN";
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

async function parseInventoryFormInput(formData: FormData): Promise<{
  data: MongoInventoryCreateInput | null;
  state: InventoryFormActionState | null;
}> {
  const catalogImport = await getCatalogImport(formData);
  if (catalogImport.error) {
    return {
      data: null,
      state: validationState({ specsJson: catalogImport.error }),
    };
  }

  const result = validateInventoryCreateInput({
    category: getCategoryValue(formData),
    brand: getRequiredString(formData, "brand"),
    model: getRequiredString(formData, "model"),
    exactModel: getNullableString(formData, "exactModel"),
    catalogProductId: catalogImport.catalogProductId,
    specs: catalogImport.specs,
    condition: getConditionValue(formData),
    ageYears: getAgeValue(formData),
    notes: getNullableString(formData, "notes"),
    source: "MANUAL",
  });

  if (!result.data) {
    return {
      data: null,
      state: validationState(result.errors),
    };
  }

  return {
    data: result.data,
    state: null,
  };
}

export async function addInventoryItemAction(
  _previousState: InventoryFormActionState,
  formData: FormData,
): Promise<InventoryFormActionState> {
  await requireCurrentUserContext();
  const parsed = await parseInventoryFormInput(formData);
  if (!parsed.data) {
    return parsed.state ?? { error: null, fieldErrors: {} };
  }

  await createDevInventoryItem(parsed.data);

  revalidateInventoryViews();
  redirect(buildToastHref("/inventory", "item_added"));
}

export async function updateInventoryItemAction(
  _previousState: InventoryFormActionState,
  formData: FormData,
): Promise<InventoryFormActionState> {
  await requireCurrentUserContext();
  const itemId = getStringValue(formData, "itemId");

  if (!itemId) {
    return {
      error: "Inventory item id is missing.",
      fieldErrors: {},
    };
  }

  const parsed = await parseInventoryFormInput(formData);
  if (!parsed.data) {
    return parsed.state ?? { error: null, fieldErrors: {} };
  }

  await updateDevInventoryItem(itemId, parsed.data);

  revalidateInventoryViews();
  redirect(buildToastHref("/inventory", "item_updated"));
}

export async function deleteInventoryItemAction(formData: FormData): Promise<void> {
  await requireCurrentUserContext();
  const itemId = getStringValue(formData, "itemId");

  if (!itemId) return;

  await deleteDevInventoryItem(itemId);

  revalidateInventoryViews();
  redirect(buildToastHref("/inventory", "item_deleted"));
}

export async function loadDemoInventoryAction(): Promise<void> {
  const { profileRecord } = await requireCurrentUserContext();

  await Promise.all([
    db.recommendation.deleteMany({
      where: { userProfileId: profileRecord.id },
    }),
    replaceDevInventoryItems([
      {
        category: "laptop",
        brand: "Apple",
        model: "MacBook Air M1",
        exactModel: "8GB RAM",
        catalogProductId: null,
        specsJson: null,
        condition: "GOOD",
        ageYears: 4,
        notes: "Main computer. Solid battery life, but the single laptop screen slows multitasking.",
        source: "DEMO",
      },
      {
        category: "mouse",
        brand: "Generic",
        model: "Basic mouse",
        exactModel: null,
        catalogProductId: null,
        specsJson: null,
        condition: "FAIR",
        ageYears: 2,
        notes: "Cheap plastic mouse. Fine for basics, but not very comfortable for long sessions.",
        source: "DEMO",
      },
      {
        category: "chair",
        brand: "Generic",
        model: "Cheap chair",
        exactModel: null,
        catalogProductId: null,
        specsJson: null,
        condition: "POOR",
        ageYears: 5,
        notes: "Minimal support and noticeable back discomfort by the afternoon.",
        source: "DEMO",
      },
      {
        category: "desk_lamp",
        brand: "Room",
        model: "Overhead room light only",
        exactModel: "No dedicated task lamp",
        catalogProductId: null,
        specsJson: null,
        condition: "POOR",
        ageYears: 3,
        notes: "Poor lighting at the desk with shadows during calls and late-night work.",
        source: "DEMO",
      },
    ]),
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
  const candidateProducts = await loadMongoRecommendationProducts();
  const availabilityProductModels = candidateProducts.map((product) =>
    recommendationProductToAvailabilityModel(product, { allowUsed: context.profileRecord.usedItemsOkay }),
  );
  const availabilityModelsByProductId = new Map(availabilityProductModels.map((productModel) => [productModel.id, productModel]));
  let [availabilityByProductId, pricingByProductId] = await Promise.all([
    getCachedAvailabilitySummaries(availabilityProductModels),
    loadCachedRecommendationPriceSnapshots(availabilityProductModels),
  ]);
  const recommendationInput = {
    ...context.recommendationInput,
    candidateProducts,
    availabilityByProductId,
    pricingByProductId,
  };
  let recommendations = rankProductsForInput(recommendationInput).slice(0, 8);
  const refreshedTopPrice = await maybeAutoRefreshTopRecommendationPrice({
    productModel: availabilityModelsByProductId.get(recommendations[0]?.product.id ?? ""),
    availabilityByProductId,
    userId: context.userId,
  });

  if (refreshedTopPrice) {
    availabilityByProductId = {
      ...availabilityByProductId,
      [refreshedTopPrice.productModelId]: refreshedTopPrice.availabilitySummary,
    };
    pricingByProductId = refreshedTopPrice.priceSnapshot
      ? {
          ...pricingByProductId,
          [refreshedTopPrice.productModelId]: refreshedTopPrice.priceSnapshot,
        }
      : pricingByProductId;
    recommendations = rankProductsForInput({
      ...recommendationInput,
      availabilityByProductId,
      pricingByProductId,
    }).slice(0, 8);
  }

  await saveRecommendationRunLog({
    userId: context.userId,
    inventory: context.recommendationInput.inventory,
    recommendations,
    allowRecommendationHistory: context.allowRecommendationHistory,
    privateTextRedactions: [
      context.profile.ageRange,
      context.profile.profession,
      context.recommendationInput.privateProfile?.profession,
    ].filter((value): value is string => Boolean(value?.trim())),
  });

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
