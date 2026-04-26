import { existsSync } from "node:fs";
import path from "node:path";
import { config as loadDotEnv } from "dotenv";
import { MongoClient, type Db } from "mongodb";
import { z } from "zod";
import { DEVICE_CATEGORIES, CATEGORY_DEVICE_TRAITS } from "@/lib/devices/deviceTypes";
import { normalizeInventoryCategories, normalizeUserPreferences, normalizeUserProblems } from "@/lib/recommendation/types";

const mongoClientCache = globalThis as typeof globalThis & {
  lifeUpgradeMongoClient?: MongoClient;
};

const allowedConditions = new Set(["poor", "fair", "good", "excellent", "unknown"]);
const allowedDeviceCategories = new Set<string>([...DEVICE_CATEGORIES, "storage", "cable_management", "other", "unknown"]);
const migrationConditionValues = ["poor", "fair", "good", "excellent", "unknown"] as const;
const MAX_PRICE_CENTS = 10_000_000;
const MAX_PRICE_USD = 100_000;

let envLoaded = false;

function loadStandaloneEnv(): void {
  if (envLoaded) return;
  envLoaded = true;

  const cwd = process.cwd();

  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(cwd, fileName);
    if (!existsSync(filePath)) continue;

    loadDotEnv({
      path: filePath,
      override: false,
    });
  }
}

function missingMongoEnvError(): Error {
  const cwd = process.cwd();
  const envPath = path.join(cwd, ".env");
  const envLocalPath = path.join(cwd, ".env.local");

  return new Error(
    [
      "Missing MongoDB connection env vars. Check .env or .env.local.",
      `cwd: ${cwd}`,
      `.env exists: ${existsSync(envPath)}`,
      `.env.local exists: ${existsSync(envLocalPath)}`,
      `MONGODB_URI exists: ${Boolean(process.env.MONGODB_URI?.trim())}`,
      `MONGO_URL exists: ${Boolean(process.env.MONGO_URL?.trim())}`,
      `MONGODB_DB_NAME exists: ${Boolean(process.env.MONGODB_DB_NAME?.trim())}`,
      `DB_NAME exists: ${Boolean(process.env.DB_NAME?.trim())}`,
    ].join("\n"),
  );
}

export interface RawUserMigrationRecord {
  id?: unknown;
  _id?: unknown;
  name?: unknown;
  ageRange?: unknown;
  profession?: unknown;
  budgetCents?: unknown;
  budgetUsd?: unknown;
  spendingStyle?: unknown;
  usedItemsOkay?: unknown;
  accessibilityNeeds?: unknown;
  preferences?: unknown;
  problems?: unknown;
  roomConstraints?: unknown;
  constraints?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  [key: string]: unknown;
}

export interface RawInventoryMigrationRecord {
  id?: unknown;
  _id?: unknown;
  userProfileId?: unknown;
  userId?: unknown;
  category?: unknown;
  brand?: unknown;
  model?: unknown;
  exactModel?: unknown;
  catalogProductId?: unknown;
  specsJson?: unknown;
  specs?: unknown;
  condition?: unknown;
  ageYears?: unknown;
  notes?: unknown;
  price?: unknown;
  priceCents?: unknown;
  priceUsd?: unknown;
  estimatedPriceCents?: unknown;
  typicalUsedPriceCents?: unknown;
  source?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  painPoints?: unknown;
  traits?: unknown;
  traitRatings?: unknown;
  traitScores?: unknown;
  [key: string]: unknown;
}

export interface UserMigrationInput {
  source: string;
  raw: RawUserMigrationRecord;
}

export interface InventoryMigrationInput {
  source: string;
  raw: RawInventoryMigrationRecord;
  fallbackUserId?: string;
}

export interface MigrationWriteSummary {
  usersMatched: number;
  usersInserted: number;
  usersModified: number;
  inventoryMatched: number;
  inventoryInserted: number;
  inventoryModified: number;
}

export interface MongoMigrationSummary extends MigrationWriteSummary {
  databaseName: string;
  usersCollection: string;
  inventoryCollection: string;
}

interface MigrationValidationResult {
  data: {
    users: UserMigrationInput[];
    inventoryItems: InventoryMigrationInput[];
  } | null;
  errors: Record<string, string>;
}

type MigrationDocument = Record<string, unknown> & {
  _id: string;
};

function envValue(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

export function getMongoMigrationConfig(): { uri: string; databaseName: string } {
  loadStandaloneEnv();

  const uri = envValue("MONGODB_URI") ?? envValue("MONGO_URL");
  if (!uri) {
    throw missingMongoEnvError();
  }

  const databaseName = envValue("MONGODB_DB_NAME");
  if (!databaseName) {
    throw new Error(
      [
        "Missing MongoDB database name. Set MONGODB_DB_NAME before running database scripts.",
        `cwd: ${process.cwd()}`,
        `MONGODB_DB_NAME exists: ${Boolean(process.env.MONGODB_DB_NAME?.trim())}`,
      ].join("\n"),
    );
  }

  return {
    uri,
    databaseName,
  };
}

export async function getMongoMigrationClient(): Promise<MongoClient> {
  const { uri } = getMongoMigrationConfig();

  if (!mongoClientCache.lifeUpgradeMongoClient) {
    mongoClientCache.lifeUpgradeMongoClient = new MongoClient(uri);
  }

  return mongoClientCache.lifeUpgradeMongoClient.connect();
}

export async function closeMongoMigrationClient(): Promise<void> {
  if (!mongoClientCache.lifeUpgradeMongoClient) return;

  await mongoClientCache.lifeUpgradeMongoClient.close();
  mongoClientCache.lifeUpgradeMongoClient = undefined;
}

export async function getMongoMigrationDb(): Promise<Db> {
  const client = await getMongoMigrationClient();
  return client.db(getMongoMigrationConfig().databaseName);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = sanitizeString(value);
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function sanitizeString(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeRawValue(value: unknown): unknown {
  if (typeof value === "string") return sanitizeString(value);
  if (Array.isArray(value)) return value.map(sanitizeRawValue);
  if (value instanceof Date) return value;
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [sanitizeString(key), sanitizeRawValue(item)]),
  );
}

function sanitizeRawRecord<T extends Record<string, unknown>>(raw: T): T {
  return sanitizeRawValue(raw) as T;
}

function stableSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function recordId(raw: RawUserMigrationRecord | RawInventoryMigrationRecord, fallback: string): string {
  return asString(raw.id) ?? asString(raw._id) ?? fallback;
}

function normalizeBrand(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;

  return raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeModel(value: unknown): string | null {
  const raw = asString(value);
  return raw ? raw.replace(/\s+/g, " ").trim() : null;
}

function normalizeCondition(value: unknown): string {
  const normalized = (asString(value) ?? "unknown").toLowerCase().replace(/\s+/g, "_");
  if (normalized === "like_new") return "excellent";
  if (normalized === "ok" || normalized === "okay") return "fair";
  return allowedConditions.has(normalized) ? normalized : "unknown";
}

function normalizeCategory(value: unknown): string {
  const normalized = normalizeInventoryCategories(value)[0] ?? stableSlug(asString(value) ?? "unknown");
  if (allowedDeviceCategories.has(normalized)) return normalized;
  if (normalized === "external_storage") return "storage";
  return "other";
}

function parsePossiblyJson(value: unknown): unknown {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed.includes(",") ? trimmed.split(",").map((item) => item.trim()).filter(Boolean) : trimmed;
  }
}

function toPlainObject(value: unknown): Record<string, unknown> | null {
  const parsed = parsePossiblyJson(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
}

function toStringArray(value: unknown): string[] {
  const parsed = parsePossiblyJson(value);
  const values = Array.isArray(parsed) ? parsed : parsed === null || parsed === undefined ? [] : [parsed];

  return Array.from(
    new Set(
      values
        .map((item) => asString(item))
        .filter((item): item is string => Boolean(item))
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const raw = asString(value);
  if (!raw) return null;

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = asString(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function emptyToUndefined(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && sanitizeString(value).length === 0) return undefined;
  return value;
}

function coerceOptionalNumber(value: unknown): unknown {
  const normalized = emptyToUndefined(value);
  if (normalized === undefined) return undefined;
  if (typeof normalized === "number") return normalized;
  if (typeof normalized !== "string") return normalized;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : normalized;
}

function normalizeConditionInput(value: unknown): unknown {
  const normalized = emptyToUndefined(value);
  if (normalized === undefined) return undefined;
  if (typeof normalized !== "string") return normalized;

  const condition = sanitizeString(normalized).toLowerCase().replace(/\s+/g, "_");
  if (condition === "like_new") return "excellent";
  if (condition === "ok" || condition === "okay") return "fair";
  return condition;
}

function zodIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid value.";
}

const requiredMigrationStringSchema = (field: string) =>
  z.preprocess(
    emptyToUndefined,
    z
      .string({ error: `${field} is required.` })
      .transform(sanitizeString)
      .pipe(z.string().min(1, `${field} is required.`).max(160, `${field} must be 160 characters or fewer.`)),
  );

const optionalPriceCentsSchema = z.preprocess(
  coerceOptionalNumber,
  z
    .number({ error: "Price must be a number." })
    .int("Price must be whole cents.")
    .min(0, "Price cannot be negative.")
    .max(MAX_PRICE_CENTS, "Price is outside the supported range.")
    .optional(),
);

const optionalPriceUsdSchema = z.preprocess(
  coerceOptionalNumber,
  z
    .number({ error: "Price must be a number." })
    .min(0, "Price cannot be negative.")
    .max(MAX_PRICE_USD, "Price is outside the supported range.")
    .optional(),
);

const optionalMigrationConditionSchema = z.preprocess(
  normalizeConditionInput,
  z
    .enum(migrationConditionValues, {
      error: "Condition must be poor, fair, good, excellent, or unknown.",
    })
    .optional(),
);

const traitScoreMapSchema = z.record(
  z.string().transform(sanitizeString).pipe(z.string().min(1, "Trait names cannot be empty.")),
  z.number({ error: "Trait scores must be numbers." }).min(0, "Trait scores must be between 0 and 10.").max(10, "Trait scores must be between 0 and 10."),
);

function addValidationError(errors: Record<string, string>, path: string, message: string): void {
  errors[path] ??= message;
}

function validatePriceField(
  value: unknown,
  path: string,
  schema: typeof optionalPriceCentsSchema | typeof optionalPriceUsdSchema,
  errors: Record<string, string>,
): void {
  const result = schema.safeParse(value);
  if (!result.success) {
    addValidationError(errors, path, zodIssueMessage(result.error));
  }
}

function validateTraitScores(value: unknown, path: string, errors: Record<string, string>): void {
  if (emptyToUndefined(value) === undefined) return;
  const result = traitScoreMapSchema.safeParse(value);

  if (result.success) return;

  for (const issue of result.error.issues) {
    addValidationError(errors, [path, ...issue.path].join("."), issue.message);
  }
}

function validateInventoryMigrationRecord(raw: RawInventoryMigrationRecord, path: string, errors: Record<string, string>): void {
  const category = requiredMigrationStringSchema("Category").safeParse(raw.category);
  if (!category.success) addValidationError(errors, `${path}.category`, zodIssueMessage(category.error));

  const brand = requiredMigrationStringSchema("Brand").safeParse(raw.brand);
  if (!brand.success) addValidationError(errors, `${path}.brand`, zodIssueMessage(brand.error));

  const model = requiredMigrationStringSchema("Model").safeParse(raw.model);
  if (!model.success) addValidationError(errors, `${path}.model`, zodIssueMessage(model.error));

  const condition = optionalMigrationConditionSchema.safeParse(raw.condition);
  if (!condition.success) addValidationError(errors, `${path}.condition`, zodIssueMessage(condition.error));

  validatePriceField(raw.priceCents, `${path}.priceCents`, optionalPriceCentsSchema, errors);
  validatePriceField(raw.estimatedPriceCents, `${path}.estimatedPriceCents`, optionalPriceCentsSchema, errors);
  validatePriceField(raw.typicalUsedPriceCents, `${path}.typicalUsedPriceCents`, optionalPriceCentsSchema, errors);
  validatePriceField(raw.priceUsd, `${path}.priceUsd`, optionalPriceUsdSchema, errors);
  validatePriceField(raw.price, `${path}.price`, optionalPriceUsdSchema, errors);

  validateTraitScores(raw.traitRatings, `${path}.traitRatings`, errors);
  validateTraitScores(raw.traitScores, `${path}.traitScores`, errors);

  if (raw.traits && typeof raw.traits === "object" && !Array.isArray(raw.traits)) {
    validateTraitScores(raw.traits, `${path}.traits`, errors);
  }

  const specs = toPlainObject(raw.specs) ?? toPlainObject(raw.specsJson);
  if (specs) {
    validateTraitScores(specs.traitRatings, `${path}.specs.traitRatings`, errors);
    validateTraitScores(specs.traitScores, `${path}.specs.traitScores`, errors);
  }
}

function validateUserMigrationRecord(raw: RawUserMigrationRecord, path: string, errors: Record<string, string>): void {
  validatePriceField(raw.budgetCents, `${path}.budgetCents`, optionalPriceCentsSchema, errors);
  validatePriceField(raw.budgetUsd, `${path}.budgetUsd`, optionalPriceUsdSchema, errors);
}

export function validateInventoryMigrationInputs(
  users: UserMigrationInput[],
  inventoryItems: InventoryMigrationInput[],
): MigrationValidationResult {
  const errors: Record<string, string> = {};
  const cleanUsers = users.map((input, index) => {
    const raw = sanitizeRawRecord(input.raw);
    validateUserMigrationRecord(raw, `users[${index}]`, errors);
    return { ...input, raw };
  });
  const cleanInventoryItems = inventoryItems.map((input, index) => {
    const raw = sanitizeRawRecord(input.raw);
    validateInventoryMigrationRecord(raw, `inventoryItems[${index}]`, errors);
    return { ...input, raw };
  });

  if (Object.keys(errors).length > 0) {
    return { data: null, errors };
  }

  return {
    data: {
      users: cleanUsers,
      inventoryItems: cleanInventoryItems,
    },
    errors,
  };
}

function normalizeTraits(raw: RawInventoryMigrationRecord, category: string, specs: Record<string, unknown> | null): string[] {
  const traits = new Set<string>();
  const explicitTraits = toStringArray(raw.traits);
  const painPoints = normalizeUserProblems(raw.painPoints);
  const notes = [raw.notes, raw.model, raw.exactModel].map((value) => asString(value)?.toLowerCase() ?? "").join(" ");
  const categoryTraits = CATEGORY_DEVICE_TRAITS[category as keyof typeof CATEGORY_DEVICE_TRAITS] ?? [];

  explicitTraits.forEach((trait) => traits.add(stableSlug(trait)));
  categoryTraits.slice(0, 6).forEach((trait) => traits.add(trait));
  painPoints.forEach((problem) => traits.add(`pain_${problem}`));

  if (specs) {
    for (const [key, value] of Object.entries(specs)) {
      if (value === true) traits.add(stableSlug(key));
      if (typeof value === "string" && value.trim()) traits.add(`${stableSlug(key)}_${stableSlug(value)}`);
      if (Array.isArray(value)) {
        value
          .map((item) => asString(item))
          .filter((item): item is string => Boolean(item))
          .forEach((item) => traits.add(`${stableSlug(key)}_${stableSlug(item)}`));
      }
    }
  }

  if (/\bergonomic|wrist|vertical\b/.test(notes)) traits.add("ergonomic");
  if (/\bquiet|silent|noise\b/.test(notes)) traits.add("quiet");
  if (/\bportable|travel|laptop-only\b/.test(notes)) traits.add("portable");
  if (/\blumbar|back\b/.test(notes)) traits.add("back_support");
  if (/\blight|glare|dim|eye\b/.test(notes)) traits.add("eye_comfort");

  return [...traits].filter(Boolean).sort();
}

function normalizedUserDocument(input: UserMigrationInput, now: Date): MigrationDocument {
  const raw = input.raw;
  const id = recordId(raw, `${input.source}:user:${stableSlug(asString(raw.name) ?? asString(raw.profession) ?? "unknown")}`);
  const budgetCents = toNumber(raw.budgetCents) ?? (toNumber(raw.budgetUsd) === null ? null : Math.round((toNumber(raw.budgetUsd) ?? 0) * 100));
  const constraints = toPlainObject(raw.constraints) ?? toPlainObject(raw.roomConstraints);

  return {
    _id: id,
    id,
    source: input.source,
    sourceKey: `${input.source}:user:${id}`,
    name: asString(raw.name),
    ageRange: asString(raw.ageRange),
    profession: asString(raw.profession),
    budgetCents,
    budgetUsd: budgetCents === null ? toNumber(raw.budgetUsd) : Math.round(budgetCents / 100),
    spendingStyle: (asString(raw.spendingStyle) ?? "balanced").toLowerCase(),
    usedItemsOkay: typeof raw.usedItemsOkay === "boolean" ? raw.usedItemsOkay : Boolean(raw.usedItemsOkay ?? true),
    accessibilityNeeds: normalizeUserPreferences(raw.accessibilityNeeds),
    preferences: normalizeUserPreferences(raw.preferences),
    problems: normalizeUserProblems(raw.problems),
    roomConstraints: toPlainObject(raw.roomConstraints) ?? normalizeUserPreferences(raw.roomConstraints),
    constraints,
    raw,
    createdAt: toDate(raw.createdAt) ?? now,
    updatedAt: toDate(raw.updatedAt) ?? now,
    migratedAt: now,
  };
}

function normalizedInventoryDocument(input: InventoryMigrationInput, now: Date): MigrationDocument {
  const raw = input.raw;
  const id = recordId(raw, `${input.source}:inventory:${stableSlug([raw.brand, raw.model, raw.exactModel].map(asString).filter(Boolean).join(" ") || "unknown")}`);
  const category = normalizeCategory(raw.category);
  const brand = normalizeBrand(raw.brand);
  const model = normalizeModel(raw.model);
  const exactModel = normalizeModel(raw.exactModel);
  const specs = toPlainObject(raw.specs) ?? toPlainObject(raw.specsJson);
  const condition = normalizeCondition(raw.condition);
  const userId = asString(raw.userProfileId) ?? asString(raw.userId) ?? input.fallbackUserId ?? "unknown";

  return {
    _id: id,
    id,
    userId,
    userProfileId: userId,
    source: input.source,
    sourceKey: `${input.source}:inventory:${id}`,
    category,
    brand,
    model,
    exactModel,
    catalogProductId: asString(raw.catalogProductId),
    condition,
    ageYears: toNumber(raw.ageYears),
    notes: asString(raw.notes),
    itemSource: (asString(raw.source) ?? input.source).toLowerCase(),
    specs,
    specsJson: typeof raw.specsJson === "string" ? raw.specsJson : specs ? JSON.stringify(specs) : null,
    traits: normalizeTraits(raw, category, specs),
    raw,
    createdAt: toDate(raw.createdAt) ?? now,
    updatedAt: toDate(raw.updatedAt) ?? now,
    migratedAt: now,
  };
}

function mergeSummary(left: MigrationWriteSummary, right: MigrationWriteSummary): MigrationWriteSummary {
  return {
    usersMatched: left.usersMatched + right.usersMatched,
    usersInserted: left.usersInserted + right.usersInserted,
    usersModified: left.usersModified + right.usersModified,
    inventoryMatched: left.inventoryMatched + right.inventoryMatched,
    inventoryInserted: left.inventoryInserted + right.inventoryInserted,
    inventoryModified: left.inventoryModified + right.inventoryModified,
  };
}

export async function upsertInventoryMigrationRecords(
  db: Db,
  users: UserMigrationInput[],
  inventoryItems: InventoryMigrationInput[],
): Promise<MigrationWriteSummary> {
  const now = new Date();
  const summary: MigrationWriteSummary = {
    usersMatched: 0,
    usersInserted: 0,
    usersModified: 0,
    inventoryMatched: 0,
    inventoryInserted: 0,
    inventoryModified: 0,
  };

  if (users.length > 0) {
    const result = await db.collection<Record<string, unknown> & { _id: string }>("users").bulkWrite(
      users.map((input) => {
        const document = normalizedUserDocument(input, now);
        const { _id, ...setDocument } = document;
        return {
          updateOne: {
            filter: { _id: String(_id) },
            update: { $set: setDocument, $setOnInsert: { firstMigratedAt: now } },
            upsert: true,
          },
        };
      }),
      { ordered: false },
    );

    summary.usersMatched = result.matchedCount;
    summary.usersInserted = result.upsertedCount;
    summary.usersModified = result.modifiedCount;
  }

  if (inventoryItems.length > 0) {
    const result = await db.collection<Record<string, unknown> & { _id: string }>("inventory_items").bulkWrite(
      inventoryItems.map((input) => {
        const document = normalizedInventoryDocument(input, now);
        const { _id, ...setDocument } = document;
        return {
          updateOne: {
            filter: { _id: String(_id) },
            update: { $set: setDocument, $setOnInsert: { firstMigratedAt: now } },
            upsert: true,
          },
        };
      }),
      { ordered: false },
    );

    summary.inventoryMatched = result.matchedCount;
    summary.inventoryInserted = result.upsertedCount;
    summary.inventoryModified = result.modifiedCount;
  }

  return summary;
}

export async function upsertInventoryMigrationBatch(
  users: UserMigrationInput[],
  inventoryItems: InventoryMigrationInput[],
): Promise<MongoMigrationSummary> {
  const db = await getMongoMigrationDb();
  await db.collection("users").createIndex({ sourceKey: 1 }, { unique: true });
  await db.collection("inventory_items").createIndex({ sourceKey: 1 }, { unique: true });
  await db.collection("inventory_items").createIndex({ userId: 1, category: 1 });

  const writeSummary = await upsertInventoryMigrationRecords(db, users, inventoryItems);

  return {
    databaseName: db.databaseName,
    usersCollection: "users",
    inventoryCollection: "inventory_items",
    ...mergeSummary(
      {
        usersMatched: 0,
        usersInserted: 0,
        usersModified: 0,
        inventoryMatched: 0,
        inventoryInserted: 0,
        inventoryModified: 0,
      },
      writeSummary,
    ),
  };
}
