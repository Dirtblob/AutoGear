import {
  closeMongoMigrationClient,
  getMongoMigrationDb,
} from "../lib/mongodb/inventoryMigration";
import {
  GLOBAL_SHARED_COLLECTIONS,
  PRIVATE_USER_COLLECTIONS,
  backupMongoCollections,
} from "../lib/mongodb/scriptSafety";

const collectionNames = [
  "users",
  "user_private_profiles",
  "inventory_items",
  "device_catalog",
  "recommendation_logs",
] as const;

async function main(): Promise<void> {
  const db = await getMongoMigrationDb();
  const backup = await backupMongoCollections({
    db,
    collectionNames: [...collectionNames],
    backupLabel: "manual-backup",
    outputFolder: "backups",
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        databaseName: db.databaseName,
        outputDir: backup.outputDir,
        collections: backup.collections,
        collectionRoles: {
          globalSharedData: [...GLOBAL_SHARED_COLLECTIONS],
          perUserPrivateData: [...PRIVATE_USER_COLLECTIONS],
        },
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
