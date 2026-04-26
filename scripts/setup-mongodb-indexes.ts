import {
  closeMongoMigrationClient,
  getMongoMigrationDb,
} from "../lib/mongodb/inventoryMigration";
import { setupMongoIndexes } from "../lib/mongodb/indexSetup";
import { printMongoWriteTarget } from "../lib/mongodb/scriptSafety";

async function main(): Promise<void> {
  const db = await getMongoMigrationDb();
  printMongoWriteTarget({
    dbName: db.databaseName,
    collections: ["users", "user_private_profiles", "inventory_items", "device_catalog", "recommendation_logs"],
    action: "prepare-write",
  });
  const summary = await setupMongoIndexes(db);

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
