import type { Document } from "mongodb";
import {
  closeMongoMigrationClient,
  getMongoMigrationDb,
} from "../lib/mongodb/inventoryMigration";

type DeviceCatalogDocument = Document & {
  _id: unknown;
  id?: unknown;
  slug?: unknown;
  category?: unknown;
  brand?: unknown;
  model?: unknown;
  variant?: unknown;
  generation?: unknown;
  searchText?: unknown;
  precomputedTraits?: unknown;
  ergonomicSpecs?: unknown;
};

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function objectWithKeys(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const object = value as Record<string, unknown>;
  return Object.keys(object).length > 0 ? object : null;
}

function toJsonSafe(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (!value || typeof value !== "object") return value;

  if ("_bsontype" in (value as Record<string, unknown>)) {
    const bson = value as { toHexString?: () => string; toString: () => string };
    return typeof bson.toHexString === "function" ? bson.toHexString() : bson.toString();
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, toJsonSafe(item)]),
  );
}

function sortCountEntries(entries: Array<{ _id: string | null; count: number }>) {
  return entries
    .map((entry) => ({
      value: entry._id ?? "(missing)",
      count: entry.count,
    }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

async function main(): Promise<void> {
  const db = await getMongoMigrationDb();
  const collection = db.collection<DeviceCatalogDocument>("device_catalog");
  const existingCollections = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((entry) => entry.name));

  if (!existingCollections.has("device_catalog")) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          databaseName: db.databaseName,
          collection: "device_catalog",
          exists: false,
          totalCount: 0,
          countsByCategory: [],
          countsByBrand: [],
          missingFields: {
            slug: 0,
            category: 0,
            brand: 0,
            model: 0,
            searchText: 0,
            precomputedTraits: 0,
            anyRequiredField: 0,
          },
          ergonomicSpecsCount: 0,
          duplicateSlugs: [],
          duplicateCategoryBrandModelVariant: [],
          randomSamples: [],
        },
        null,
        2,
      ),
    );
    return;
  }

  const [totalCount, countsByCategoryRaw, countsByBrandRaw, documents, randomSamples] = await Promise.all([
    collection.countDocuments(),
    collection.aggregate<{ _id: string | null; count: number }>([
      {
        $group: {
          _id: {
            $cond: [
              {
                $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ["$category", ""] } } } }, 0],
              },
              { $trim: { input: "$category" } },
              null,
            ],
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
    ]).toArray(),
    collection.aggregate<{ _id: string | null; count: number }>([
      {
        $group: {
          _id: {
            $cond: [
              {
                $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ["$brand", ""] } } } }, 0],
              },
              { $trim: { input: "$brand" } },
              null,
            ],
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
    ]).toArray(),
    collection.find({}).toArray(),
    collection.aggregate<DeviceCatalogDocument>([{ $sample: { size: 20 } }]).toArray(),
  ]);

  let missingSlugCount = 0;
  let missingCategoryCount = 0;
  let missingBrandCount = 0;
  let missingModelCount = 0;
  let missingSearchTextCount = 0;
  let missingPrecomputedTraitsCount = 0;
  let missingAnyRequiredFieldCount = 0;
  let ergonomicSpecsCount = 0;

  const slugCounts = new Map<string, number>();
  const combinationCounts = new Map<string, { count: number; category: string; brand: string; model: string; variant: string | null }>();

  for (const document of documents) {
    const slug = nonEmptyString(document.slug) ?? nonEmptyString(document.id);
    const category = nonEmptyString(document.category);
    const brand = nonEmptyString(document.brand);
    const model = nonEmptyString(document.model);
    const variant = nonEmptyString(document.variant) ?? nonEmptyString(document.generation);
    const searchText = nonEmptyString(document.searchText);
    const precomputedTraits = objectWithKeys(document.precomputedTraits);
    const ergonomicSpecs = objectWithKeys(document.ergonomicSpecs);

    if (!slug) missingSlugCount += 1;
    if (!category) missingCategoryCount += 1;
    if (!brand) missingBrandCount += 1;
    if (!model) missingModelCount += 1;
    if (!searchText) missingSearchTextCount += 1;
    if (!precomputedTraits) missingPrecomputedTraitsCount += 1;
    if (!slug || !category || !brand || !model || !searchText || !precomputedTraits) {
      missingAnyRequiredFieldCount += 1;
    }
    if (ergonomicSpecs) ergonomicSpecsCount += 1;

    if (slug) {
      slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1);
    }

    if (category && brand && model) {
      const key = [category, brand, model, variant ?? ""].join("::");
      const existing = combinationCounts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        combinationCounts.set(key, {
          count: 1,
          category,
          brand,
          model,
          variant,
        });
      }
    }
  }

  const duplicateSlugs = Array.from(slugCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([slug, count]) => ({ slug, count }))
    .sort((left, right) => right.count - left.count || left.slug.localeCompare(right.slug));

  const duplicateCategoryBrandModelVariant = Array.from(combinationCounts.values())
    .filter((entry) => entry.count > 1)
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.category.localeCompare(right.category) ||
        left.brand.localeCompare(right.brand) ||
        left.model.localeCompare(right.model) ||
        (left.variant ?? "").localeCompare(right.variant ?? ""),
    );

  console.log(
    JSON.stringify(
      {
        ok: true,
        databaseName: db.databaseName,
        collection: "device_catalog",
        exists: true,
        totalCount,
        countsByCategory: sortCountEntries(countsByCategoryRaw),
        countsByBrand: sortCountEntries(countsByBrandRaw),
        missingFields: {
          slug: missingSlugCount,
          category: missingCategoryCount,
          brand: missingBrandCount,
          model: missingModelCount,
          searchText: missingSearchTextCount,
          precomputedTraits: missingPrecomputedTraitsCount,
          anyRequiredField: missingAnyRequiredFieldCount,
        },
        ergonomicSpecsCount,
        duplicateSlugs,
        duplicateCategoryBrandModelVariant,
        randomSamples: randomSamples.map((document) => toJsonSafe(document)),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoMigrationClient();
  });
