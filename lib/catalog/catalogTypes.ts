import type { ProductCategory, UserProblem } from "@/lib/recommendation/types";

export type CatalogSourceKind = "static" | "serp" | "prices_api" | "manual";
export type CatalogPriceCondition = "new" | "open_box" | "used" | "refurbished" | "unknown";
export type CatalogConfidence = "low" | "medium" | "high" | number;

export interface LaptopCatalogSpecs {
  chip?: string;
  ramGb?: number;
  storageGb?: number;
  screenSize?: string;
  ports?: string[];
  weight?: string;
  os?: string;
}

export interface MonitorCatalogSpecs {
  sizeInches?: number;
  resolution?: string;
  refreshRate?: number;
  panelType?: string;
  usbC?: boolean;
  vesaMount?: boolean;
}

export interface MouseCatalogSpecs {
  ergonomic?: boolean;
  vertical?: boolean;
  wireless?: boolean;
  noiseLevel?: "quiet" | "normal" | "loud";
}

export interface KeyboardCatalogSpecs {
  layout?: string;
  switchType?: string;
  noiseLevel?: "quiet" | "normal" | "loud";
  wireless?: boolean;
}

export interface ChairCatalogSpecs {
  adjustableLumbar?: boolean;
  armrests?: string;
  seatHeightRange?: string;
  usedMarketCommon?: boolean;
}

export type CatalogProductSpecs = (
  | LaptopCatalogSpecs
  | MonitorCatalogSpecs
  | MouseCatalogSpecs
  | KeyboardCatalogSpecs
  | ChairCatalogSpecs
) &
  Record<string, string | number | boolean | string[] | undefined>;

export interface CatalogProduct {
  id: string;
  category: ProductCategory;
  brand: string;
  model: string;
  displayName: string;
  gtin?: string;
  upc?: string;
  aliases: string[];
  releaseYear?: number;
  specs: CatalogProductSpecs;
  source: CatalogSourceKind;
  sourceUrl?: string;
  confidence: CatalogConfidence;
  updatedAt: string;
}

export interface CatalogDimensions {
  widthInches?: number;
  heightInches?: number;
  depthInches?: number;
  weightPounds?: number;
}

export interface CatalogSpecs {
  dimensions?: CatalogDimensions;
  resolution?: string;
  refreshRateHz?: number;
  panelType?: string;
  switchType?: string;
  wireless?: boolean;
  noiseLevel?: "quiet" | "normal" | "loud";
  ports?: string[];
  tags: string[];
  raw: Record<string, string | number | boolean | string[]>;
}

export interface CatalogOffer {
  source: CatalogSourceKind;
  provider: string;
  title: string;
  url?: string;
  priceCents?: number;
  condition: CatalogPriceCondition;
  confidence: number;
  checkedAt: Date;
}

export interface CatalogModel {
  id: string;
  category: ProductCategory;
  brand: string;
  model: string;
  displayName: string;
  specs: CatalogSpecs;
  solvesProblems: UserProblem[];
  estimatedPriceCents?: number;
  searchQueries: string[];
  offers: CatalogOffer[];
  source: CatalogSourceKind;
  sourceIds: string[];
  updatedAt: Date;
}

export interface CatalogSearchQuery {
  text: string;
  category?: ProductCategory;
  maxPriceCents?: number;
  requiredTags?: string[];
}

export interface CatalogProviderResult {
  sourceId: string;
  category: ProductCategory;
  brand: string;
  model?: string;
  displayName: string;
  specs?: Record<string, unknown>;
  solvesProblems?: UserProblem[];
  estimatedPriceCents?: number;
  searchQueries?: string[];
  offers?: CatalogOffer[];
  url?: string;
}

export interface CatalogProvider {
  name: string;
  source: CatalogSourceKind;
  search(query: CatalogSearchQuery): Promise<CatalogProviderResult[]>;
}
