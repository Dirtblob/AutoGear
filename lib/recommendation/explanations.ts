import type {
  CategoryScore,
  InventoryItem,
  Product,
  ProductCategory,
  RecommendationConfidence,
  RecommendationExplanation,
  UserProfile,
  UserProblem,
} from "./types";
import { categoryLabels } from "./scoring";

const problemLabels: Record<UserProblem, string> = {
  eye_strain: "eye strain",
  neck_pain: "neck pain",
  wrist_pain: "wrist pain",
  back_pain: "back pain",
  slow_computer: "slow computer",
  low_productivity: "call quality and productivity",
  poor_focus: "low focus",
  noise_sensitivity: "noise sensitivity",
  clutter: "desk clutter",
  bad_lighting: "poor lighting",
  limited_mobility: "limited mobility",
  small_space: "small space",
  budget_limited: "budget pressure",
};

const categoryNouns: Record<ProductCategory, string> = {
  laptop: "laptop",
  monitor: "monitor",
  laptop_stand: "laptop stand",
  keyboard: "keyboard",
  mouse: "mouse",
  chair: "chair",
  desk_lamp: "lamp",
  headphones: "headphones",
  webcam: "webcam",
  storage: "storage upgrade",
  cable_management: "cable management upgrade",
};

const categoryOutcomes: Record<ProductCategory, string> = {
  laptop: "removes slow-computer friction from everyday work",
  monitor: "adds readable workspace and helps keep the laptop from becoming your main posture anchor",
  laptop_stand: "raises the laptop toward eye level and frees room for separate input devices",
  keyboard: "makes long typing sessions more comfortable and keeps wrists in a steadier position",
  mouse: "moves your hand into a more neutral grip than a trackpad or flat mouse",
  chair: "adds adjustable support for longer seated sessions",
  desk_lamp: "adds controllable task lighting without depending on the room lights",
  headphones: "improves focus, call clarity, and noise control in shared or distracting spaces",
  webcam: "improves video-call clarity when the room or laptop camera is working against you",
  storage: "reduces desk clutter by giving loose gear a clear place to land",
  cable_management: "routes cable clutter away from the main work surface",
};

function formatProblem(problem: UserProblem): string {
  return problemLabels[problem] ?? problem.replaceAll("_", " ");
}

function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function lowerFirst(value: string): string {
  return value.length > 0 ? `${value[0].toLowerCase()}${value.slice(1)}` : value;
}

function productPriceUsd(product: Product): number {
  return product.priceUsd;
}

function requiredDeskWidth(product: Product): number | undefined {
  return product.constraints.minDeskWidthInches;
}

function isPortableProduct(product: Product): boolean {
  return Boolean(product.constraints.portable);
}

function matchingProblems(product: Product, profile: UserProfile): UserProblem[] {
  return profile.problems.filter((problem) => product.solves.includes(problem));
}

function currentItemForCategory(product: Product, inventory: InventoryItem[]): InventoryItem | undefined {
  return inventory.find((item) => item.category === product.category);
}

function currentItemPain(item: InventoryItem | undefined): string {
  if (!item || item.painPoints.length === 0) return "";
  return ` and is tied to ${formatList(item.painPoints.map(formatProblem))}`;
}

function hasLaptopOnlyScreen(item: InventoryItem | undefined): boolean {
  return Boolean(item?.name.toLowerCase().includes("laptop") && item.category === "monitor");
}

function firstStrengths(product: Product): string {
  return formatList(product.strengths.slice(0, 2).map(lowerFirst));
}

function explainProblemSolved(product: Product, profile: UserProfile, inventory: InventoryItem[]): string {
  const solved = matchingProblems(product, profile);
  const solvedText = solved.length > 0 ? formatList(solved.map(formatProblem)) : "a setup gap";
  const currentItem = currentItemForCategory(product, inventory);
  const categoryOutcome = categoryOutcomes[product.category];

  if (product.category === "monitor" && hasLaptopOnlyScreen(currentItem)) {
    return `You currently use only a laptop screen. Since you work as a ${profile.profession.toLowerCase()} and reported ${solvedText}, a larger monitor ${categoryOutcome}.`;
  }

  if (currentItem) {
    return `Your current ${categoryNouns[product.category]} is ${currentItem.name}, which is marked ${currentItem.condition}${currentItemPain(currentItem)}. ${product.name} addresses ${solvedText} because it ${categoryOutcome}.`;
  }

  return `You do not currently have a dedicated ${categoryNouns[product.category]}. ${product.name} addresses ${solvedText} because it ${categoryOutcome}.`;
}

function explainWhyNow(product: Product, profile: UserProfile, inventory: InventoryItem[], categoryScore: CategoryScore): string {
  const currentItem = currentItemForCategory(product, inventory);
  const solved = matchingProblems(product, profile).map(formatProblem);
  const pressure = solved.length > 0 ? `you reported ${formatList(solved)}` : "this category fills a clear setup gap";

  if (currentItem?.condition === "poor" || currentItem?.condition === "fair") {
    return `This is worth considering now because ${currentItem.name} is only in ${currentItem.condition} condition and ${pressure}.`;
  }

  if (categoryScore.score >= 80) {
    return `This category scored ${categoryScore.score}/100, so it is one of the clearest upgrade opportunities in the current setup.`;
  }

  if (profile.constraints.sharesSpace && product.category === "headphones") {
    return "You share the space, so noise control and clearer calls pay off every workday instead of being a nice-to-have.";
  }

  if (profile.constraints.portableSetup && isPortableProduct(product)) {
    return "Your setup needs to move, so a portable upgrade gives ergonomic value without locking you to one desk.";
  }

  return `Now is a sensible time because ${pressure} and this fits the current ${profile.spendingStyle} spending style.`;
}

function explainWhyThisModel(product: Product, profile: UserProfile): string {
  const strengths = firstStrengths(product);
  const budgetText =
    productPriceUsd(product) <= profile.budgetUsd
      ? `fits within the $${profile.budgetUsd} budget`
      : `stretches past the $${profile.budgetUsd} budget`;

  if (strengths) {
    return `${product.name} was picked because it ${budgetText} and combines ${strengths}.`;
  }

  return `${product.name} was picked because its comfort, productivity, accessibility, and value scores fit this profile better than lower-scoring options.`;
}

export function explainTradeoffs(product: Product, profile: UserProfile): string {
  const minDeskWidth = requiredDeskWidth(product);
  const budgetShare = productPriceUsd(product) / Math.max(profile.budgetUsd, 1);

  if (minDeskWidth && profile.constraints.deskWidthInches < minDeskWidth) {
    return `Tradeoff: it needs about ${minDeskWidth} inches of desk width, but this setup has ${profile.constraints.deskWidthInches} inches.`;
  }

  if (productPriceUsd(product) > profile.budgetUsd) {
    return `Tradeoff: at $${productPriceUsd(product)}, it is above the current $${profile.budgetUsd} budget unless you delay another upgrade.`;
  }

  if (budgetShare > 0.7) {
    return `Tradeoff: at $${productPriceUsd(product)}, it uses most of the $${profile.budgetUsd} budget even though it stays within it.`;
  }

  if (profile.constraints.portableSetup && !isPortableProduct(product)) {
    return `Tradeoff: it is a better fixed-desk upgrade than a portable one, so it may not travel well.`;
  }

  if (product.category === "monitor") {
    return "Tradeoff: it takes permanent desk space, so measure the desk before pairing it with speakers, lamps, or a laptop stand.";
  }

  if (product.category === "chair") {
    return "Tradeoff: the benefit depends on taking time to adjust seat height, lumbar support, and arm position.";
  }

  if (product.category === "headphones") {
    return "Tradeoff: stronger isolation helps focus, but it can feel less natural if you need to stay aware of the room.";
  }

  return "Tradeoff: the upgrade is practical, but it is still one more item to fit into the desk routine.";
}

function explainConfidence(score: number, product: Product, profile: UserProfile, inventory: InventoryItem[]): RecommendationConfidence {
  const solvedCount = matchingProblems(product, profile).length;
  const currentItem = currentItemForCategory(product, inventory);
  const minDeskWidth = requiredDeskWidth(product);
  const deskTooSmall = minDeskWidth !== undefined && profile.constraints.deskWidthInches < minDeskWidth;

  if (deskTooSmall || productPriceUsd(product) > profile.budgetUsd * 1.25 || score < 55) return "low";
  if (score >= 78 && solvedCount > 0 && (solvedCount >= 2 || currentItem?.condition === "poor" || currentItem?.condition === "fair")) {
    return "high";
  }
  if (score >= 64 || solvedCount > 0) return "medium";
  return "low";
}

export function explainWhyRankedAboveCurrentItem(
  product: Product,
  profile: UserProfile,
  inventory: InventoryItem[] = [],
): string {
  const currentItem = currentItemForCategory(product, inventory);
  const solved = matchingProblems(product, profile);
  const solvedText = solved.length > 0 ? formatList(solved.map(formatProblem)) : "the profile's highest-scoring needs";

  if (!currentItem) {
    return `It ranks high because there is no dedicated ${categoryNouns[product.category]} in inventory, while this model addresses ${solvedText}.`;
  }

  if (currentItem.condition === "poor" || currentItem.condition === "fair") {
    return `It ranks above ${currentItem.name} because that item is marked ${currentItem.condition}${currentItemPain(currentItem)}, while this model addresses ${solvedText}.`;
  }

  return `It ranks above the current ${categoryNouns[product.category]} when ${solvedText} matters more than keeping the existing item.`;
}

export function explainCategoryRecommendation(
  categoryScore: CategoryScore,
  profile?: UserProfile,
  inventory: InventoryItem[] = [],
): string {
  const label = categoryLabels[categoryScore.category];
  const ownedItem = inventory.find((item) => item.category === categoryScore.category);
  const reason = categoryScore.reasons[0]?.replaceAll("_", " ").toLowerCase() ?? "it fills a setup gap";

  if (profile) {
    const matchingProfileProblems = profile.problems
      .map(formatProblem)
      .filter((problem) => categoryScore.reasons.some((reason) => reason.toLowerCase().includes(problem)));

    if (ownedItem?.condition === "poor" || ownedItem?.condition === "fair") {
      return `${label} scored ${categoryScore.score}/100 because ${ownedItem.name} is marked ${ownedItem.condition} and this category can reduce ${formatList(matchingProfileProblems) || "daily friction"}.`;
    }
  }

  return `${label} scored ${categoryScore.score}/100 because ${reason}`;
}

export function explainProductRecommendation(
  product: Product,
  profile: UserProfile,
  categoryScore: CategoryScore,
  inventory: InventoryItem[] = [],
  score = categoryScore.score,
): RecommendationExplanation {
  return {
    problemSolved: explainProblemSolved(product, profile, inventory),
    whyNow: explainWhyNow(product, profile, inventory, categoryScore),
    whyThisModel: explainWhyThisModel(product, profile),
    tradeoff: explainTradeoffs(product, profile),
    confidenceLevel: explainConfidence(score, product, profile, inventory),
  };
}

export function explainProduct(
  product: Product,
  profile: UserProfile,
  categoryScore: CategoryScore,
  inventory: InventoryItem[] = [],
  score = categoryScore.score,
): string[] {
  const explanation = explainProductRecommendation(product, profile, categoryScore, inventory, score);

  return [
    explanation.problemSolved,
    explanation.whyNow,
    explanation.whyThisModel,
    explanation.tradeoff,
    `Confidence: ${explanation.confidenceLevel}.`,
  ];
}

export function explainCategory(score: CategoryScore): string {
  return explainCategoryRecommendation(score);
}

export const recommendationExplanationExamples = {
  monitor: {
    problemSolved:
      "You currently use only a laptop screen. Since you code for long periods and reported eye strain, a 27-inch QHD/4K monitor gives you more workspace and reduces the need to hunch over the laptop.",
  },
  laptop_stand: {
    problemSolved:
      "Your laptop sits flat on the desk. Since you reported neck pain and want a cleaner setup, a laptop stand raises the screen closer to eye level and frees room for a separate keyboard.",
  },
  mouse: {
    problemSolved:
      "You reported wrist pain from daily pointing work. An ergonomic mouse keeps your hand in a more neutral position than a flat trackpad, reducing strain during long sessions.",
  },
  chair: {
    problemSolved:
      "Your chair is not supporting long seated work. Since you reported back pain, an adjustable ergonomic chair gives you lumbar support and lets you tune seat height and arm position.",
  },
  headphones: {
    problemSolved:
      "You work in a shared space and your earbuds hurt call quality. Noise-canceling headphones improve focus while giving meetings a clearer microphone.",
  },
} satisfies Partial<Record<ProductCategory, Pick<RecommendationExplanation, "problemSolved">>>;
