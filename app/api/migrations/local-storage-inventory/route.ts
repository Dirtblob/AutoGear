import { NextResponse } from "next/server";
import {
  getMongoMigrationDb,
  upsertInventoryMigrationBatch,
  validateInventoryMigrationInputs,
  type InventoryMigrationInput,
  type RawInventoryMigrationRecord,
  type RawUserMigrationRecord,
  type UserMigrationInput,
} from "@/lib/mongodb/inventoryMigration";
import { seedMongoDeviceCatalog } from "@/lib/mongodb/deviceCatalogSeed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LocalStorageImportPayload {
  user?: RawUserMigrationRecord;
  profile?: RawUserMigrationRecord;
  users?: RawUserMigrationRecord[];
  inventory?: RawInventoryMigrationRecord[];
  inventoryItems?: RawInventoryMigrationRecord[];
  items?: RawInventoryMigrationRecord[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function parsePayload(payload: unknown): { users: UserMigrationInput[]; inventoryItems: InventoryMigrationInput[] } {
  if (!isObject(payload)) {
    return { users: [], inventoryItems: [] };
  }

  const typedPayload = payload as LocalStorageImportPayload;
  const singleUser = typedPayload.user ?? typedPayload.profile;
  const users = [
    ...(singleUser ? [singleUser] : []),
    ...asArray<RawUserMigrationRecord>(typedPayload.users),
  ].map((raw) => ({
    source: "localStorage",
    raw,
  }));

  const fallbackUserId =
    typeof singleUser?.id === "string"
      ? singleUser.id
      : typeof singleUser?._id === "string"
        ? singleUser._id
        : users[0]?.raw.id && typeof users[0].raw.id === "string"
          ? users[0].raw.id
          : undefined;

  const inventoryItems = [
    ...asArray<RawInventoryMigrationRecord>(typedPayload.inventory),
    ...asArray<RawInventoryMigrationRecord>(typedPayload.inventoryItems),
    ...asArray<RawInventoryMigrationRecord>(typedPayload.items),
  ].map((raw) => ({
    source: "localStorage",
    raw,
    fallbackUserId,
  }));

  return { users, inventoryItems };
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { users, inventoryItems } = parsePayload(body);
  const validation = validateInventoryMigrationInputs(users, inventoryItems);

  if (!validation.data) {
    return NextResponse.json(
      { error: "Invalid localStorage migration payload.", fields: validation.errors },
      { status: 400 },
    );
  }

  if (users.length === 0 && inventoryItems.length === 0) {
    return NextResponse.json(
      { error: "No user or inventory records were found in the localStorage export payload." },
      { status: 400 },
    );
  }

  try {
    const db = await getMongoMigrationDb();
    const summary = await upsertInventoryMigrationBatch(validation.data.users, validation.data.inventoryItems);
    const deviceSummary = await seedMongoDeviceCatalog(db);

    return NextResponse.json({
      ok: true,
      source: "localStorage",
      receivedUsers: validation.data.users.length,
      receivedInventoryItems: validation.data.inventoryItems.length,
      migratedCounts: {
        users: validation.data.users.length,
        inventoryItems: validation.data.inventoryItems.length,
        devices: deviceSummary.read,
      },
      deviceCatalog: deviceSummary,
      ...summary,
    });
  } catch (error) {
    console.error("Failed to import localStorage inventory into MongoDB", error);
    return NextResponse.json({ error: "MongoDB import failed." }, { status: 500 });
  }
}
