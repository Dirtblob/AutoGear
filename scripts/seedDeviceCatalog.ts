import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Document } from "mongodb";
import { deviceCatalogSeed, type DeviceCatalogSeedItem } from "../data/seeds/deviceCatalogSeed";
import {
  closeMongoMigrationClient,
  getMongoMigrationDb,
} from "../lib/mongodb/inventoryMigration";
import { printMongoWriteTarget } from "../lib/mongodb/scriptSafety";

type DeviceCatalogDocument = Document & {
  _id?: unknown;
  id?: unknown;
  slug?: unknown;
  category?: unknown;
  brand?: unknown;
  model?: unknown;
  variant?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function timestampSlug(date = new Date()): string {
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ];

  return `${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}-${parts[5]}`;
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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function uniq(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function lifecycleStatus(releaseYear: number | null): string {
  if (!releaseYear) return "unknown";
  if (releaseYear >= 2025) return "current";
  if (releaseYear >= 2022) return "recent";
  if (releaseYear >= 2018) return "older";
  return "discontinued";
}

function searchQueriesForSeedItem(item: DeviceCatalogSeedItem): string[] {
  return uniq([
    `${item.brand} ${item.model}`,
    item.variant ? `${item.brand} ${item.model} ${item.variant}` : null,
    ...item.aliases,
    item.searchText,
  ]).slice(0, 8);
}

function displayNameForSeedItem(item: DeviceCatalogSeedItem): string {
  return [item.brand, item.model, item.variant].filter(Boolean).join(" ");
}

function buildLegacyIdCandidates(item: DeviceCatalogSeedItem): string[] {
  const base = slugify(`${item.brand}-${item.model}`);
  const withVariant = item.variant ? slugify(`${item.brand}-${item.model}-${item.variant}`) : null;

  return uniq([
    item.slug,
    `device-${item.category}-${base}`,
    withVariant ? `device-${item.category}-${withVariant}` : null,
  ]);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && !("_bsontype" in (value as Record<string, unknown>)));
}

function mergePreservingExisting(existing: unknown, incoming: unknown): unknown {
  if (incoming === undefined) return existing;
  if (incoming === null) return existing === undefined ? null : existing;
  if (Array.isArray(incoming)) return incoming;

  if (isPlainObject(existing) && isPlainObject(incoming)) {
    const merged: Record<string, unknown> = { ...existing };

    for (const [key, value] of Object.entries(incoming)) {
      const nextValue = mergePreservingExisting(existing[key], value);
      if (nextValue !== undefined) {
        merged[key] = nextValue;
      }
    }

    return merged;
  }

  if (!isPlainObject(incoming)) return incoming;

  const merged: Record<string, unknown> = isPlainObject(existing) ? { ...existing } : {};
  for (const [key, value] of Object.entries(incoming)) {
    const nextValue = mergePreservingExisting(merged[key], value);
    if (nextValue !== undefined) {
      merged[key] = nextValue;
    }
  }
  return merged;
}

function normalizeForCompare(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeForCompare);
  if (!value || typeof value !== "object") return value;

  const object = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(object)
      .sort()
      .filter((key) => key !== "updatedAt" && key !== "createdAt")
      .map((key) => [key, normalizeForCompare(object[key])]),
  );
}

function buildSeedDocument(item: DeviceCatalogSeedItem, existing: DeviceCatalogDocument | null, now: Date): Record<string, unknown> {
  const incoming: Record<string, unknown> = {
    slug: item.slug,
    id: stringValue(existing?.id) ?? item.slug,
    category: item.category,
    subcategory: item.subcategory,
    brand: item.brand,
    model: item.model,
    variant: item.variant,
    displayName: displayNameForSeedItem(item),
    releaseYear: item.releaseYear,
    aliases: item.aliases,
    searchText: item.searchText,
    searchQueries: searchQueriesForSeedItem(item),
    priceTier: item.priceTier,
    precomputedTraits: {
      traitRatings: item.precomputedTraits,
    },
    traitRatings: item.precomputedTraits,
    ergonomicSpecs: item.ergonomicSpecs,
    sourceNotes: item.sourceNotes,
    lifecycleStatus: lifecycleStatus(item.releaseYear),
    updatedAt: now,
  };

  return mergePreservingExisting(existing ?? undefined, incoming) as Record<string, unknown>;
}

function findExistingDocument(
  item: DeviceCatalogSeedItem,
  bySlug: Map<string, DeviceCatalogDocument>,
  byId: Map<string, DeviceCatalogDocument>,
): DeviceCatalogDocument | null {
  const byExactSlug = bySlug.get(item.slug);
  if (byExactSlug) return byExactSlug;

  for (const candidateId of buildLegacyIdCandidates(item)) {
    const match = byId.get(candidateId);
    if (match) return match;
  }

  return null;
}

function countByCategory(documents: Iterable<DeviceCatalogDocument | Record<string, unknown>>) {
  const counts = new Map<string, number>();

  for (const document of documents) {
    const category = stringValue((document as { category?: unknown }).category) ?? "(missing)";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category));
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const db = await getMongoMigrationDb();
  // `device_catalog` is global shared data, so seeding must be deterministic and
  // idempotent instead of destructive or user-scoped.
  const collection = db.collection<DeviceCatalogDocument>("device_catalog");
  const now = new Date();
  const existingDocuments = await collection.find({}).toArray();
  const backupDir = path.join(process.cwd(), "backups", timestampSlug(now));
  const backupFile = path.join(backupDir, "device_catalog.pre-seed.json");

  await mkdir(backupDir, { recursive: true });
  await writeFile(
    backupFile,
    JSON.stringify(
      {
        databaseName: db.databaseName,
        collection: "device_catalog",
        backedUpAt: now.toISOString(),
        count: existingDocuments.length,
        documents: existingDocuments.map((document) => toJsonSafe(document)),
      },
      null,
      2,
    ),
    "utf8",
  );

  const bySlug = new Map<string, DeviceCatalogDocument>();
  const byId = new Map<string, DeviceCatalogDocument>();
  const simulatedFinalDocuments = new Map<string, DeviceCatalogDocument | Record<string, unknown>>();

  for (const document of existingDocuments) {
    const key = String(document._id ?? stringValue(document.slug) ?? stringValue(document.id) ?? Math.random());
    simulatedFinalDocuments.set(key, document);

    const slug = stringValue(document.slug);
    const id = stringValue(document.id);
    if (slug) bySlug.set(slug, document);
    if (id) byId.set(id, document);
  }

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  const writeOperations: Array<() => Promise<void>> = [];

  for (const item of deviceCatalogSeed) {
    const existing = findExistingDocument(item, bySlug, byId);
    const nextDocument = buildSeedDocument(item, existing, now);

    if (!existing) {
      insertedCount += 1;
      simulatedFinalDocuments.set(`insert:${item.slug}`, {
        ...nextDocument,
        createdAt: now,
      });

      writeOperations.push(async () => {
        await collection.updateOne(
          { slug: item.slug },
          {
            $set: nextDocument,
            $setOnInsert: { createdAt: now },
          },
          { upsert: true },
        );
      });
      continue;
    }

    const currentComparable = JSON.stringify(normalizeForCompare(existing));
    const nextComparable = JSON.stringify(normalizeForCompare(nextDocument));

    if (currentComparable === nextComparable) {
      skippedCount += 1;
      continue;
    }

    updatedCount += 1;
    simulatedFinalDocuments.set(String(existing._id), {
      ...existing,
      ...nextDocument,
    });

    writeOperations.push(async () => {
      await collection.updateOne(
        { _id: existing._id } as Document,
        {
          $set: nextDocument,
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );
    });
  }

  if (!dryRun) {
    printMongoWriteTarget({
      dbName: db.databaseName,
      collections: ["device_catalog"],
      action: "prepare-write",
    });
    for (const operation of writeOperations) {
      await operation();
    }
  }

  const finalDeviceCatalogCount = dryRun ? simulatedFinalDocuments.size : await collection.countDocuments();
  const finalCategoryCounts = dryRun
    ? countByCategory(simulatedFinalDocuments.values())
    : countByCategory(await collection.find({}, { projection: { category: 1 } }).toArray());

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        databaseName: db.databaseName,
        backupFile,
        totalSeedItems: deviceCatalogSeed.length,
        insertedCount,
        updatedCount,
        skippedCount,
        finalDeviceCatalogCount,
        countsByCategory: finalCategoryCounts,
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
