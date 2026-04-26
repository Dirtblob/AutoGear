import type { Db } from "mongodb";
import { rawDeviceSeedData } from "@/data/seeds/deviceSeedData";
import { buildErgonomicSpecs } from "@/lib/devices/ergonomicSpecs";
import { enrichCatalogDevice } from "@/lib/devices/traitPrecompute";
import { isDeviceCategory, type DeviceSpecs } from "@/lib/devices/deviceTypes";

export interface DeviceCatalogSeedSummary {
  databaseName: string;
  collection: string;
  read: number;
  matched: number;
  inserted: number;
  modified: number;
  ergonomicMatched: number;
  ergonomicModified: number;
}

function searchTextForDevice(device: ReturnType<typeof enrichCatalogDevice>): string {
  return Array.from(
    new Set(
      [
        device.brand,
        device.model,
        device.displayName,
        device.category,
        ...(device.aliases ?? []),
        ...(device.searchQueries ?? []),
      ]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).join(" ");
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function backfillErgonomicSpecs(collection: ReturnType<Db["collection"]>): Promise<{ matched: number; modified: number }> {
  const documents = await collection
    .find({}, { projection: { _id: 1, category: 1, specs: 1 } })
    .toArray();
  const operations = documents.flatMap((document) => {
    const category = typeof document.category === "string" && isDeviceCategory(document.category) ? document.category : null;
    if (!category) return [];

    const ergonomicSpecs = buildErgonomicSpecs({
      category,
      specs: objectValue(document.specs) as DeviceSpecs,
    });

    return [
      {
        updateOne: {
          filter: { _id: document._id },
          update: ergonomicSpecs
            ? { $set: { ergonomicSpecs } }
            : { $unset: { ergonomicSpecs: "" } },
        },
      },
    ];
  });

  if (operations.length === 0) return { matched: 0, modified: 0 };

  const result = await collection.bulkWrite(operations, { ordered: false });
  return { matched: result.matchedCount, modified: result.modifiedCount };
}

export async function seedMongoDeviceCatalog(db: Db): Promise<DeviceCatalogSeedSummary> {
  const devices = rawDeviceSeedData.map(enrichCatalogDevice);
  const collection = db.collection("device_catalog");

  if (devices.length === 0) {
    return {
      databaseName: db.databaseName,
      collection: collection.collectionName,
      read: 0,
      matched: 0,
      inserted: 0,
      modified: 0,
      ergonomicMatched: 0,
      ergonomicModified: 0,
    };
  }

  const result = await collection.bulkWrite(
    devices.map((device) => {
      const { ergonomicSpecs, ...deviceFields } = device;
      const update = {
        $set: {
          ...deviceFields,
          ...(ergonomicSpecs ? { ergonomicSpecs } : {}),
          searchText: searchTextForDevice(device),
          precomputedTraits: {
            normalizedSpecs: device.normalizedSpecs,
            traitRatings: device.traitRatings,
            traitConfidence: device.traitConfidence,
            strengths: device.strengths,
            weaknesses: device.weaknesses,
          },
          seededAt: new Date(),
        },
        ...(ergonomicSpecs ? {} : { $unset: { ergonomicSpecs: "" } }),
        $setOnInsert: {
          firstSeededAt: new Date(),
        },
      };

      return {
        updateOne: {
          filter: { id: device.id },
          update,
          upsert: true,
        },
      };
    }),
    { ordered: false },
  );
  const ergonomicBackfill = await backfillErgonomicSpecs(collection);

  return {
    databaseName: db.databaseName,
    collection: collection.collectionName,
    read: devices.length,
    matched: result.matchedCount,
    inserted: result.upsertedCount,
    modified: result.modifiedCount,
    ergonomicMatched: ergonomicBackfill.matched,
    ergonomicModified: ergonomicBackfill.modified,
  };
}
