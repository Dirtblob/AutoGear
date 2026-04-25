import type { ProductCategory } from "@/lib/recommendation/types";
import {
  normalizeCatalogCategory,
  normalizeCatalogConfidence,
  normalizeCatalogProductDetails,
  normalizeCatalogText,
} from "../ingestionPipeline";
import type { CatalogProductCandidate, CatalogProductDetails, CatalogProvider } from "./types";

type ManualImportRecord = Partial<CatalogProductDetails> & {
  title?: string;
  confidence?: number | "low" | "medium" | "high";
};

function recordsFromJson(rawJson: string): unknown[] {
  const parsed = JSON.parse(rawJson) as unknown;

  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { products?: unknown }).products)) {
    return (parsed as { products: unknown[] }).products;
  }
  if (parsed && typeof parsed === "object") return [parsed];

  throw new Error("Import JSON must be an object, an array, or an object with a products array.");
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function parseManualRecord(record: unknown, index: number): CatalogProductDetails {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error(`Product ${index + 1} must be a JSON object.`);
  }

  const item = record as ManualImportRecord;
  const category = normalizeCatalogCategory(item.category);
  const brand = typeof item.brand === "string" ? item.brand.trim() : "";
  const model = typeof item.model === "string" ? item.model.trim() : "";
  const displayName =
    (typeof item.displayName === "string" && item.displayName.trim()) ||
    (typeof item.title === "string" && item.title.trim()) ||
    [brand, model].filter(Boolean).join(" ");

  if (!category) throw new Error(`Product ${index + 1} needs a valid category.`);
  if (!brand) throw new Error(`Product ${index + 1} needs a brand.`);
  if (!model) throw new Error(`Product ${index + 1} needs a model.`);
  if (!displayName) throw new Error(`Product ${index + 1} needs a displayName or title.`);

  return normalizeCatalogProductDetails({
    brand,
    model,
    displayName,
    category,
    specs: item.specs && typeof item.specs === "object" && !Array.isArray(item.specs) ? item.specs : {},
    aliases: parseStringArray(item.aliases),
    images: parseStringArray(item.images),
    source: typeof item.source === "string" && item.source.trim() ? item.source.trim() : "manual",
    sourceUrl: typeof item.sourceUrl === "string" ? item.sourceUrl : undefined,
  });
}

function toCandidate(product: CatalogProductDetails, confidence = 0.72): CatalogProductCandidate {
  return {
    title: product.displayName,
    brand: product.brand,
    model: product.model,
    category: product.category,
    source: product.source,
    sourceUrl: product.sourceUrl,
    confidence,
  };
}

function productMatches(product: CatalogProductDetails, query: string, category?: ProductCategory): boolean {
  if (category && product.category !== category) return false;
  const normalizedQuery = normalizeCatalogText(query);
  if (!normalizedQuery) return true;

  return normalizeCatalogText([
    product.brand,
    product.model,
    product.displayName,
    product.category,
    ...product.aliases,
  ].join(" ")).includes(normalizedQuery);
}

export function parseManualCatalogImportJson(rawJson: string): CatalogProductDetails[] {
  return recordsFromJson(rawJson).map(parseManualRecord);
}

export function createManualImportProvider(imports: CatalogProductDetails[] | string): CatalogProvider {
  const products =
    typeof imports === "string" ? parseManualCatalogImportJson(imports) : imports.map(normalizeCatalogProductDetails);
  const detailsByTitle = new Map(products.map((product) => [normalizeCatalogText(product.displayName), product]));

  return {
    name: "manual-import",
    async searchModels(query: string, category?: ProductCategory): Promise<CatalogProductCandidate[]> {
      return products
        .filter((product) => productMatches(product, query, category))
        .map((product) => toCandidate(product, normalizeCatalogConfidence("medium")))
        .sort((left, right) => left.title.localeCompare(right.title));
    },
    async getModelDetails(candidate: CatalogProductCandidate): Promise<CatalogProductDetails | null> {
      return detailsByTitle.get(normalizeCatalogText(candidate.title)) ?? null;
    },
  };
}
