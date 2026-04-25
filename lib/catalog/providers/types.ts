import type { ProductCategory } from "@/lib/recommendation/types";

export type CatalogProductSpecsInput = Record<string, unknown>;

export interface CatalogProductCandidate {
  title: string;
  brand?: string;
  model?: string;
  category: ProductCategory;
  source: string;
  sourceUrl?: string;
  confidence: number;
}

export interface CatalogProductDetails {
  brand: string;
  model: string;
  displayName: string;
  category: ProductCategory;
  specs: CatalogProductSpecsInput;
  aliases: string[];
  images?: string[];
  source: string;
  sourceUrl?: string;
}

export interface CatalogProvider {
  name: string;
  searchModels(query: string, category?: ProductCategory): Promise<CatalogProductCandidate[]>;
  getModelDetails(candidate: CatalogProductCandidate): Promise<CatalogProductDetails | null>;
}
