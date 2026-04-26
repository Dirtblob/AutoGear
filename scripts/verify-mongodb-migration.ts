import { ObjectId, type Db } from "mongodb";
import {
  closeMongoMigrationClient,
  getMongoMigrationClient,
  getMongoMigrationConfig,
  getMongoMigrationDb,
  upsertInventoryMigrationRecords,
} from "../lib/mongodb/inventoryMigration";
import { setupMongoIndexes } from "../lib/mongodb/indexSetup";
import { printMongoWriteTarget } from "../lib/mongodb/scriptSafety";
import { seedMongoDeviceCatalog } from "../lib/mongodb/deviceCatalogSeed";
import { deviceToRecommendationProduct } from "../lib/recommendation/deviceProductMapping";
import { rankProductsForInput } from "../lib/recommendation/productEngine";
import type { InventoryItem, Product, UserProfile } from "../lib/recommendation/types";

interface VerificationStep {
  name: string;
  ok: boolean;
  detail: Record<string, unknown>;
}

interface InventoryApiItem {
  id: string;
  userId: string;
  category: string;
  brand: string | null;
  model: string | null;
  exactModel: string | null;
  condition: string;
  notes: string | null;
}

interface InventoryApiResponse {
  items?: InventoryApiItem[];
  item?: InventoryApiItem;
  ok?: boolean;
  error?: string;
}

interface DevicesApiResponse {
  devices?: Array<{
    _id: string;
    id: string;
    displayName: string;
    category: string;
    brand: string;
    model: string;
  }>;
  error?: string;
}

const appBaseUrl = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const verifyPrefix = `verify-mongo-${Date.now()}`;

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function recordStep(
  steps: VerificationStep[],
  name: string,
  verify: () => Promise<Record<string, unknown>>,
): Promise<void> {
  try {
    const detail = await verify();
    steps.push({ name, ok: true, detail });
    console.log(`ok - ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    steps.push({ name, ok: false, detail: { error: message } });
    console.error(`fail - ${name}: ${message}`);
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as T) : ({} as T);

  if (!response.ok) {
    const message = typeof (parsed as { error?: unknown }).error === "string" ? (parsed as { error: string }).error : text;
    throw new Error(`HTTP ${response.status}: ${message}`);
  }

  return parsed;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  return parseJsonResponse<T>(
    await fetch(`${appBaseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    }),
  );
}

async function verifyMongoConnection(): Promise<Record<string, unknown>> {
  const config = getMongoMigrationConfig();
  const client = await getMongoMigrationClient();
  const ping = await client.db("admin").command({ ping: 1 });

  return {
    databaseName: config.databaseName,
    atlasUriConfigured: config.uri.includes("mongodb+srv://") || config.uri.includes("mongodb.net"),
    ping,
  };
}

async function verifyIndexSetup(db: Db): Promise<Record<string, unknown>> {
  const summary = await setupMongoIndexes(db);
  const collections = Object.fromEntries(
    await Promise.all(
      ["users", "inventory_items", "device_catalog", "recommendation_logs"].map(async (collectionName) => [
        collectionName,
        (await db.collection(collectionName).indexes()).map((index) => index.name),
      ]),
    ),
  );

  return { summary, collections };
}

async function verifyDeviceSeed(db: Db): Promise<Record<string, unknown>> {
  const first = await seedMongoDeviceCatalog(db);
  const second = await seedMongoDeviceCatalog(db);
  const count = await db.collection("device_catalog").countDocuments();
  const ergonomicCount = await db.collection("device_catalog").countDocuments({ ergonomicSpecs: { $exists: true } });

  assertCondition(count >= first.read, "Device catalog count is smaller than the seed data set.");
  assertCondition(second.matched >= first.read, "Second device seed pass did not update existing records.");
  assertCondition(ergonomicCount > 0, "Device catalog seed did not backfill ergonomic specs.");

  return { first, second, count, ergonomicCount };
}

async function verifyInventoryMigration(db: Db): Promise<Record<string, unknown>> {
  const userId = `${verifyPrefix}-migration-user`;
  const inventoryId = `${verifyPrefix}-migration-item`;
  const source = "verify:mongodb-migration";
  const first = await upsertInventoryMigrationRecords(
    db,
    [
      {
        source,
        raw: {
          id: userId,
          name: "Mongo Verify User",
          profession: "Remote developer",
          budgetUsd: 650,
          problems: ["neck_pain", "eye_strain"],
          preferences: ["quiet", "ergonomic"],
        },
      },
    ],
    [
      {
        source,
        raw: {
          id: inventoryId,
          userProfileId: userId,
          category: "laptop",
          brand: "Apple",
          model: "MacBook Air M1 8GB",
          condition: "fair",
          notes: "Laptop-only setup causing neck strain.",
        },
      },
    ],
  );
  const second = await upsertInventoryMigrationRecords(
    db,
    [
      {
        source,
        raw: {
          id: userId,
          name: "Mongo Verify User",
          profession: "Remote developer",
          budgetUsd: 700,
          problems: ["neck_pain", "eye_strain", "low_productivity"],
          preferences: ["quiet", "ergonomic"],
        },
      },
    ],
    [
      {
        source,
        raw: {
          id: inventoryId,
          userProfileId: userId,
          category: "laptop",
          brand: "Apple",
          model: "MacBook Air M1 8GB",
          condition: "good",
          notes: "Updated migration pass.",
        },
      },
    ],
  );
  const migratedItem = await db
    .collection<Record<string, unknown> & { _id: string; condition?: string }>("inventory_items")
    .findOne({ _id: inventoryId });

  assertCondition(first.usersInserted + first.usersMatched > 0, "User migration did not write a user.");
  assertCondition(first.inventoryInserted + first.inventoryMatched > 0, "Inventory migration did not write an item.");
  assertCondition(second.inventoryMatched > 0, "Second inventory migration pass did not match the existing item.");
  assertCondition(migratedItem?.condition === "good", "Inventory migration update did not persist the changed condition.");

  return { first, second, migratedItemCondition: migratedItem.condition };
}

async function verifyDevicesApi(): Promise<Record<string, unknown>> {
  const data = await fetchJson<DevicesApiResponse>("/api/devices?q=Logitech&limit=5");
  const devices = data.devices ?? [];

  assertCondition(devices.length > 0, "GET /api/devices returned no dropdown devices.");
  assertCondition(devices.every((device) => device._id && device.displayName), "Device dropdown rows are missing ids or labels.");

  return { count: devices.length, sample: devices[0] };
}

async function verifyInventoryApis(db: Db): Promise<Record<string, unknown>> {
  const otherUserId = `${verifyPrefix}-other-user`;
  const otherItemId = new ObjectId();

  await db.collection("inventory_items").insertOne({
    _id: otherItemId,
    id: otherItemId.toHexString(),
    userId: otherUserId,
    userProfileId: otherUserId,
    sourceKey: `verify:other:${otherItemId.toHexString()}`,
    category: "mouse",
    brand: "Other",
    model: "Private User Mouse",
    exactModel: null,
    catalogProductId: null,
    specsJson: null,
    condition: "GOOD",
    ageYears: 1,
    notes: "This item must not leak into the current user's inventory response.",
    source: "MANUAL",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const created = await fetchJson<InventoryApiResponse>("/api/inventory", {
    method: "POST",
    body: JSON.stringify({
      category: "laptop",
      brand: "Apple",
      model: "MacBook Air M1 8GB",
      exactModel: "Apple MacBook Air M1 8GB",
      condition: "FAIR",
      ageYears: 5,
      notes: `${verifyPrefix} laptop-only verification item`,
      source: "MANUAL",
    }),
  });
  const createdItem = created.item;
  assertCondition(createdItem?.id, "POST /api/inventory did not return a created item.");

  const listed = await fetchJson<InventoryApiResponse>("/api/inventory");
  const items = listed.items ?? [];
  assertCondition(items.some((item) => item.id === createdItem.id), "GET /api/inventory did not include the created item.");
  assertCondition(!items.some((item) => item.id === otherItemId.toHexString()), "GET /api/inventory leaked another user's item.");

  const patched = await fetchJson<InventoryApiResponse>(`/api/inventory/${createdItem.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      notes: `${verifyPrefix} patched inventory item`,
      condition: "GOOD",
    }),
  });
  assertCondition(patched.item?.condition === "GOOD", "PATCH /api/inventory/[id] did not update the item.");

  const recommendationItem = await fetchJson<InventoryApiResponse>("/api/inventory", {
    method: "POST",
    body: JSON.stringify({
      category: "laptop",
      brand: "Apple",
      model: "MacBook Air M1 8GB",
      exactModel: "Apple MacBook Air M1 8GB",
      condition: "FAIR",
      ageYears: 5,
      notes: `${verifyPrefix} recommendation fixture with neck pain and low productivity`,
      source: "MANUAL",
    }),
  });
  assertCondition(recommendationItem.item?.id, "Failed to create recommendation fixture inventory item.");

  const deleted = await fetchJson<InventoryApiResponse>(`/api/inventory/${createdItem.id}`, {
    method: "DELETE",
  });
  assertCondition(deleted.ok === true, "DELETE /api/inventory/[id] did not report success.");

  return {
    apiUserId: createdItem.userId,
    createdItemId: createdItem.id,
    recommendationItemId: recommendationItem.item.id,
    listedCount: items.length,
    otherUserItemExcluded: true,
  };
}

function mapMongoInventoryToRecommendationItem(document: Record<string, unknown>): InventoryItem {
  const name = [document.brand, document.model].filter((value) => typeof value === "string" && value.trim()).join(" ");

  return {
    id: String(document._id),
    name: name || String(document.category ?? "device"),
    category: String(document.category ?? "unknown") as InventoryItem["category"],
    condition: String(document.condition ?? "unknown").toLowerCase() as InventoryItem["condition"],
    painPoints: ["neck_pain", "low_productivity"],
    specs: typeof document.specsJson === "string" ? JSON.parse(document.specsJson) as Record<string, unknown> : undefined,
  };
}

async function verifyMongoRecommendations(db: Db, apiUserId: string): Promise<Record<string, unknown>> {
  const deviceDocuments = await db
    .collection("device_catalog")
    .find({ category: { $in: ["laptop_stand", "monitor", "laptop", "keyboard", "mouse", "chair", "desk_lamp"] } })
    .limit(250)
    .toArray();
  const candidateProducts = deviceDocuments
    .map((document) => deviceToRecommendationProduct({ ...document, _id: String(document._id) } as never))
    .filter((product): product is Product => Boolean(product));
  const inventoryDocuments = await db
    .collection("inventory_items")
    .find({ userId: apiUserId, notes: { $regex: verifyPrefix } })
    .toArray();
  const inventory = inventoryDocuments.map(mapMongoInventoryToRecommendationItem);
  const profile: UserProfile = {
    id: apiUserId,
    name: "Mongo Verify",
    ageRange: "25-34",
    profession: "Remote developer",
    budgetUsd: 500,
    spendingStyle: "balanced",
    preferences: ["ergonomic", "quiet"],
    problems: ["neck_pain", "eye_strain", "low_productivity"],
    accessibilityNeeds: [],
    roomConstraints: ["limited_desk_width"],
    constraints: {
      deskWidthInches: 42,
      roomLighting: "mixed",
      sharesSpace: true,
      portableSetup: false,
    },
  };
  const recommendations = rankProductsForInput({ profile, inventory, candidateProducts }).slice(0, 8);

  assertCondition(candidateProducts.length > 0, "No MongoDB device catalog products were available for recommendations.");
  assertCondition(inventory.length > 0, "No MongoDB inventory items were available for recommendations.");
  assertCondition(recommendations.length > 0, "Recommendation engine returned no MongoDB-backed recommendations.");
  assertCondition(recommendations.some((recommendation) => recommendation.product.category === "laptop_stand"), "Expected a laptop stand recommendation from MongoDB data.");

  return {
    candidateProductCount: candidateProducts.length,
    inventoryCount: inventory.length,
    topRecommendations: recommendations.slice(0, 5).map((recommendation) => ({
      productId: recommendation.product.id,
      name: recommendation.product.name,
      category: recommendation.product.category,
      score: recommendation.score,
    })),
  };
}

async function main(): Promise<void> {
  const steps: VerificationStep[] = [];
  let apiUserId: string | null = null;
  const db = await getMongoMigrationDb();
  printMongoWriteTarget({
    dbName: db.databaseName,
    collections: ["users", "inventory_items", "device_catalog", "recommendation_logs"],
    action: "prepare-write",
  });

  await recordStep(steps, "MongoDB Atlas connection", verifyMongoConnection);
  await recordStep(steps, "MongoDB index setup", () => verifyIndexSetup(db));
  await recordStep(steps, "Device catalog seed inserts and updates", () => verifyDeviceSeed(db));
  await recordStep(steps, "Inventory migration inserts and updates", () => verifyInventoryMigration(db));
  await recordStep(steps, "GET /api/devices returns dropdown devices", verifyDevicesApi);
  await recordStep(steps, "GET/POST/PATCH/DELETE /api/inventory", async () => {
    const detail = await verifyInventoryApis(db);
    apiUserId = String(detail.apiUserId);
    return detail;
  });
  await recordStep(steps, "Recommendations work with MongoDB data", async () => {
    assertCondition(apiUserId, "Inventory API verification did not produce an API user id.");
    return verifyMongoRecommendations(db, apiUserId);
  });

  const failed = steps.filter((step) => !step.ok);
  console.log(
    JSON.stringify(
      {
        ok: failed.length === 0,
        appBaseUrl,
        verifyPrefix,
        cleanupNote:
          "Verification fixtures are intentionally retained so this script avoids dangerous cleanup operations. Remove them manually or use a separately confirmed dangerous cleanup script if needed.",
        steps,
      },
      null,
      2,
    ),
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoMigrationClient();
  });
