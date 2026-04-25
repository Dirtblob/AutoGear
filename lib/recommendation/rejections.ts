import { productCatalog } from "../../data/productCatalog";
import { getCategoryRecommendations } from "./categoryEngine";
import { getProductRecommendations } from "./productEngine";
import { categoryLabels } from "./scoring";
import type { ProductCategory, RecommendationInput, UserProfile } from "./types";

export interface RecommendationRejection {
  id: string;
  kind: "category" | "model";
  item: string;
  category: ProductCategory;
  reason: string;
  wouldRecommendIf: string;
}

interface RecommendationRejectionOptions {
  maxItems?: number;
  recommendedCategoryIds?: Set<ProductCategory>;
  recommendedProductIds?: Set<string>;
}

const defaultWouldRecommendIf: Record<ProductCategory, string> = {
  laptop: "You report build times, memory pressure, or apps freezing.",
  monitor: "Screen space becomes a bigger priority, desk fit is confirmed, or budget increases.",
  laptop_stand: "Neck or posture pain becomes a recurring issue and you still work from a laptop.",
  keyboard: "Typing discomfort becomes more important or you want a quieter or more ergonomic layout.",
  mouse: "Pointing-device discomfort becomes more obvious during long sessions.",
  chair: "Back pain becomes a primary complaint or budget opens up for a larger ergonomic purchase.",
  desk_lamp: "Lighting becomes a bigger daily problem, especially for evening work or eye strain.",
  headphones: "Shared-space distractions or noise sensitivity become a bigger issue.",
  webcam: "Video calls become a daily priority or the built-in camera becomes a real pain point.",
  storage: "Desk clutter starts reducing usable space or hurting focus.",
  cable_management: "Cable clutter starts interfering with desk space, charging, or concentration.",
};

function budgetIsTight(profile: UserProfile): boolean {
  return (
    profile.problems.includes("budget_limited") ||
    profile.budgetUsd <= 400 ||
    ["lean", "frugal", "value", "FRUGAL", "VALUE"].includes(profile.spendingStyle)
  );
}

function quietRequested(profile: UserProfile): boolean {
  return (
    profile.problems.includes("noise_sensitivity") ||
    profile.roomConstraints?.includes("needs_quiet") === true ||
    [...profile.preferences, ...profile.accessibilityNeeds].some((value) =>
      value.toLowerCase().includes("quiet"),
    )
  );
}

function hasComputePain(profile: UserProfile): boolean {
  return profile.problems.includes("slow_computer");
}

function hasErgonomicBottleneck(profile: UserProfile): boolean {
  return (
    (profile.problems.includes("neck_pain") || profile.problems.includes("eye_strain")) &&
    !hasComputePain(profile)
  );
}

function hasSmallDesk(profile: UserProfile): boolean {
  return (
    profile.problems.includes("small_space") ||
    profile.roomConstraints?.includes("small_space") === true ||
    profile.roomConstraints?.includes("limited_desk_width") === true ||
    profile.constraints.deskWidthInches <= 36
  );
}

function pushUnique(
  rejections: RecommendationRejection[],
  seen: Set<string>,
  rejection: RecommendationRejection | null,
): void {
  if (!rejection || seen.has(rejection.id)) return;
  seen.add(rejection.id);
  rejections.push(rejection);
}

function buildLaptopRejection(
  input: RecommendationInput,
  recommendedCategoryIds: Set<ProductCategory>,
): RecommendationRejection | null {
  if (recommendedCategoryIds.has("laptop") || hasComputePain(input.profile) || !hasErgonomicBottleneck(input.profile)) {
    return null;
  }

  return {
    id: "rejection-category-laptop",
    kind: "category",
    item: "New laptop",
    category: "laptop",
    reason: "Your current bottleneck appears to be screen space and ergonomics, not compute performance.",
    wouldRecommendIf: "You report build times, memory pressure, or apps freezing.",
  };
}

function buildStudioDisplayRejection(
  input: RecommendationInput,
  recommendedProductIds: Set<string>,
): RecommendationRejection | null {
  if (recommendedProductIds.has("monitor-apple-studio-display")) return null;
  if (!budgetIsTight(input.profile) && input.profile.budgetUsd >= 1000) return null;

  return {
    id: "rejection-model-apple-studio-display",
    kind: "model",
    item: "Apple Studio Display",
    category: "monitor",
    reason: `Excellent quality but poor fit for your $${input.profile.budgetUsd} budget.`,
    wouldRecommendIf: "Budget increases above $1000 or premium display quality becomes a priority.",
  };
}

function buildMechanicalKeyboardRejection(
  input: RecommendationInput,
  recommendedProductIds: Set<string>,
): RecommendationRejection | null {
  const mechanicalKeyboard = productCatalog.find((product) => product.id === "keyboard-keychron-k-series");
  if (!mechanicalKeyboard || recommendedProductIds.has(mechanicalKeyboard.id) || !quietRequested(input.profile)) {
    return null;
  }

  const reason = input.profile.problems.includes("noise_sensitivity")
    ? "You reported noise sensitivity, so loud keyboards are deprioritized."
    : "You asked for quiet products, so louder mechanical keyboards are deprioritized.";

  return {
    id: "rejection-model-mechanical-keyboard",
    kind: "model",
    item: "Mechanical keyboard",
    category: "keyboard",
    reason,
    wouldRecommendIf: "You choose quiet switches or remove noise sensitivity.",
  };
}

function buildChairRejection(
  input: RecommendationInput,
  recommendedCategoryIds: Set<ProductCategory>,
): RecommendationRejection | null {
  if (recommendedCategoryIds.has("chair")) return null;
  if (!budgetIsTight(input.profile) && !hasSmallDesk(input.profile)) return null;

  return {
    id: "rejection-category-chair",
    kind: "category",
    item: "New chair",
    category: "chair",
    reason:
      "A chair upgrade could help later, but this budget goes farther on screen height, screen space, and lighting first.",
    wouldRecommendIf: "Back pain becomes a primary complaint or budget opens up for a larger ergonomic purchase.",
  };
}

function genericCategoryReason(category: ProductCategory, profile: UserProfile): string {
  if (category === "webcam") {
    return "The current profile is more constrained by posture, lighting, and desk ergonomics than camera quality.";
  }

  if (category === "headphones") {
    return "Noise control looks less urgent than the higher-ranked ergonomic and visual fixes.";
  }

  if (category === "storage" || category === "cable_management") {
    return "Useful cleanup upgrade, but it solves less immediate pain than the items ranked above it.";
  }

  if (category === "keyboard") {
    return "Keyboard upgrades help, but your biggest bottlenecks right now are screen height, screen space, and overall ergonomics.";
  }

  if (category === "monitor" && hasSmallDesk(profile)) {
    return "A larger display helps, but desk fit keeps the bigger options from being an easy yes.";
  }

  return "This is a valid upgrade area, but it solves fewer urgent pain points than the current top recommendations.";
}

function buildFallbackCategoryRejections(
  input: RecommendationInput,
  recommendedCategoryIds: Set<ProductCategory>,
  maxItems: number,
  existingIds: Set<string>,
): RecommendationRejection[] {
  const categories = getCategoryRecommendations(input);
  const fallback = categories
    .filter((category) => !recommendedCategoryIds.has(category.category))
    .filter((category) => !existingIds.has(`rejection-category-${category.category}`))
    .map((category) => ({
      id: `rejection-category-${category.category}`,
      kind: "category" as const,
      item: categoryLabels[category.category],
      category: category.category,
      reason: genericCategoryReason(category.category, input.profile),
      wouldRecommendIf: defaultWouldRecommendIf[category.category],
      score: category.score,
    }))
    .sort((left, right) => left.score - right.score || left.item.localeCompare(right.item))
    .slice(0, maxItems);

  return fallback.map((rejection) => ({
    id: rejection.id,
    kind: rejection.kind,
    item: rejection.item,
    category: rejection.category,
    reason: rejection.reason,
    wouldRecommendIf: rejection.wouldRecommendIf,
  }));
}

function deriveDefaultRecommendedSets(
  input: RecommendationInput,
): { recommendedCategoryIds: Set<ProductCategory>; recommendedProductIds: Set<string> } {
  const categories = getCategoryRecommendations(input).slice(0, 4);
  const recommendedCategoryIds = new Set(categories.map((category) => category.category));
  const recommendedProductIds = new Set<string>();

  for (const category of categories) {
    const topProduct = getProductRecommendations(input, category, productCatalog)[0];
    if (topProduct) recommendedProductIds.add(topProduct.product.id);
  }

  return { recommendedCategoryIds, recommendedProductIds };
}

export function buildRecommendationRejections(
  input: RecommendationInput,
  options?: RecommendationRejectionOptions,
): RecommendationRejection[] {
  const maxItems = options?.maxItems ?? 4;
  const derived = deriveDefaultRecommendedSets(input);
  const recommendedCategoryIds = options?.recommendedCategoryIds ?? derived.recommendedCategoryIds;
  const recommendedProductIds = options?.recommendedProductIds ?? derived.recommendedProductIds;
  const rejections: RecommendationRejection[] = [];
  const seen = new Set<string>();

  pushUnique(rejections, seen, buildLaptopRejection(input, recommendedCategoryIds));
  pushUnique(rejections, seen, buildStudioDisplayRejection(input, recommendedProductIds));
  pushUnique(rejections, seen, buildMechanicalKeyboardRejection(input, recommendedProductIds));
  pushUnique(rejections, seen, buildChairRejection(input, recommendedCategoryIds));

  for (const fallback of buildFallbackCategoryRejections(
    input,
    recommendedCategoryIds,
    Math.max(0, maxItems - rejections.length),
    seen,
  )) {
    pushUnique(rejections, seen, fallback);
  }

  return rejections.slice(0, maxItems);
}
