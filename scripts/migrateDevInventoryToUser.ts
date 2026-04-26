import { ObjectId } from "mongodb";
import {
  closeMongoMigrationClient,
  getMongoMigrationDb,
} from "../lib/mongodb/inventoryMigration";
import {
  backupMongoCollections,
  printMongoWriteTarget,
} from "../lib/mongodb/scriptSafety";

interface MongoUserDocument {
  _id: string;
  authProvider?: string;
  authUserId?: string;
  email?: string | null;
  displayName?: string | null;
}

type InventoryDocument = Record<string, unknown> & {
  _id: ObjectId | string;
  userId?: unknown;
  authUserId?: unknown;
};

function requireTargetClerkUserId(): string {
  const value = process.env.TARGET_CLERK_USER_ID?.trim();
  if (!value) {
    throw new Error("Set TARGET_CLERK_USER_ID before running this migration.");
  }

  return value;
}

async function main(): Promise<void> {
  const targetClerkUserId = requireTargetClerkUserId();
  const db = await getMongoMigrationDb();
  const users = db.collection<MongoUserDocument>("users");
  // `inventory_items` is per-user/private data, so migrations must create a
  // backup before reassigning ownership.
  const inventory = db.collection<InventoryDocument>("inventory_items");
  const targetUser = await users.findOne({
    authProvider: "clerk",
    authUserId: targetClerkUserId,
  });

  if (!targetUser?._id) {
    throw new Error(`Could not find a Mongo user for Clerk user "${targetClerkUserId}".`);
  }

  const legacyInventoryQuery = {
    authUserId: { $exists: false },
    $or: [
      { userId: { $exists: false } },
      { userId: null },
      { userId: "" },
      { userId: "dev-user" },
    ],
  };

  const matchingRecords = await inventory.find(legacyInventoryQuery).toArray();
  const backup = await backupMongoCollections({
    db,
    collectionNames: ["inventory_items"],
    backupLabel: `dev-inventory-to-${targetClerkUserId}`,
    queriesByCollection: {
      inventory_items: legacyInventoryQuery,
    },
  });

  let updatedCount = 0;
  if (matchingRecords.length > 0) {
    printMongoWriteTarget({
      dbName: db.databaseName,
      collections: ["inventory_items"],
      action: "prepare-write",
    });
    const recordIds = matchingRecords.map((record) => record._id);
    const result = await inventory.updateMany(
      { _id: { $in: recordIds } },
      {
        $set: {
          userId: targetUser._id,
          updatedAt: new Date(),
        },
      },
    );
    updatedCount = result.modifiedCount;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        databaseName: db.databaseName,
        targetClerkUserId,
        targetMongoUserId: targetUser._id,
        found: matchingRecords.length,
        backedUp: matchingRecords.length,
        updated: updatedCount,
        backupDir: backup.outputDir,
        backupCollections: backup.collections,
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
