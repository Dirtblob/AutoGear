import { PRODUCT_CATEGORIES, type ProductCategory } from "../recommendation/types";
import type { CatalogProductCandidate, CatalogProductDetails, CatalogProvider } from "./providers/types";
import { normalizeSpecs } from "./specNormalizer";

export interface CatalogCandidateReview {
  candidate: CatalogProductCandidate;
  details: CatalogProductDetails | null;
  normalizedDetails: CatalogProductDetails | null;
  dedupeKey: string;
  duplicateOf?: CatalogProductDetails;
}

export interface CatalogSearchOptions {
  providers: CatalogProvider[];
  query: string;
  category?: ProductCategory;
  existingProducts?: CatalogProductDetails[];
}

export const futureCatalogProviderTodo =
  "Future provider hook: add API-backed catalog providers here, such as PricesAPI.io, manufacturer feeds, or marketplace APIs, without raw retailer scraping.";

const productCategories = new Set<string>(PRODUCT_CATEGORIES);

export function normalizeCatalogText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compactKeyPart(value: unknown): string {
  return normalizeCatalogText(value).replace(/\s+/g, "");
}

export function normalizeCatalogCategory(value: unknown): ProductCategory | null {
  const normalized = normalizeCatalogText(value).replace(/\s+/g, "_");
  return productCategories.has(normalized) ? (normalized as ProductCategory) : null;
}

export function normalizeCatalogConfidence(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.min(1, value));
  if (value === "high") return 0.9;
  if (value === "medium") return 0.65;
  if (value === "low") return 0.35;
  return 0.5;
}

interface CatalogDedupeInput {
  brand?: string;
  model?: string;
  category: ProductCategory;
  title?: string;
  displayName?: string;
}

export function catalogProductDedupeKey(product: CatalogDedupeInput): string {
  const brand = compactKeyPart(product.brand);
  const model = compactKeyPart(product.model ?? product.displayName ?? product.title);
  const category = compactKeyPart(product.category);

  return [brand, model, category].join(":");
}

export function normalizeCatalogProductDetails(details: CatalogProductDetails): CatalogProductDetails {
  const brand = details.brand.trim();
  const model = details.model.trim();
  const displayName = details.displayName.trim() || [brand, model].filter(Boolean).join(" ");
  const aliases = Array.from(
    new Set(
      details.aliases
        .map((alias) => alias.trim())
        .filter((alias) => alias.length > 0 && normalizeCatalogText(alias) !== normalizeCatalogText(displayName)),
    ),
  );
  const images = details.images
    ?.map((image) => image.trim())
    .filter((image) => image.length > 0);

  return {
    ...details,
    brand,
    model,
    displayName,
    aliases,
    images: images && images.length > 0 ? Array.from(new Set(images)) : undefined,
    specs: normalizeSpecs(details.specs).raw,
    source: details.source.trim() || "manual",
    sourceUrl: details.sourceUrl?.trim() || undefined,
  };
}

export function findCatalogDuplicate(
  product: CatalogProductCandidate | CatalogProductDetails,
  existingProducts: CatalogProductDetails[],
): CatalogProductDetails | undefined {
  const key = catalogProductDedupeKey(product);
  return existingProducts.find((existing) => catalogProductDedupeKey(existing) === key);
}

export function mergeCatalogProductDetails(
  existing: CatalogProductDetails,
  incoming: CatalogProductDetails,
): CatalogProductDetails {
  const normalizedExisting = normalizeCatalogProductDetails(existing);
  const normalizedIncoming = normalizeCatalogProductDetails(incoming);

  return {
    ...normalizedExisting,
    displayName: normalizedIncoming.displayName || normalizedExisting.displayName,
    specs: {
      ...normalizedExisting.specs,
      ...normalizedIncoming.specs,
    },
    aliases: Array.from(new Set([...normalizedExisting.aliases, ...normalizedIncoming.aliases])),
    images: Array.from(new Set([...(normalizedExisting.images ?? []), ...(normalizedIncoming.images ?? [])])),
    source: normalizedIncoming.source || normalizedExisting.source,
    sourceUrl: normalizedIncoming.sourceUrl ?? normalizedExisting.sourceUrl,
  };
}

export function deduplicateCatalogProductDetails(products: CatalogProductDetails[]): CatalogProductDetails[] {
  const merged = new Map<string, CatalogProductDetails>();

  for (const product of products) {
    const normalized = normalizeCatalogProductDetails(product);
    const key = catalogProductDedupeKey(normalized);
    const existing = merged.get(key);
    merged.set(key, existing ? mergeCatalogProductDetails(existing, normalized) : normalized);
  }

  return [...merged.values()].sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export async function searchCatalogCandidates({
  providers,
  query,
  category,
  existingProducts = [],
}: CatalogSearchOptions): Promise<CatalogCandidateReview[]> {
  const reviews: CatalogCandidateReview[] = [];

  for (const provider of providers) {
    const candidates = await provider.searchModels(query, category);

    for (const candidate of candidates) {
      const details = await provider.getModelDetails(candidate);
      const normalizedDetails = details ? normalizeCatalogProductDetails(details) : null;
      const dedupeTarget = normalizedDetails ?? candidate;
      reviews.push({
        candidate,
        details,
        normalizedDetails,
        dedupeKey: catalogProductDedupeKey(dedupeTarget),
        duplicateOf: findCatalogDuplicate(dedupeTarget, existingProducts),
      });
    }
  }

  return reviews.sort(
    (left, right) =>
      right.candidate.confidence - left.candidate.confidence ||
      left.candidate.title.localeCompare(right.candidate.title),
  );
}
