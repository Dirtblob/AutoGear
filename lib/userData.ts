import { getCachedAvailabilitySummaries, type AvailabilityProductModel, type AvailabilitySummary } from "@/lib/availability";
import { productCatalog } from "@/data/productCatalog";
import { db } from "@/lib/db";
import { parseProfileMetadata } from "@/lib/profileMetadata";
import {
  normalizeInventoryCategories,
  normalizeRoomConstraints,
  normalizeUserPreferences,
  normalizeUserProblems,
  type InventoryItem,
  type UserProblem,
  type UserProfile,
} from "@/lib/recommendation/types";

interface LoadedRecommendationContext {
  profileId: string;
  profile: UserProfile;
  inventory: InventoryItem[];
  savedProductIds: Set<string>;
  demoScenarioId: string | null;
  usedItemsOkay: boolean;
  exactCurrentModelsProvided: boolean;
  ports: string[];
  deviceType: "desktop" | "laptop" | "tablet" | "unknown";
  availabilityByProductId: Map<string, AvailabilitySummary>;
}

type RecommendationContextProfileRecord = NonNullable<
  Awaited<
    ReturnType<
      typeof db.userProfile.findFirst<{
        include: { inventoryItems: true; savedProducts: true };
      }>
    >
  >
>;

const productIdAliasMap: Record<string, string> = {
  "desk_lamp-benq-screenbar": "lamp-benq-screenbar",
};

const inventoryProblemMatchers: Array<[UserProblem, RegExp]> = [
  ["eye_strain", /\beye|glare|screen fatigue|fatigue\b/i],
  ["neck_pain", /\bneck|hunch|posture\b/i],
  ["wrist_pain", /\bwrist|trackpad|typing strain|ergonomic\b/i],
  ["back_pain", /\bback|lumbar|chair\b/i],
  ["low_productivity", /\bslow|muffled|call|productiv|friction\b/i],
  ["poor_focus", /\bfocus|distract|noise|clutter\b/i],
  ["noise_sensitivity", /\bnoise|loud|shared\b/i],
  ["clutter", /\bclutter|cable|mess\b/i],
  ["bad_lighting", /\blight|dim|dark\b/i],
];

const lightingValues = new Set(["low", "mixed", "bright"]);

function normalizeLighting(value: unknown): UserProfile["constraints"]["roomLighting"] {
  if (typeof value !== "string") return "mixed";
  const normalized = value.trim().toLowerCase();
  return lightingValues.has(normalized) ? (normalized as UserProfile["constraints"]["roomLighting"]) : "mixed";
}

function normalizeSpendingStyle(value: string): UserProfile["spendingStyle"] {
  const normalized = value.trim();
  if (normalized === "PREMIUM") return "premium";
  if (normalized === "FRUGAL") return "frugal";
  if (normalized === "VALUE") return "VALUE";
  if (normalized === "LEAN") return "lean";
  if (normalized === "BALANCED") return "balanced";
  return normalized.length > 0 ? (normalized as UserProfile["spendingStyle"]) : "balanced";
}

function parseSpecs(value: string | null): Record<string, unknown> | undefined {
  if (!value) return undefined;

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function canonicalizeProductId(productId: string): string {
  return productIdAliasMap[productId] ?? productId;
}

function inferPainPoints(text: string): UserProblem[] {
  return inventoryProblemMatchers
    .filter(([, matcher]) => matcher.test(text))
    .map(([problem]) => problem);
}

function mapInventoryCondition(value: string): InventoryItem["condition"] {
  const normalized = value.trim().toLowerCase();
  if (normalized === "poor" || normalized === "fair" || normalized === "good" || normalized === "excellent") {
    return normalized;
  }
  return "unknown";
}

function mapInventoryItem(
  item: {
    id: string;
    category: string;
    brand: string | null;
    model: string | null;
    exactModel: string | null;
    specsJson: string | null;
    condition: string;
    notes: string | null;
  },
): InventoryItem {
  const category = normalizeInventoryCategories(item.category)[0] ?? "unknown";
  const name =
    item.exactModel?.trim() ||
    [item.brand, item.model]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(" ")
      .trim() ||
    category.replaceAll("_", " ");
  const notesText = `${item.exactModel ?? ""} ${item.model ?? ""} ${item.notes ?? ""}`.trim();

  return {
    id: item.id,
    name,
    category,
    condition: mapInventoryCondition(item.condition),
    painPoints: inferPainPoints(notesText),
    specs: parseSpecs(item.specsJson),
  };
}

function buildCheckingSummary(productModelId: string): AvailabilitySummary {
  return {
    provider: null,
    productModelId,
    status: "checking_not_configured",
    label: "Checking not configured",
    listings: [],
    bestListing: null,
    checkedAt: null,
    refreshSource: "not_configured",
  };
}

async function loadRecommendationContextForProfile(
  activeProfile: RecommendationContextProfileRecord | null,
): Promise<LoadedRecommendationContext | null> {
  if (!activeProfile) return null;

  const metadata = parseProfileMetadata(activeProfile.roomConstraints);
  const rawConstraints = metadata.rawConstraints;
  const inventory = activeProfile.inventoryItems.map(mapInventoryItem);
  const profile: UserProfile = {
    id: activeProfile.id,
    name: activeProfile.name?.trim() || "User",
    ageRange: activeProfile.ageRange?.trim() || "Unknown",
    profession: activeProfile.profession,
    budgetUsd: Math.round(activeProfile.budgetCents / 100),
    spendingStyle: normalizeSpendingStyle(activeProfile.spendingStyle),
    preferences: normalizeUserPreferences(activeProfile.preferences),
    problems: normalizeUserProblems(activeProfile.problems),
    accessibilityNeeds: normalizeUserPreferences(activeProfile.accessibilityNeeds),
    roomConstraints: normalizeRoomConstraints(activeProfile.roomConstraints),
    constraints: {
      deskWidthInches: Number(rawConstraints.deskWidthInches) || 36,
      roomLighting: normalizeLighting(rawConstraints.roomLighting),
      sharesSpace: rawConstraints.sharesSpace === true,
      portableSetup: rawConstraints.portableSetup === true,
    },
  };

  const savedProductIds = new Set(activeProfile.savedProducts.map((item) => canonicalizeProductId(item.productModelId)));
  const availabilityProductModels: AvailabilityProductModel[] = productCatalog.map((product) => ({
    id: product.id,
    brand: product.brand,
    model: "model" in product && typeof product.model === "string" ? product.model : undefined,
    displayName: product.name,
    category: product.category,
    estimatedPriceCents: product.priceUsd * 100,
    gtin: "gtin" in product && typeof product.gtin === "string" ? product.gtin : undefined,
    upc: "upc" in product && typeof product.upc === "string" ? product.upc : undefined,
    searchQueries: "searchQueries" in product && Array.isArray(product.searchQueries) ? product.searchQueries : undefined,
    allowUsed: activeProfile.usedItemsOkay,
  }));
  const seededAvailability = await getCachedAvailabilitySummaries(availabilityProductModels);
  const availabilityByProductId = new Map<string, AvailabilitySummary>(
    Object.entries(seededAvailability).map(([productId, summary]) => [canonicalizeProductId(productId), summary]),
  );

  for (const productId of savedProductIds) {
    if (!availabilityByProductId.has(productId)) {
      availabilityByProductId.set(productId, buildCheckingSummary(productId));
    }
  }

  return {
    profileId: activeProfile.id,
    profile,
    inventory,
    savedProductIds,
    demoScenarioId: metadata.demoScenarioId,
    usedItemsOkay: activeProfile.usedItemsOkay,
    exactCurrentModelsProvided: activeProfile.inventoryItems.some((item) => Boolean(item.exactModel?.trim())),
    ports: metadata.ports,
    deviceType: metadata.deviceType,
    availabilityByProductId,
  };
}

export async function loadRecommendationContext(): Promise<LoadedRecommendationContext | null> {
  const activeProfile =
    (await db.userProfile.findUnique({
      where: { id: "demo-profile" },
      include: { inventoryItems: true, savedProducts: true },
    })) ??
    (await db.userProfile.findFirst({
      include: { inventoryItems: true, savedProducts: true },
      orderBy: { createdAt: "desc" },
    }));

  return loadRecommendationContextForProfile(activeProfile);
}

export async function loadLatestRecommendationContext(): Promise<LoadedRecommendationContext | null> {
  const activeProfile = await db.userProfile.findFirst({
    include: { inventoryItems: true, savedProducts: true },
    orderBy: { createdAt: "desc" },
  });

  return loadRecommendationContextForProfile(activeProfile);
}

export function productIdAliases(productId: string): string[] {
  const canonical = canonicalizeProductId(productId);
  return Array.from(new Set([productId, canonical, ...Object.keys(productIdAliasMap).filter((key) => productIdAliasMap[key] === canonical)]));
}

export function getAvailabilityForProduct(
  availabilityByProductId: Map<string, AvailabilitySummary>,
  productId: string,
): AvailabilitySummary {
  return availabilityByProductId.get(canonicalizeProductId(productId)) ?? buildCheckingSummary(productId);
}
