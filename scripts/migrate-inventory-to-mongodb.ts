import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  closeMongoMigrationClient,
  getMongoMigrationDb,
  upsertInventoryMigrationBatch,
  type InventoryMigrationInput,
  type RawInventoryMigrationRecord,
  type RawUserMigrationRecord,
  type UserMigrationInput,
} from "../lib/mongodb/inventoryMigration";
import {
  backupMongoCollections,
  printMongoWriteTarget,
} from "../lib/mongodb/scriptSafety";
import {
  hackathonDemoInventoryRecords,
  hackathonDemoProfile,
  serializeHackathonDemoProfile,
} from "../lib/recommendation/demoMode";

const prisma = new PrismaClient();
const repoRoot = process.cwd();
const sourceFileExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

interface SourceLoadResult {
  users: UserMigrationInput[];
  inventoryItems: InventoryMigrationInput[];
  summary: Record<string, unknown>;
}

interface JsonScanResult extends SourceLoadResult {
  scannedFiles: number;
  importedFiles: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function looksLikeUser(value: unknown): value is RawUserMigrationRecord {
  return (
    isObject(value) &&
    ("profession" in value ||
      "budgetCents" in value ||
      "budgetUsd" in value ||
      "spendingStyle" in value ||
      "problems" in value ||
      "preferences" in value)
  );
}

function looksLikeInventoryItem(value: unknown): value is RawInventoryMigrationRecord {
  return (
    isObject(value) &&
    ("category" in value || "brand" in value || "model" in value || "exactModel" in value) &&
    ("condition" in value || "source" in value || "notes" in value || "specs" in value || "specsJson" in value)
  );
}

function extractJsonRecords(parsed: unknown, source: string): SourceLoadResult {
  const users: UserMigrationInput[] = [];
  const inventoryItems: InventoryMigrationInput[] = [];

  function visit(value: unknown, fallbackUserId?: string): void {
    if (looksLikeUser(value)) {
      users.push({ source, raw: value });
      const rawId = typeof value.id === "string" ? value.id : typeof value._id === "string" ? value._id : fallbackUserId;

      for (const key of ["inventory", "inventoryItems", "items"]) {
        for (const item of asArray<unknown>(value[key])) {
          if (looksLikeInventoryItem(item)) {
            inventoryItems.push({ source, raw: item, fallbackUserId: rawId });
          }
        }
      }
    }

    if (looksLikeInventoryItem(value)) {
      inventoryItems.push({ source, raw: value, fallbackUserId });
    }

    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, fallbackUserId));
      return;
    }

    if (!isObject(value)) return;

    const objectFallbackUserId =
      typeof value.userProfileId === "string" ? value.userProfileId : typeof value.userId === "string" ? value.userId : fallbackUserId;

    for (const key of ["users", "userProfiles", "profiles"]) {
      asArray<unknown>(value[key]).forEach((item) => visit(item, objectFallbackUserId));
    }

    for (const key of ["inventory", "inventoryItems", "inventory_items", "items"]) {
      asArray<unknown>(value[key]).forEach((item) => visit(item, objectFallbackUserId));
    }
  }

  visit(parsed);

  return {
    users,
    inventoryItems,
    summary: {
      source,
      users: users.length,
      inventoryItems: inventoryItems.length,
    },
  };
}

async function walkFiles(root: string, predicate: (filePath: string) => boolean): Promise<string[]> {
  let entries;

  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      if (["node_modules", ".next", ".git", "dist", "coverage"].includes(entry.name)) continue;
      files.push(...(await walkFiles(fullPath, predicate)));
    } else if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

async function loadSqliteSource(): Promise<SourceLoadResult> {
  try {
    const profiles = await prisma.userProfile.findMany({
      include: { inventoryItems: true },
      orderBy: { createdAt: "asc" },
    });

    return {
      users: profiles.map(({ inventoryItems: _inventoryItems, ...profile }) => ({
        source: "sqlite:userProfile",
        raw: profile as RawUserMigrationRecord,
      })),
      inventoryItems: profiles.flatMap((profile) =>
        profile.inventoryItems.map((item) => ({
          source: "sqlite:inventoryItem",
          raw: item as RawInventoryMigrationRecord,
          fallbackUserId: profile.id,
        })),
      ),
      summary: {
        source: "sqlite",
        profiles: profiles.length,
        inventoryItems: profiles.reduce((count, profile) => count + profile.inventoryItems.length, 0),
      },
    };
  } catch (error) {
    return {
      users: [],
      inventoryItems: [],
      summary: {
        source: "sqlite",
        profiles: 0,
        inventoryItems: 0,
        skipped: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

function loadHardcodedDemoSource(): SourceLoadResult {
  const profile = {
    id: hackathonDemoProfile.id,
    ...serializeHackathonDemoProfile(),
  };

  return {
    users: [{ source: "hardcoded:demoMode", raw: profile }],
    inventoryItems: hackathonDemoInventoryRecords.map((item) => ({
      source: "hardcoded:demoMode",
      raw: {
        ...item,
        userProfileId: hackathonDemoProfile.id,
      },
      fallbackUserId: hackathonDemoProfile.id,
    })),
    summary: {
      source: "hardcodedDemo",
      profiles: 1,
      inventoryItems: hackathonDemoInventoryRecords.length,
    },
  };
}

async function loadJsonSources(): Promise<JsonScanResult> {
  const candidateRoots = ["data", "prisma", "tests"]
    .map((folder) => path.join(repoRoot, folder))
    .filter((folder) => !folder.includes("node_modules"));
  const files = (
    await Promise.all(
      candidateRoots.map((root) =>
        walkFiles(root, (filePath) => filePath.endsWith(".json") && !filePath.endsWith("package-lock.json")),
      ),
    )
  ).flat();
  const importedFiles: string[] = [];
  const users: UserMigrationInput[] = [];
  const inventoryItems: InventoryMigrationInput[] = [];

  for (const filePath of files) {
    try {
      const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
      const relativePath = path.relative(repoRoot, filePath);
      const extracted = extractJsonRecords(parsed, `json:${relativePath}`);

      if (extracted.users.length > 0 || extracted.inventoryItems.length > 0) {
        importedFiles.push(relativePath);
        users.push(...extracted.users);
        inventoryItems.push(...extracted.inventoryItems);
      }
    } catch {
      // Non-data JSON files are ignored; the migration summary reports how many candidates were scanned.
    }
  }

  return {
    users,
    inventoryItems,
    scannedFiles: files.length,
    importedFiles,
    summary: {
      source: "json",
      scannedFiles: files.length,
      importedFiles,
      users: users.length,
      inventoryItems: inventoryItems.length,
    },
  };
}

async function countLocalStorageReferences(): Promise<number> {
  const files = await walkFiles(repoRoot, (filePath) => sourceFileExtensions.has(path.extname(filePath)));
  let count = 0;

  for (const filePath of files) {
    if (filePath.includes(`${path.sep}app${path.sep}api${path.sep}migrations${path.sep}local-storage-inventory${path.sep}`)) {
      continue;
    }

    const source = await readFile(filePath, "utf8");
    if (source.includes("localStorage")) count += 1;
  }

  return count;
}

async function main(): Promise<void> {
  const [sqliteSource, jsonSource, localStorageReferenceCount] = await Promise.all([
    loadSqliteSource(),
    loadJsonSources(),
    countLocalStorageReferences(),
  ]);
  const hardcodedDemoSource = loadHardcodedDemoSource();
  const users = [...sqliteSource.users, ...hardcodedDemoSource.users, ...jsonSource.users];
  const inventoryItems = [
    ...sqliteSource.inventoryItems,
    ...hardcodedDemoSource.inventoryItems,
    ...jsonSource.inventoryItems,
  ];
  const db = await getMongoMigrationDb();
  // `inventory_items` is per-user/private data, so this migration always creates
  // a snapshot backup before it upserts anything into `users` or `inventory_items`.
  const backup = await backupMongoCollections({
    db,
    collectionNames: ["users", "inventory_items"],
    backupLabel: "inventory-migration-prewrite",
  });
  printMongoWriteTarget({
    dbName: db.databaseName,
    collections: ["users", "inventory_items"],
    action: "prepare-write",
  });

  const mongoSummary = await upsertInventoryMigrationBatch(users, inventoryItems);

  console.log(
    JSON.stringify(
      {
        ok: true,
        sources: {
          sqlite: sqliteSource.summary,
          hardcodedDemo: hardcodedDemoSource.summary,
          json: jsonSource.summary,
          localStorage: {
            sourceReferencesFound: localStorageReferenceCount,
            importEndpoint: "/api/migrations/local-storage-inventory",
          },
        },
        read: {
          users: users.length,
          inventoryItems: inventoryItems.length,
        },
        backup,
        mongo: mongoSummary,
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
    await prisma.$disconnect();
  });
