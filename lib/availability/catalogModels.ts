import { productCatalog, type ProductCatalogItem } from "@/data/seeds/productCatalog";
import type { AvailabilityProductModel } from "./types";

export function catalogProductToAvailabilityModel(product: ProductCatalogItem): AvailabilityProductModel {
  return {
    id: product.id,
    brand: product.brand,
    model: product.model,
    displayName: product.displayName,
    category: product.category,
    estimatedPriceCents: product.estimatedPriceCents,
    gtin: product.gtin,
    upc: product.upc,
    searchQueries: product.searchQueries,
  };
}

export function productCatalogToAvailabilityModels(
  products: ProductCatalogItem[] = productCatalog,
): AvailabilityProductModel[] {
  return products.map(catalogProductToAvailabilityModel);
}

export function findCatalogAvailabilityModel(productModelId: string): AvailabilityProductModel | null {
  const product = productCatalog.find((item) => item.id === productModelId);

  return product ? catalogProductToAvailabilityModel(product) : null;
}
