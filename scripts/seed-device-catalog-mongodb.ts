import {
  closeMongoMigrationClient,
  getMongoMigrationDb,
} from "../lib/mongodb/inventoryMigration";
import { setupMongoIndexes } from "../lib/mongodb/indexSetup";
import { printMongoWriteTarget } from "../lib/mongodb/scriptSafety";
import { seedMongoDeviceCatalog } from "../lib/mongodb/deviceCatalogSeed";

async function main(): Promise<void> {
  const db = await getMongoMigrationDb();
  printMongoWriteTarget({
    dbName: db.databaseName,
    collections: ["users", "user_private_profiles", "inventory_items", "device_catalog", "recommendation_logs"],
    action: "prepare-write",
  });

  await setupMongoIndexes(db);
  // `device_catalog` is global shared data, so the seed path uses upserts rather
  // than deleting and recreating rows.
  const summary = await seedMongoDeviceCatalog(db);

  console.log(JSON.stringify({ ok: true, mongo: summary }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoMigrationClient();
  });
