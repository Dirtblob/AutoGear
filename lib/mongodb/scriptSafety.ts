import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ObjectId, type Db, type Document } from "mongodb";

// `device_catalog` is global shared data for every user. Seed and index scripts
// should treat it like a shared catalog, not like user-owned records.
export const GLOBAL_SHARED_COLLECTIONS = ["device_catalog"] as const;

// `inventory_items`, `user_private_profiles`, and `recommendation_logs` contain
// per-user/private data and must be handled with extra care during backups,
// migrations, verification cleanup, and any other write operation.
export const PRIVATE_USER_COLLECTIONS = [
  "inventory_items",
  "user_private_profiles",
  "recommendation_logs",
] as const;

export function timestampSlug(date = new Date()): string {
  return date.toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

export function scriptNameFromPath(scriptPath = process.argv[1] ?? "unknown-script"): string {
  return path.basename(scriptPath);
}

export function toJsonSafe(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof ObjectId) return value.toHexString();
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

export function printMongoWriteTarget(input: {
  dbName: string;
  collections: string[];
  action: string;
  scriptPath?: string;
}): void {
  console.log(
    JSON.stringify(
      {
        action: input.action,
        script: scriptNameFromPath(input.scriptPath),
        databaseName: input.dbName,
        collections: input.collections,
      },
      null,
      2,
    ),
  );
}

export function assertDangerousDbOperationAllowed(input: {
  dbName: string;
  collections: string[];
  scriptPath?: string;
}): void {
  const scriptName = scriptNameFromPath(input.scriptPath);
  const confirmed = process.env.CONFIRM_DANGEROUS_DB_OPERATION === "true";

  if (!scriptName.includes("dangerous")) {
    throw new Error(
      `Refusing dangerous database operation in "${scriptName}". Rename the script to include "dangerous" and set CONFIRM_DANGEROUS_DB_OPERATION=true.`,
    );
  }

  if (!confirmed) {
    throw new Error(
      `Refusing dangerous database operation in "${scriptName}" for ${input.dbName}/${input.collections.join(", ")}. Set CONFIRM_DANGEROUS_DB_OPERATION=true to continue.`,
    );
  }
}

export async function backupMongoCollections(input: {
  db: Db;
  collectionNames: string[];
  backupLabel: string;
  outputFolder?: string;
  queriesByCollection?: Partial<Record<string, Document>>;
}): Promise<{
  outputDir: string;
  collections: Array<{ collection: string; exported: boolean; count: number; file?: string }>;
}> {
  const outputDir = path.join(
    process.cwd(),
    input.outputFolder ?? "migration-backups",
    `${timestampSlug()}-${input.backupLabel}`,
  );
  const existingCollections = new Set((await input.db.listCollections({}, { nameOnly: true }).toArray()).map((entry) => entry.name));
  const summary: Array<{ collection: string; exported: boolean; count: number; file?: string }> = [];

  await mkdir(outputDir, { recursive: true });

  for (const collectionName of input.collectionNames) {
    if (!existingCollections.has(collectionName)) {
      summary.push({ collection: collectionName, exported: false, count: 0 });
      continue;
    }

    const query = input.queriesByCollection?.[collectionName] ?? {};
    const documents = await input.db.collection<Document>(collectionName).find(query).toArray();
    const filePath = path.join(outputDir, `${collectionName}.json`);

    await writeFile(
      filePath,
      JSON.stringify(
        {
          databaseName: input.db.databaseName,
          collection: collectionName,
          query: toJsonSafe(query),
          exportedAt: new Date().toISOString(),
          count: documents.length,
          documents: documents.map((document) => toJsonSafe(document)),
        },
        null,
        2,
      ),
      "utf8",
    );

    summary.push({
      collection: collectionName,
      exported: true,
      count: documents.length,
      file: filePath,
    });
  }

  return { outputDir, collections: summary };
}
