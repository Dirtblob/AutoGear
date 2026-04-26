import "server-only";

import { ObjectId, type Document, type Filter } from "mongodb";
import { getMongoDatabase } from "@/lib/mongodb";
import { searchDevices } from "./deviceSearch";
import {
  DEVICE_CATEGORIES,
  type CatalogDevice,
  type DeviceCategory,
  type DeviceSpecs,
  type DeviceSpecsValue,
  type DeviceTraitRatings,
  type NormalizedDeviceSpecs,
  type RawCatalogDevice,
  isDeviceCategory,
} from "./deviceTypes";
import { ergonomicSpecsFromUnknown } from "./ergonomicSpecs";
import { enrichCatalogDevice } from "./traitPrecompute";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 50;
const MAX_CATALOG_LIMIT = 500;
const SEARCH_PREFETCH_LIMIT = 200;
const DEVICE_COLLECTION = "device_catalog";

type MongoDeviceDocument = Document & {
  _id: ObjectId | string;
};

export type MongoCatalogDevice = CatalogDevice & {
  _id: string;
  searchText?: string;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clampLimit(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, parsed));
}

function clampCatalogLimit(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return MAX_CATALOG_LIMIT;
  return Math.max(1, Math.min(MAX_CATALOG_LIMIT, parsed));
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function deviceSpecsValue(value: unknown): DeviceSpecsValue {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value;
  if (Array.isArray(value) && value.every((item) => typeof item === "number")) return value;

  return undefined;
}

function deviceSpecs(value: unknown): DeviceSpecs {
  return Object.fromEntries(
    Object.entries(objectValue(value))
      .map(([key, item]) => [key, deviceSpecsValue(item)] as const)
      .filter(([, item]) => item !== undefined),
  ) as DeviceSpecs;
}

function normalizedDeviceSpecs(value: unknown): NormalizedDeviceSpecs {
  return deviceSpecs(value);
}

function traitRatings(value: unknown): DeviceTraitRatings {
  return Object.fromEntries(
    Object.entries(objectValue(value)).filter(([, item]) => typeof item === "number" && Number.isFinite(item)),
  ) as DeviceTraitRatings;
}

function hasObjectKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

function stringArrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function objectIdFilter(id: string): Filter<MongoDeviceDocument>[] {
  if (!ObjectId.isValid(id)) return [];
  return [{ _id: new ObjectId(id) }];
}

function normalizeMongoDevice(document: MongoDeviceDocument): MongoCatalogDevice | null {
  const rawCategory = stringValue(document.category);
  if (!isDeviceCategory(rawCategory)) return null;

  const objectId = String(document._id);
  const brand = stringValue(document.brand);
  const model = stringValue(document.model);
  const displayName = stringValue(document.displayName, [brand, model].filter(Boolean).join(" "));

  if (!brand || !model || !displayName) return null;

  const searchText = stringValue(document.searchText);
  const precomputedTraits = objectValue(document.precomputedTraits);
  const precomputedNormalizedSpecs = normalizedDeviceSpecs(
    precomputedTraits.normalizedSpecs ?? precomputedTraits.specs ?? document.normalizedSpecs,
  );
  const precomputedTraitRatings = traitRatings(
    precomputedTraits.traitRatings ?? precomputedTraits.ratings ?? precomputedTraits.traits ?? document.traitRatings,
  );
  const precomputedTraitConfidence = numberValue(
    precomputedTraits.traitConfidence ?? precomputedTraits.confidence ?? document.traitConfidence,
  );
  const rawDevice: RawCatalogDevice = {
    id: stringValue(document.id, objectId),
    category: rawCategory,
    brand,
    model,
    displayName,
    releaseYear: numberValue(document.releaseYear),
    aliases: stringArrayValue(document.aliases),
    generation: stringValue(document.generation) || undefined,
    lifecycleStatus:
      document.lifecycleStatus === "current" ||
      document.lifecycleStatus === "recent" ||
      document.lifecycleStatus === "older" ||
      document.lifecycleStatus === "discontinued" ||
      document.lifecycleStatus === "unknown"
        ? document.lifecycleStatus
        : undefined,
    estimatedPriceCents: numberValue(document.estimatedPriceCents) ?? 0,
    typicalUsedPriceCents: numberValue(document.typicalUsedPriceCents),
    specs: deviceSpecs(document.specs),
    ergonomicSpecs: ergonomicSpecsFromUnknown(document.ergonomicSpecs, {
      category: rawCategory,
      specs: deviceSpecs(document.specs),
    }),
    normalizedSpecs: hasObjectKeys(precomputedNormalizedSpecs) ? precomputedNormalizedSpecs : normalizedDeviceSpecs(document.normalizedSpecs),
    traitRatings: hasObjectKeys(precomputedTraitRatings) ? precomputedTraitRatings : traitRatings(document.traitRatings),
    traitConfidence: precomputedTraitConfidence ?? numberValue(document.traitConfidence),
    sourceUrls: stringArrayValue(document.sourceUrls),
    lastVerifiedAt: stringValue(document.lastVerifiedAt) || undefined,
    searchQueries: [...stringArrayValue(document.searchQueries), searchText].filter(Boolean),
  };

  const enriched = enrichCatalogDevice(rawDevice);

  return {
    _id: objectId,
    ...enriched,
    normalizedSpecs: hasObjectKeys(precomputedNormalizedSpecs) ? precomputedNormalizedSpecs : enriched.normalizedSpecs,
    traitRatings: hasObjectKeys(precomputedTraitRatings) ? precomputedTraitRatings : enriched.traitRatings,
    traitConfidence: precomputedTraitConfidence ?? enriched.traitConfidence,
    strengths: stringArrayValue(precomputedTraits.strengths).length
      ? stringArrayValue(precomputedTraits.strengths)
      : enriched.strengths,
    weaknesses: stringArrayValue(precomputedTraits.weaknesses).length
      ? stringArrayValue(precomputedTraits.weaknesses)
      : enriched.weaknesses,
    searchText: searchText || undefined,
  };
}

function serializeDevice(device: MongoCatalogDevice): MongoCatalogDevice {
  return {
    _id: device._id,
    id: device.id,
    category: device.category,
    brand: device.brand,
    model: device.model,
    displayName: device.displayName,
    releaseYear: device.releaseYear,
    aliases: device.aliases,
    generation: device.generation,
    lifecycleStatus: device.lifecycleStatus,
    estimatedPriceCents: device.estimatedPriceCents,
    typicalUsedPriceCents: device.typicalUsedPriceCents,
    specs: device.specs,
    ergonomicSpecs: device.ergonomicSpecs,
    normalizedSpecs: device.normalizedSpecs,
    traitRatings: device.traitRatings,
    traitConfidence: device.traitConfidence,
    sourceUrls: device.sourceUrls,
    lastVerifiedAt: device.lastVerifiedAt,
    searchQueries: device.searchQueries,
    strengths: device.strengths,
    weaknesses: device.weaknesses,
    searchText: device.searchText,
  };
}

async function getDeviceCollection() {
  const database = await getMongoDatabase();
  return database.collection<MongoDeviceDocument>(DEVICE_COLLECTION);
}

export async function findMongoDeviceById(id: string | null | undefined): Promise<MongoCatalogDevice | null> {
  if (!id) return null;

  const collection = await getDeviceCollection();
  const document = await collection.findOne({
    $or: [{ id }, ...objectIdFilter(id)],
  });

  return document ? normalizeMongoDevice(document) : null;
}

export async function searchMongoDevices(input: {
  q?: string | null;
  category?: string | null;
  brand?: string | null;
  limit?: string | number | null;
  id?: string | null;
}): Promise<MongoCatalogDevice[]> {
  if (input.id) {
    const device = await findMongoDeviceById(input.id);
    return device ? [serializeDevice(device)] : [];
  }

  const limit = clampLimit(input.limit);
  const category = input.category && (DEVICE_CATEGORIES as readonly string[]).includes(input.category) ? input.category : null;
  const brand = input.brand?.trim();
  const query = input.q?.trim();
  const filter: Filter<MongoDeviceDocument> = {};

  if (category) filter.category = category as DeviceCategory;
  if (brand) filter.brand = { $regex: `^${escapeRegex(brand)}$`, $options: "i" };

  if (query) {
    const tokens = query
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);

    filter.$and = tokens.map((token) => {
      const regex = { $regex: escapeRegex(token), $options: "i" };
      return {
        $or: [
          { brand: regex },
          { model: regex },
          { displayName: regex },
          { aliases: regex },
          { searchText: regex },
          { searchQueries: regex },
        ],
      };
    });
  }

  const collection = await getDeviceCollection();
  const documents = await collection
    .find(filter)
    .limit(query ? SEARCH_PREFETCH_LIMIT : limit)
    .sort({ brand: 1, model: 1 })
    .toArray();
  const devices = documents.flatMap((document) => {
    const device = normalizeMongoDevice(document);
    return device ? [device] : [];
  });

  if (!query) return devices.slice(0, limit).map(serializeDevice);

  return searchDevices(devices, { text: query, category: category ?? undefined, limit }).map((result) =>
    serializeDevice(result.device as MongoCatalogDevice),
  );
}

export async function listMongoCatalogDevices(input: {
  categories?: readonly string[];
  limit?: string | number | null;
} = {}): Promise<MongoCatalogDevice[]> {
  const limit = clampCatalogLimit(input.limit);
  const categories = input.categories?.filter((category): category is DeviceCategory => isDeviceCategory(category)) ?? [];
  const filter: Filter<MongoDeviceDocument> = {};

  if (categories.length > 0) {
    filter.category = { $in: categories };
  }

  const collection = await getDeviceCollection();
  const documents = await collection
    .find(filter)
    .sort({ category: 1, brand: 1, model: 1 })
    .limit(limit)
    .toArray();

  return documents.flatMap((document) => {
    const device = normalizeMongoDevice(document);
    return device ? [serializeDevice(device)] : [];
  });
}
