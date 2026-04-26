import "server-only";

import { listMongoCatalogDevices } from "@/lib/devices/mongoDeviceCatalog";
import { type Product } from "./types";
export { deviceToRecommendationProduct, recommendationProductToAvailabilityModel } from "./deviceProductMapping";
import { deviceToRecommendationProduct } from "./deviceProductMapping";

const recommendationDeviceCategories = [
  "laptop",
  "monitor",
  "laptop_stand",
  "keyboard",
  "mouse",
  "chair",
  "desk_lamp",
  "headphones",
  "earbuds",
  "webcam",
  "external_storage",
  "docking_station",
] as const;

export async function loadMongoRecommendationProducts(limit = 500): Promise<Product[]> {
  const devices = await listMongoCatalogDevices({
    categories: recommendationDeviceCategories,
    limit,
  });
  const seen = new Set<string>();
  const products: Product[] = [];

  for (const device of devices) {
    const product = deviceToRecommendationProduct(device);
    if (!product || seen.has(product.id)) continue;
    seen.add(product.id);
    products.push(product);
  }

  return products;
}
