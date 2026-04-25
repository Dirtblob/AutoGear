import type { AvailabilityProductModel, AvailabilityResult } from "./types";

export interface AvailabilityMatchCandidate {
  title: string;
  brand?: string;
  model?: string;
  category?: string;
  condition?: string;
  gtin?: string;
  upc?: string;
  aliases?: string[];
}

const categoryAliases: Record<string, string[]> = {
  laptop: ["laptop", "notebook", "ultrabook"],
  monitor: ["monitor", "display", "screen"],
  laptop_stand: ["laptop stand", "notebook stand", "stand"],
  keyboard: ["keyboard"],
  mouse: ["mouse", "trackball"],
  chair: ["chair", "task chair", "office chair"],
  desk_lamp: ["desk lamp", "lamp", "light", "screenbar", "monitor light"],
  headphones: ["headphones", "headset"],
  webcam: ["webcam", "camera"],
  storage: ["storage", "ssd", "drive"],
  cable_management: ["cable management", "cable organizer", "cable tray"],
};

function normalizedText(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value: string | undefined): string {
  return normalizedText(value).replace(/\s+/g, "");
}

function normalizedIdentifier(value: string | undefined): string {
  return (value ?? "").replace(/\D+/g, "");
}

function titleHasExactModel(title: string, model: string | undefined): boolean {
  const normalizedModel = compactText(model);
  return normalizedModel.length > 0 && compactText(title).includes(normalizedModel);
}

function extractModelLikeTokens(value: string | undefined): string[] {
  const source = value ?? "";
  const matches = source.match(/[A-Za-z0-9]+(?:[- ][A-Za-z0-9]+)*/g) ?? [];

  return Array.from(
    new Set(
      matches
        .map(compactText)
        .filter((token) => token.length >= 4 && /[a-z]/.test(token) && /\d/.test(token)),
    ),
  );
}

function looksLikeDifferentVariant(expectedModel: string | undefined, title: string): boolean {
  const normalizedExpected = compactText(expectedModel);
  if (!normalizedExpected || titleHasExactModel(title, expectedModel)) {
    return false;
  }

  const titleVariants = extractModelLikeTokens(title);
  if (titleVariants.length === 0) {
    return false;
  }

  const expectedLetters = normalizedExpected.replace(/\d+/g, "");
  const expectedPrefix = normalizedExpected.slice(0, Math.min(6, normalizedExpected.length));

  return titleVariants.some((token) => {
    if (token === normalizedExpected) {
      return false;
    }

    const tokenLetters = token.replace(/\d+/g, "");
    return (
      tokenLetters.length > 0 &&
      tokenLetters === expectedLetters &&
      (token.startsWith(expectedPrefix) || normalizedExpected.startsWith(token.slice(0, Math.min(6, token.length))))
    );
  });
}

function brandMatches(product: AvailabilityProductModel, candidate: AvailabilityMatchCandidate): boolean {
  const normalizedBrand = normalizedText(product.brand);
  if (!normalizedBrand) return false;

  const candidateBrand = normalizedText(candidate.brand);
  const candidateText = normalizedText([candidate.brand, candidate.title].filter(Boolean).join(" "));

  return candidateBrand === normalizedBrand || candidateText.includes(normalizedBrand);
}

function categoryMatches(product: AvailabilityProductModel, candidate: AvailabilityMatchCandidate): boolean {
  const aliases = categoryAliases[product.category] ?? [product.category.replaceAll("_", " ")];
  const categoryText = normalizedText(candidate.category);
  const titleText = normalizedText(candidate.title);

  return aliases.some((alias) => {
    const normalizedAlias = normalizedText(alias);
    return normalizedAlias.length > 0 && (categoryText.includes(normalizedAlias) || titleText.includes(normalizedAlias));
  });
}

function identifiersMatch(product: AvailabilityProductModel, candidate: AvailabilityMatchCandidate): boolean {
  const productIdentifiers = [product.gtin, product.upc].map(normalizedIdentifier).filter(Boolean);
  const candidateIdentifiers = [candidate.gtin, candidate.upc].map(normalizedIdentifier).filter(Boolean);

  return productIdentifiers.some((identifier) => candidateIdentifiers.includes(identifier));
}

function disallowedCondition(condition: string | undefined): boolean {
  return /\b(?:broken|parts[\s_-]*only|for[\s_-]*parts|refurbished)\b/i.test(condition ?? "");
}

function titleIncludesAlias(candidate: AvailabilityMatchCandidate): boolean {
  const title = normalizedText(candidate.title);
  return (candidate.aliases ?? []).some((alias) => {
    const normalizedAlias = normalizedText(alias);
    return normalizedAlias.length >= 4 && title.includes(normalizedAlias);
  });
}

function brokenOrPartsOnly(candidate: AvailabilityMatchCandidate): boolean {
  return /\b(?:broken|parts[\s_-]*only|for[\s_-]*parts|replacement\s+parts?|repair\s+parts?|not\s+working)\b/i.test(
    [candidate.title, candidate.condition].filter(Boolean).join(" "),
  );
}

export function scoreOfferConfidence(
  product: AvailabilityProductModel,
  candidate: AvailabilityMatchCandidate,
): number {
  let score = 20;

  if (titleHasExactModel(candidate.title, product.model)) score += 40;
  if (brandMatches(product, candidate)) score += 25;
  if (identifiersMatch(product, candidate)) score += 20;
  if (categoryMatches(product, candidate)) score += 10;
  if (titleIncludesAlias(candidate)) score += 10;
  if (looksLikeDifferentVariant(product.model, candidate.title)) score -= 30;
  if (product.allowUsed === false && disallowedCondition(candidate.condition)) score -= 20;

  return Math.max(0, Math.min(100, score));
}

export function shouldRejectAvailabilityCandidate(
  product: AvailabilityProductModel,
  candidate: AvailabilityMatchCandidate,
): boolean {
  return brokenOrPartsOnly(candidate) || looksLikeDifferentVariant(product.model, candidate.title);
}

export function compareAvailabilityResults(left: AvailabilityResult, right: AvailabilityResult): number {
  return (
    right.confidence - left.confidence ||
    Number(right.available) - Number(left.available) ||
    left.totalPriceCents - right.totalPriceCents ||
    left.title.localeCompare(right.title)
  );
}
