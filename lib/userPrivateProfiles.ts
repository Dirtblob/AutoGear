import type { Collection } from "mongodb";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getCurrentMongoUser } from "@/lib/devUser";
import { getMongoDatabase } from "@/lib/mongodb";

export const userPrivateProfileCollectionName = "user_private_profiles";

export const ageRangeValues = [
  "under_18",
  "18_24",
  "25_34",
  "35_44",
  "45_54",
  "55_plus",
  "prefer_not_to_say",
] as const;

export const dominantHandValues = ["left", "right", "ambidextrous"] as const;
export const gripStyleValues = ["palm", "claw", "fingertip", "unknown"] as const;

export type UserPrivateProfileAgeRange = (typeof ageRangeValues)[number];
export type UserPrivateProfileDominantHand = (typeof dominantHandValues)[number];
export type UserPrivateProfileGripStyle = (typeof gripStyleValues)[number];

export interface UserPrivateProfileComfortPriorities {
  lowNoise: boolean;
  lightweight: boolean;
  ergonomic: boolean;
  portability: boolean;
  largeDisplay: boolean;
  compactSize: boolean;
}

export interface UserPrivateProfileSensitivity {
  wristStrain: boolean;
  fingerFatigue: boolean;
  hearingSensitive: boolean;
  eyeStrain: boolean;
}

export interface UserPrivateProfileBudget {
  min: number;
  max: number;
  currency: string;
}

export interface UserPrivateProfilePrivacy {
  allowProfileForRecommendations: boolean;
  allowRecommendationHistory: boolean;
}

export interface UserPrivateProfile {
  _id: ObjectId | string;
  userId: string;
  ageRange?: UserPrivateProfileAgeRange;
  profession?: string;
  primaryUseCases: string[];
  heightCm?: number;
  handLengthMm?: number;
  palmWidthMm?: number;
  dominantHand?: UserPrivateProfileDominantHand;
  gripStyle?: UserPrivateProfileGripStyle;
  comfortPriorities: UserPrivateProfileComfortPriorities;
  sensitivity: UserPrivateProfileSensitivity;
  budget?: UserPrivateProfileBudget;
  privacy: UserPrivateProfilePrivacy;
  createdAt: Date;
  updatedAt: Date;
}

export type UserPrivateProfileInput = Omit<UserPrivateProfile, "_id" | "userId" | "createdAt" | "updatedAt">;

export interface UserPrivateProfileSnapshot extends Omit<UserPrivateProfile, "_id" | "userId" | "createdAt" | "updatedAt"> {
  id: string;
  _id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPrivateProfileApiSnapshot
  extends Omit<UserPrivateProfileSnapshot, "id" | "_id" | "createdAt" | "updatedAt"> {
  id: string | null;
  _id: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type UserPrivateProfilePatchInput = Partial<
  Omit<UserPrivateProfileInput, "comfortPriorities" | "sensitivity" | "privacy" | "budget">
> & {
  comfortPriorities?: Partial<UserPrivateProfileComfortPriorities>;
  sensitivity?: Partial<UserPrivateProfileSensitivity>;
  budget?: UserPrivateProfileBudget;
  privacy?: Partial<UserPrivateProfilePrivacy>;
};

type ValidationResult<T> = {
  data: T | null;
  errors: Record<string, string>;
};

const defaultComfortPriorities: UserPrivateProfileComfortPriorities = {
  lowNoise: false,
  lightweight: false,
  ergonomic: false,
  portability: false,
  largeDisplay: false,
  compactSize: false,
};

const defaultSensitivity: UserPrivateProfileSensitivity = {
  wristStrain: false,
  fingerFatigue: false,
  hearingSensitive: false,
  eyeStrain: false,
};

const defaultPrivacy: UserPrivateProfilePrivacy = {
  allowProfileForRecommendations: true,
  allowRecommendationHistory: true,
};

function sanitizeString(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function zodErrors(error: z.ZodError): Record<string, string> {
  return error.issues.reduce<Record<string, string>>((fields, issue) => {
    const key = issue.path.join(".") || "payload";
    fields[key] ??= issue.message;
    return fields;
  }, {});
}

const optionalTextSchema = z.preprocess(
  emptyToUndefined,
  z
    .string({ error: "Expected a string." })
    .transform(sanitizeString)
    .pipe(z.string().max(160, "Must be 160 characters or fewer."))
    .optional(),
);

const primaryUseCasesSchema = z
  .array(
    z
      .string({ error: "Use cases must be strings." })
      .transform(sanitizeString)
      .pipe(z.string().min(1, "Use cases cannot be empty.").max(80, "Use cases must be 80 characters or fewer.")),
  )
  .max(20, "Use cases must include 20 items or fewer.")
  .default([]);

const boundedOptionalNumberSchema = (field: string, min: number, max: number) =>
  z.preprocess(
    coerceOptionalNumber,
    z
      .number({ error: `${field} must be a number.` })
      .min(min, `${field} must be at least ${min}.`)
      .max(max, `${field} must be ${max} or less.`)
      .optional(),
  );

const comfortPrioritiesObjectSchema = z.object({
  lowNoise: z.boolean().default(false),
  lightweight: z.boolean().default(false),
  ergonomic: z.boolean().default(false),
  portability: z.boolean().default(false),
  largeDisplay: z.boolean().default(false),
  compactSize: z.boolean().default(false),
});

const comfortPrioritiesSchema = comfortPrioritiesObjectSchema.default(defaultComfortPriorities);

const sensitivityObjectSchema = z.object({
  wristStrain: z.boolean().default(false),
  fingerFatigue: z.boolean().default(false),
  hearingSensitive: z.boolean().default(false),
  eyeStrain: z.boolean().default(false),
});

const sensitivitySchema = sensitivityObjectSchema.default(defaultSensitivity);

const budgetSchema = z
  .object({
    min: z.preprocess(coerceOptionalNumber, z.number({ error: "Budget minimum must be a number." }).min(0)),
    max: z.preprocess(coerceOptionalNumber, z.number({ error: "Budget maximum must be a number." }).min(0)),
    currency: z
      .string({ error: "Currency is required." })
      .transform((value) => sanitizeString(value).toUpperCase())
      .pipe(z.string().length(3, "Currency must be a 3-letter ISO code.")),
  })
  .refine((budget) => budget.max >= budget.min, {
    message: "Budget maximum must be greater than or equal to the minimum.",
    path: ["max"],
  })
  .optional();

const privacyObjectSchema = z.object({
  allowProfileForRecommendations: z.boolean().default(true),
  allowRecommendationHistory: z.boolean().default(true),
});

const privacySchema = privacyObjectSchema.default(defaultPrivacy);

const userPrivateProfileInputSchema = z.object({
  ageRange: z.preprocess(emptyToUndefined, z.enum(ageRangeValues).optional()),
  profession: optionalTextSchema,
  primaryUseCases: primaryUseCasesSchema,
  heightCm: boundedOptionalNumberSchema("Height", 80, 250),
  handLengthMm: boundedOptionalNumberSchema("Hand length", 80, 260),
  palmWidthMm: boundedOptionalNumberSchema("Palm width", 50, 150),
  dominantHand: z.preprocess(emptyToUndefined, z.enum(dominantHandValues).optional()),
  gripStyle: z.preprocess(emptyToUndefined, z.enum(gripStyleValues).optional()),
  comfortPriorities: comfortPrioritiesSchema,
  sensitivity: sensitivitySchema,
  budget: budgetSchema,
  privacy: privacySchema,
});

const userPrivateProfilePatchSchema = z.object({
  ageRange: z.preprocess(emptyToUndefined, z.enum(ageRangeValues).optional()),
  profession: optionalTextSchema,
  primaryUseCases: primaryUseCasesSchema.optional(),
  heightCm: boundedOptionalNumberSchema("Height", 80, 250),
  handLengthMm: boundedOptionalNumberSchema("Hand length", 80, 260),
  palmWidthMm: boundedOptionalNumberSchema("Palm width", 50, 150),
  dominantHand: z.preprocess(emptyToUndefined, z.enum(dominantHandValues).optional()),
  gripStyle: z.preprocess(emptyToUndefined, z.enum(gripStyleValues).optional()),
  comfortPriorities: comfortPrioritiesObjectSchema.partial().optional(),
  sensitivity: sensitivityObjectSchema.partial().optional(),
  budget: budgetSchema,
  privacy: privacyObjectSchema.partial().optional(),
});

async function getUserPrivateProfilesCollection(): Promise<Collection<UserPrivateProfile>> {
  const database = await getMongoDatabase();
  return database.collection<UserPrivateProfile>(userPrivateProfileCollectionName);
}

function stringifyMongoId(value: ObjectId | string): string {
  return typeof value === "string" ? value : value.toHexString();
}

function toIsoDate(value: Date | string | undefined): string {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function validateUserPrivateProfileInput(payload: unknown): ValidationResult<UserPrivateProfileInput> {
  const result = userPrivateProfileInputSchema.safeParse(payload);

  if (!result.success) {
    return { data: null, errors: zodErrors(result.error) };
  }

  return { data: result.data, errors: {} };
}

export function validateUserPrivateProfilePatchInput(payload: unknown): ValidationResult<UserPrivateProfilePatchInput> {
  const result = userPrivateProfilePatchSchema.safeParse(payload);

  if (!result.success) {
    return { data: null, errors: zodErrors(result.error) };
  }

  return { data: result.data, errors: {} };
}

export function buildDefaultUserPrivateProfileInput(): UserPrivateProfileInput {
  return {
    primaryUseCases: [],
    comfortPriorities: { ...defaultComfortPriorities },
    sensitivity: { ...defaultSensitivity },
    privacy: { ...defaultPrivacy },
  };
}

function mergeUserPrivateProfilePatch(
  existing: UserPrivateProfile | null,
  patch: UserPrivateProfilePatchInput,
): UserPrivateProfileInput {
  const base: UserPrivateProfileInput = existing
    ? {
        ageRange: existing.ageRange,
        profession: existing.profession,
        primaryUseCases: existing.primaryUseCases,
        heightCm: existing.heightCm,
        handLengthMm: existing.handLengthMm,
        palmWidthMm: existing.palmWidthMm,
        dominantHand: existing.dominantHand,
        gripStyle: existing.gripStyle,
        comfortPriorities: existing.comfortPriorities,
        sensitivity: existing.sensitivity,
        budget: existing.budget,
        privacy: existing.privacy,
      }
    : buildDefaultUserPrivateProfileInput();

  return {
    ...base,
    ...patch,
    comfortPriorities: {
      ...base.comfortPriorities,
      ...patch.comfortPriorities,
    },
    sensitivity: {
      ...base.sensitivity,
      ...patch.sensitivity,
    },
    privacy: {
      ...base.privacy,
      ...patch.privacy,
    },
  };
}

export function serializeUserPrivateProfile(profile: UserPrivateProfile): UserPrivateProfileSnapshot {
  const id = stringifyMongoId(profile._id);

  return {
    id,
    _id: id,
    userId: profile.userId,
    ageRange: profile.ageRange,
    profession: profile.profession,
    primaryUseCases: profile.primaryUseCases,
    heightCm: profile.heightCm,
    handLengthMm: profile.handLengthMm,
    palmWidthMm: profile.palmWidthMm,
    dominantHand: profile.dominantHand,
    gripStyle: profile.gripStyle,
    comfortPriorities: profile.comfortPriorities,
    sensitivity: profile.sensitivity,
    budget: profile.budget,
    privacy: profile.privacy,
    createdAt: toIsoDate(profile.createdAt),
    updatedAt: toIsoDate(profile.updatedAt),
  };
}

export function buildDefaultUserPrivateProfileSnapshot(userId: string): UserPrivateProfileApiSnapshot {
  const defaults = buildDefaultUserPrivateProfileInput();

  return {
    id: null,
    _id: null,
    userId,
    ...defaults,
    createdAt: null,
    updatedAt: null,
  };
}

export async function getCurrentUserPrivateProfile(): Promise<UserPrivateProfile | null> {
  const user = await getCurrentMongoUser();

  return getUserPrivateProfileForUser(user.id);
}

export async function getUserPrivateProfileForUser(userId: string): Promise<UserPrivateProfile | null> {
  const profiles = await getUserPrivateProfilesCollection();

  return profiles.findOne({ userId });
}

export async function getCurrentUserPrivateProfileForRecommendations(): Promise<UserPrivateProfile | null> {
  const user = await getCurrentMongoUser();

  return getUserPrivateProfileForRecommendationsForUser(user.id);
}

export async function getUserPrivateProfileForRecommendationsForUser(userId: string): Promise<UserPrivateProfile | null> {
  const profile = await getUserPrivateProfileForUser(userId);

  if (!profile?.privacy.allowProfileForRecommendations) {
    return null;
  }

  return profile;
}

export async function getCurrentUserPrivateProfileSnapshot(): Promise<UserPrivateProfileApiSnapshot | UserPrivateProfileSnapshot> {
  const user = await getCurrentMongoUser();

  return getUserPrivateProfileSnapshotForUser(user.id);
}

export async function getUserPrivateProfileSnapshotForUser(
  userId: string,
): Promise<UserPrivateProfileApiSnapshot | UserPrivateProfileSnapshot> {
  const profiles = await getUserPrivateProfilesCollection();
  const profile = await profiles.findOne({ userId });

  return profile ? serializeUserPrivateProfile(profile) : buildDefaultUserPrivateProfileSnapshot(userId);
}

export async function upsertCurrentUserPrivateProfile(input: UserPrivateProfileInput): Promise<UserPrivateProfile> {
  const user = await getCurrentMongoUser();

  return upsertUserPrivateProfileForUser(user.id, input);
}

export async function upsertUserPrivateProfileForUser(
  userId: string,
  input: UserPrivateProfileInput,
): Promise<UserPrivateProfile> {
  const validation = validateUserPrivateProfileInput(input);
  if (!validation.data) {
    throw new Error(`Invalid private profile: ${Object.keys(validation.errors).join(", ")}`);
  }

  const profiles = await getUserPrivateProfilesCollection();
  const now = new Date();
  const profileId = new ObjectId();

  await profiles.updateOne(
    { userId },
    {
      $setOnInsert: {
        _id: profileId,
        userId,
        createdAt: now,
      },
      $set: {
        ...validation.data,
        updatedAt: now,
      },
    },
    { upsert: true },
  );

  const profile = await profiles.findOne({ userId });
  if (!profile) {
    throw new Error("Failed to save private user profile.");
  }

  return profile;
}

export async function patchCurrentUserPrivateProfile(input: UserPrivateProfilePatchInput): Promise<UserPrivateProfile> {
  const user = await getCurrentMongoUser();

  return patchUserPrivateProfileForUser(user.id, input);
}

export async function patchUserPrivateProfileForUser(
  userId: string,
  input: UserPrivateProfilePatchInput,
): Promise<UserPrivateProfile> {
  const validation = validateUserPrivateProfilePatchInput(input);
  if (!validation.data) {
    throw new Error(`Invalid private profile patch: ${Object.keys(validation.errors).join(", ")}`);
  }

  const existing = await getUserPrivateProfileForUser(userId);
  return upsertUserPrivateProfileForUser(userId, mergeUserPrivateProfilePatch(existing, validation.data));
}

export async function deleteCurrentUserPrivateProfile(): Promise<boolean> {
  const user = await getCurrentMongoUser();

  return deleteUserPrivateProfileForUser(user.id);
}

export async function deleteUserPrivateProfileForUser(userId: string): Promise<boolean> {
  const profiles = await getUserPrivateProfilesCollection();
  const result = await profiles.deleteOne({ userId });

  return result.deletedCount > 0;
}
