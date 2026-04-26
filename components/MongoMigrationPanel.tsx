"use client";

import { useEffect, useMemo, useState } from "react";

type JsonRecord = Record<string, unknown>;

type RawUserMigrationRecord = JsonRecord;

type RawInventoryMigrationRecord = JsonRecord;

interface LocalStorageSnapshot {
  exportedAt: string;
  keys: Array<{
    key: string;
    value: unknown;
  }>;
  user?: RawUserMigrationRecord;
  users: RawUserMigrationRecord[];
  inventory: RawInventoryMigrationRecord[];
}

interface ImportResponse {
  ok: boolean;
  error?: string;
  fields?: Record<string, string>;
  source?: string;
  receivedUsers?: number;
  receivedInventoryItems?: number;
  migratedCounts?: {
    users: number;
    inventoryItems: number;
    devices: number;
  };
}

function isObject(value: unknown): value is JsonRecord {
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

function parseStoredValue(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function scanValue(
  value: unknown,
  users: RawUserMigrationRecord[],
  inventory: RawInventoryMigrationRecord[],
  fallbackUserId?: string,
): void {
  if (looksLikeUser(value)) {
    users.push(value);
    const nextFallbackUserId =
      typeof value.id === "string"
        ? value.id
        : typeof value._id === "string"
          ? value._id
          : fallbackUserId;

    for (const key of ["inventory", "inventoryItems", "inventory_items", "items"]) {
      for (const item of asArray<unknown>(value[key])) {
        if (looksLikeInventoryItem(item)) {
          inventory.push(nextFallbackUserId ? { userProfileId: nextFallbackUserId, ...item } : item);
        }
      }
    }
  }

  if (looksLikeInventoryItem(value)) {
    inventory.push(fallbackUserId ? { userProfileId: fallbackUserId, ...value } : value);
  }

  if (Array.isArray(value)) {
    value.forEach((item) => scanValue(item, users, inventory, fallbackUserId));
    return;
  }

  if (!isObject(value)) return;

  const nextFallbackUserId =
    typeof value.userProfileId === "string"
      ? value.userProfileId
      : typeof value.userId === "string"
        ? value.userId
        : fallbackUserId;

  for (const key of ["user", "profile"]) {
    const item = value[key];
    if (item !== undefined) scanValue(item, users, inventory, nextFallbackUserId);
  }

  for (const key of ["users", "userProfiles", "profiles"]) {
    asArray<unknown>(value[key]).forEach((item) => scanValue(item, users, inventory, nextFallbackUserId));
  }

  for (const key of ["inventory", "inventoryItems", "inventory_items", "items"]) {
    asArray<unknown>(value[key]).forEach((item) => scanValue(item, users, inventory, nextFallbackUserId));
  }
}

function readLocalStorageSnapshot(): LocalStorageSnapshot {
  const keys: LocalStorageSnapshot["keys"] = [];
  const users: RawUserMigrationRecord[] = [];
  const inventory: RawInventoryMigrationRecord[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;

    const rawValue = window.localStorage.getItem(key);
    if (rawValue === null) continue;

    const value = parseStoredValue(rawValue);
    keys.push({ key, value });
    scanValue(value, users, inventory);
  }

  return {
    exportedAt: new Date().toISOString(),
    keys,
    user: users[0],
    users,
    inventory,
  };
}

function dedupeRecords(records: JsonRecord[]): JsonRecord[] {
  const seen = new Set<string>();
  const deduped: JsonRecord[] = [];

  for (const record of records) {
    const signature = JSON.stringify(record);
    if (seen.has(signature)) continue;
    seen.add(signature);
    deduped.push(record);
  }

  return deduped;
}

function downloadBackup(snapshot: LocalStorageSnapshot): string {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const timestamp = snapshot.exportedAt.replaceAll(":", "-");
  anchor.href = url;
  anchor.download = `lifeupgrade-local-backup-${timestamp}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  return anchor.download;
}

export function MongoMigrationPanel() {
  const [snapshot, setSnapshot] = useState<LocalStorageSnapshot | null>(null);
  const [status, setStatus] = useState("Checking browser localStorage for legacy data.");
  const [isMigrating, setIsMigrating] = useState(false);
  const [lastBackupFile, setLastBackupFile] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);

  useEffect(() => {
    const nextSnapshot = readLocalStorageSnapshot();
    setSnapshot({
      ...nextSnapshot,
      users: dedupeRecords(nextSnapshot.users),
      inventory: dedupeRecords(nextSnapshot.inventory),
    });
    setStatus("Legacy browser storage scan complete.");
  }, []);

  const summary = useMemo(() => {
    if (!snapshot) {
      return {
        keyCount: 0,
        userCount: 0,
        inventoryCount: 0,
      };
    }

    return {
      keyCount: snapshot.keys.length,
      userCount: snapshot.users.length,
      inventoryCount: snapshot.inventory.length,
    };
  }, [snapshot]);

  async function migrate(): Promise<void> {
    if (!snapshot) return;

    if (summary.userCount === 0 && summary.inventoryCount === 0) {
      setStatus("No legacy user or inventory payloads were found in localStorage.");
      return;
    }

    setIsMigrating(true);
    setResult(null);

    try {
      const backupFile = downloadBackup(snapshot);
      setLastBackupFile(backupFile);
      setStatus(`Backup saved as ${backupFile}. Importing into MongoDB...`);

      const response = await fetch("/api/migrations/local-storage-inventory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user: snapshot.user,
          users: snapshot.users,
          inventory: snapshot.inventory,
        }),
      });

      const data = (await response.json()) as ImportResponse;
      setResult(data);

      if (!response.ok || !data.ok) {
        setStatus(data.error ?? "Migration failed.");
        return;
      }

      setStatus(
        `Migration finished. Users: ${data.migratedCounts?.users ?? 0}, inventory items: ${data.migratedCounts?.inventoryItems ?? 0}, devices: ${data.migratedCounts?.devices ?? 0}.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Migration failed.");
    } finally {
      setIsMigrating(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-soft">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-moss">MongoDB migration</p>
      <h2 className="mt-3 text-2xl font-semibold">Export legacy browser data and import it safely.</h2>
      <p className="mt-3 max-w-3xl leading-7 text-ink/65">
        This checks browser localStorage for older profile and inventory payloads, downloads a backup JSON first, then
        imports the exported data into MongoDB through the server migration endpoint.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-mist p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">localStorage keys</p>
          <p className="mt-2 text-2xl font-semibold">{summary.keyCount}</p>
        </div>
        <div className="rounded-2xl bg-mist p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Exportable users</p>
          <p className="mt-2 text-2xl font-semibold">{summary.userCount}</p>
        </div>
        <div className="rounded-2xl bg-mist p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Exportable inventory items</p>
          <p className="mt-2 text-2xl font-semibold">{summary.inventoryCount}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={migrate}
          disabled={isMigrating || !snapshot}
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-moss disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isMigrating ? "Backing up and migrating..." : "Backup JSON and migrate to MongoDB"}
        </button>
        <button
          type="button"
          onClick={() => {
            const nextSnapshot = readLocalStorageSnapshot();
            setSnapshot({
              ...nextSnapshot,
              users: dedupeRecords(nextSnapshot.users),
              inventory: dedupeRecords(nextSnapshot.inventory),
            });
            setStatus("Legacy browser storage re-scanned.");
          }}
          className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink/70 transition hover:bg-mist"
        >
          Re-scan browser storage
        </button>
      </div>

      <div className="mt-5 rounded-2xl bg-mist p-4 text-sm leading-6 text-ink/70">
        <p>{status}</p>
        {lastBackupFile ? <p className="mt-2">Backup file: {lastBackupFile}</p> : null}
        {result?.fields ? (
          <div className="mt-3">
            <p className="font-semibold text-ink">Validation errors</p>
            <ul className="mt-2 space-y-1">
              {Object.entries(result.fields).slice(0, 8).map(([field, message]) => (
                <li key={field}>
                  {field}: {message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {result?.migratedCounts ? (
          <div className="mt-3">
            <p className="font-semibold text-ink">Migrated totals</p>
            <p className="mt-2">
              Users: {result.migratedCounts.users} | Inventory items: {result.migratedCounts.inventoryItems} | Devices: {result.migratedCounts.devices}
            </p>
          </div>
        ) : null}
      </div>

      {snapshot?.keys.length ? (
        <div className="mt-5 rounded-2xl border border-ink/8 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Detected localStorage keys</p>
          <p className="mt-2 text-sm leading-6 text-ink/65">{snapshot.keys.map(({ key }) => key).join(", ")}</p>
        </div>
      ) : null}
    </section>
  );
}
