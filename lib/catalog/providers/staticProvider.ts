import { catalogProducts } from "../../../data/productCatalog";
import type { ProductCategory } from "../../recommendation/types";
import { normalizeCatalogConfidence, normalizeCatalogText } from "../ingestionPipeline";
import { searchCatalogProducts } from "../modelSearch";
import type { CatalogProduct } from "../catalogTypes";
import type { CatalogProductCandidate, CatalogProductDetails, CatalogProvider } from "./types";

function toCandidate(product: CatalogProduct): CatalogProductCandidate {
  return {
    title: product.displayName,
    brand: product.brand,
    model: product.model,
    category: product.category,
    source: product.source,
    sourceUrl: product.sourceUrl,
    confidence: normalizeCatalogConfidence(product.confidence),
  };
}

export function toCatalogProductDetails(product: CatalogProduct): CatalogProductDetails {
  return {
    brand: product.brand,
    model: product.model,
    displayName: product.displayName,
    category: product.category,
    specs: product.specs,
    aliases: product.aliases,
    source: product.source,
    sourceUrl: product.sourceUrl,
  };
}

function candidateKey(candidate: CatalogProductCandidate): string {
  return normalizeCatalogText([candidate.source, candidate.brand, candidate.model, candidate.title, candidate.category].join(" "));
}

export function createStaticCatalogProvider(products: CatalogProduct[] = catalogProducts): CatalogProvider {
  const detailsByCandidateKey = new Map(
    products.map((product) => [candidateKey(toCandidate(product)), toCatalogProductDetails(product)]),
  );

  return {
    name: "static-catalog",
    async searchModels(query: string, category?: ProductCategory): Promise<CatalogProductCandidate[]> {
      const trimmedQuery = query.trim();

      if (!trimmedQuery) {
        return products
          .filter((product) => !category || product.category === category)
          .map(toCandidate)
          .sort((left, right) => right.confidence - left.confidence || left.title.localeCompare(right.title));
      }

      return searchCatalogProducts(products, {
        text: trimmedQuery,
        category,
        limit: 20,
      }).map((result) => toCandidate(result.product));
    },
    async getModelDetails(candidate: CatalogProductCandidate): Promise<CatalogProductDetails | null> {
      return detailsByCandidateKey.get(candidateKey(candidate)) ?? null;
    },
  };
}

export const staticCatalogProvider = createStaticCatalogProvider();
