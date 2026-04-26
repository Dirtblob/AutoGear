import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ObjectId } from "mongodb";
import type { MongoInventoryItem } from "@/lib/inventory/mongoInventory";
import type { UserPrivateProfileInput } from "@/lib/userPrivateProfiles";
import type { CategoryScore, InventoryItem, PrivateRecommendationProfile, Product, ProductCategory, RecommendationInput, UserProfile } from "./types";

type AnyDocument = Record<string, unknown>;
type Filter = Record<string, unknown>;

const mongoMock = vi.hoisted(() => {
  type Doc = Record<string, unknown>;

  const collections = new Map<string, Doc[]>();

  function collectionDocuments(name: string): Doc[] {
    if (!collections.has(name)) collections.set(name, []);
    return collections.get(name)!;
  }

  function idValue(value: unknown): unknown {
    if (value && typeof value === "object" && "toHexString" in value && typeof value.toHexString === "function") {
      return value.toHexString();
    }
    return value;
  }

  function valuesEqual(left: unknown, right: unknown): boolean {
    return idValue(left) === idValue(right);
  }

  function matches(doc: Doc, filter: Filter): boolean {
    return Object.entries(filter).every(([key, value]) => {
      if (key === "$or" && Array.isArray(value)) {
        return value.some((entry) => matches(doc, entry as Filter));
      }

      return valuesEqual(doc[key], value);
    });
  }

  function applyUpdate(doc: Doc, update: Doc, inserting: boolean): Doc {
    const next = { ...doc };
    if (inserting && update.$setOnInsert && typeof update.$setOnInsert === "object") {
      Object.assign(next, update.$setOnInsert);
    }
    if (update.$set && typeof update.$set === "object") {
      Object.assign(next, update.$set);
    }
    return next;
  }

  const db = {
    collection(name: string) {
      const docs = collectionDocuments(name);

      return {
        async findOne(filter: Filter) {
          return docs.find((doc) => matches(doc, filter)) ?? null;
        },
        async updateOne(filter: Filter, update: Doc, options: { upsert?: boolean } = {}) {
          const index = docs.findIndex((doc) => matches(doc, filter));
          if (index >= 0) {
            docs[index] = applyUpdate(docs[index], update, false);
            return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
          }

          if (options.upsert) {
            docs.push(applyUpdate({ ...filter }, update, true));
            return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
          }

          return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
        },
        async insertOne(doc: Doc) {
          docs.push(doc);
          return { insertedId: doc._id };
        },
        async insertMany(items: Doc[]) {
          docs.push(...items);
          return { insertedCount: items.length };
        },
        async deleteOne(filter: Filter) {
          const index = docs.findIndex((doc) => matches(doc, filter));
          if (index < 0) return { deletedCount: 0 };
          docs.splice(index, 1);
          return { deletedCount: 1 };
        },
        async deleteMany(filter: Filter) {
          let deletedCount = 0;
          for (let index = docs.length - 1; index >= 0; index -= 1) {
            if (matches(docs[index], filter)) {
              docs.splice(index, 1);
              deletedCount += 1;
            }
          }
          return { deletedCount };
        },
        async countDocuments(filter: Filter) {
          return docs.filter((doc) => matches(doc, filter)).length;
        },
        find(filter: Filter) {
          const results = docs.filter((doc) => matches(doc, filter));
          return {
            sort(sortSpec: Record<string, 1 | -1>) {
              const entries = Object.entries(sortSpec);
              results.sort((left, right) => {
                for (const [field, direction] of entries) {
                  const leftValue = left[field] instanceof Date ? (left[field] as Date).getTime() : Number(left[field] ?? 0);
                  const rightValue = right[field] instanceof Date ? (right[field] as Date).getTime() : Number(right[field] ?? 0);
                  if (leftValue !== rightValue) return direction * (leftValue - rightValue);
                }
                return 0;
              });
              return this;
            },
            async toArray() {
              return results;
            },
          };
        },
      };
    },
  };

  return {
    collections,
    db,
    reset() {
      collections.clear();
    },
    docs(name: string) {
      return collectionDocuments(name);
    },
  };
});

vi.mock("@/lib/mongodb", () => ({
  getMongoDatabase: async () => mongoMock.db,
}));

vi.mock("server-only", () => ({}));

import {
  createInventoryItemForUser,
  listInventoryItemsForUser,
} from "@/lib/inventory/mongoInventory";
import { saveRecommendationRunLog } from "./recommendationLogs";
import { getProductRecommendations, rankProductsForInput } from "./productEngine";
import {
  buildDefaultUserPrivateProfileInput,
  getUserPrivateProfileForRecommendationsForUser,
  getUserPrivateProfileForUser,
  getUserPrivateProfileSnapshotForUser,
  patchUserPrivateProfileForUser,
  upsertUserPrivateProfileForUser,
} from "@/lib/userPrivateProfiles";

function profile(overrides: Partial<Omit<UserProfile, "constraints">> & { constraints?: Partial<UserProfile["constraints"]> } = {}): UserProfile {
  const base: UserProfile = {
    id: "verification-profile",
    name: "Verification User",
    ageRange: "25-34",
    profession: "General user",
    budgetUsd: 500,
    spendingStyle: "balanced",
    preferences: [],
    problems: [],
    accessibilityNeeds: [],
    roomConstraints: [],
    constraints: {
      deskWidthInches: 48,
      roomLighting: "mixed",
      sharesSpace: false,
      portableSetup: false,
    },
  };

  return {
    ...base,
    ...overrides,
    constraints: {
      ...base.constraints,
      ...overrides.constraints,
    },
  };
}

type PrivateProfileOverrides = Partial<Omit<PrivateRecommendationProfile, "comfortPriorities" | "sensitivity">> & {
  comfortPriorities?: Partial<PrivateRecommendationProfile["comfortPriorities"]>;
  sensitivity?: Partial<PrivateRecommendationProfile["sensitivity"]>;
};

function privateProfile(overrides: PrivateProfileOverrides = {}): PrivateRecommendationProfile {
  const base: PrivateRecommendationProfile = {
    profession: "Private office worker",
    primaryUseCases: [],
    heightCm: undefined,
    handLengthMm: undefined,
    palmWidthMm: undefined,
    dominantHand: "right",
    gripStyle: "unknown",
    comfortPriorities: {
      lowNoise: false,
      lightweight: false,
      ergonomic: false,
      portability: false,
      largeDisplay: false,
      compactSize: false,
    },
    sensitivity: {
      wristStrain: false,
      fingerFatigue: false,
      hearingSensitive: false,
      eyeStrain: false,
    },
  };

  return {
    ...base,
    ...overrides,
    comfortPriorities: {
      ...base.comfortPriorities,
      ...overrides.comfortPriorities,
    },
    sensitivity: {
      ...base.sensitivity,
      ...overrides.sensitivity,
    },
  };
}

function privateProfileInput(overrides: Partial<UserPrivateProfileInput> = {}): UserPrivateProfileInput {
  const base = buildDefaultUserPrivateProfileInput();

  return {
    ...base,
    ...overrides,
    comfortPriorities: {
      ...base.comfortPriorities,
      ...overrides.comfortPriorities,
    },
    sensitivity: {
      ...base.sensitivity,
      ...overrides.sensitivity,
    },
    privacy: {
      ...base.privacy,
      ...overrides.privacy,
    },
  };
}

function categoryScore(category: ProductCategory, score = 82): CategoryScore {
  return {
    category,
    score,
    reasons: [`${category} verification check.`],
  };
}

function product(overrides: Partial<Product>): Product {
  return {
    id: "verification-product",
    name: "Verification Product",
    brand: "Test",
    category: "mouse",
    priceUsd: 80,
    shortDescription: "Verification product.",
    strengths: ["Practical fit"],
    solves: ["wrist_pain"],
    constraints: {},
    scoreHints: {
      comfort: 8,
      productivity: 7,
      accessibility: 7,
      value: 7,
    },
    ...overrides,
  };
}

function recommendationInput(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    profile: profile(),
    inventory: [],
    deviceType: "laptop",
    ports: ["USB-C"],
    usedItemsOkay: true,
    ...overrides,
  };
}

function inventoryCreate(category: ProductCategory, overrides: Partial<MongoInventoryItem> = {}) {
  return {
    category,
    brand: "Test",
    model: `${category} model`,
    exactModel: null,
    catalogProductId: null,
    specsJson: null,
    condition: "GOOD" as const,
    ageYears: null,
    notes: null,
    source: "MANUAL" as const,
    ...overrides,
  };
}

function mapInventoryItem(item: MongoInventoryItem): InventoryItem {
  return {
    id: String((item._id as ObjectId).toHexString?.() ?? item._id),
    name: item.exactModel ?? item.model ?? item.category,
    category: item.category as InventoryItem["category"],
    condition: item.condition.toLowerCase() as InventoryItem["condition"],
    painPoints: item.notes?.includes("slow") ? ["slow_computer"] : item.notes?.includes("wrist") ? ["wrist_pain"] : [],
    specs: item.specsJson ? JSON.parse(item.specsJson) as Record<string, unknown> : undefined,
  };
}

function mouseProduct(id: string, ergonomicSpecs: Product["ergonomicSpecs"]): Product {
  return product({
    id,
    name: id,
    category: "mouse",
    ergonomicSpecs,
    solves: ["wrist_pain", "poor_focus"],
  });
}

function keyboardProduct(id: string, ergonomicSpecs: Product["ergonomicSpecs"]): Product {
  return product({
    id,
    name: id,
    category: "keyboard",
    solves: ["wrist_pain", "poor_focus"],
    constraints: {},
    ergonomicSpecs,
  });
}

function hasExactValue(value: unknown, target: string | number): boolean {
  if (value === target) return true;
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((entry) => hasExactValue(entry, target));
  return Object.values(value as AnyDocument).some((entry) => hasExactValue(entry, target));
}

beforeEach(() => {
  mongoMock.reset();
});

describe("private profile and recommendation fit verification", () => {
  it("1. User A cannot read User B's private profile", async () => {
    await upsertUserPrivateProfileForUser("user-b", privateProfileInput({ profession: "User B secret profession" }));

    const userAProfile = await getUserPrivateProfileForUser("user-a");
    const userASnapshot = await getUserPrivateProfileSnapshotForUser("user-a");

    expect(userAProfile).toBeNull();
    expect(userASnapshot.userId).toBe("user-a");
    expect(userASnapshot.id).toBeNull();
    expect(JSON.stringify(userASnapshot)).not.toContain("User B secret profession");
  });

  it("2. User A cannot update User B's private profile", async () => {
    await upsertUserPrivateProfileForUser("user-b", privateProfileInput({ profession: "User B original" }));
    await patchUserPrivateProfileForUser("user-a", { profession: "User A patch" });

    const userAProfile = await getUserPrivateProfileForUser("user-a");
    const userBProfile = await getUserPrivateProfileForUser("user-b");

    expect(userAProfile?.profession).toBe("User A patch");
    expect(userBProfile?.profession).toBe("User B original");
  });

  it("3. User A's inventory recommendations only use User A's inventory", async () => {
    await createInventoryItemForUser(
      "user-a",
      inventoryCreate("laptop", { condition: "POOR", notes: "slow computer only for user A" }),
    );
    await createInventoryItemForUser(
      "user-b",
      inventoryCreate("mouse", { condition: "FAIR", notes: "wrist pain only for user B" }),
    );

    const userAInventory = await listInventoryItemsForUser("user-a");
    const recommendations = rankProductsForInput({
      profile: profile({ problems: ["slow_computer"], budgetUsd: 1500 }),
      inventory: userAInventory.map(mapInventoryItem),
      candidateProducts: [
        product({ id: "a-laptop-upgrade", name: "A Laptop Upgrade", category: "laptop", solves: ["slow_computer"], priceUsd: 1200 }),
        product({ id: "b-mouse-upgrade", name: "B Mouse Upgrade", category: "mouse", solves: ["wrist_pain"], priceUsd: 80 }),
      ],
      exactCurrentModelsProvided: true,
    });

    expect(userAInventory).toHaveLength(1);
    expect(userAInventory.every((item) => item.userId === "user-a")).toBe(true);
    expect(JSON.stringify(userAInventory)).not.toContain("user-b");
    expect(recommendations[0]?.product.id).toBe("a-laptop-upgrade");
  });

  it("4. Private profile fields are not used when allowProfileForRecommendations is false", async () => {
    await upsertUserPrivateProfileForUser(
      "user-a",
      privateProfileInput({
        profession: "Private surgeon",
        heightCm: 213,
        handLengthMm: 247,
        palmWidthMm: 149,
        sensitivity: { wristStrain: true, fingerFatigue: false, hearingSensitive: true, eyeStrain: false },
        privacy: { allowProfileForRecommendations: false, allowRecommendationHistory: true },
      }),
    );

    const privateProfileForRecommendations = await getUserPrivateProfileForRecommendationsForUser("user-a");
    const recommendation = getProductRecommendations(
      recommendationInput({
        privateProfile: privateProfileForRecommendations,
        profile: profile({ profession: "Public profile profession", problems: ["wrist_pain"] }),
      }),
      categoryScore("mouse"),
      [
        mouseProduct("privacy-mouse", {
          category: "mouse",
          mouse: {
            recommendedHandLengthMinMm: 160,
            recommendedHandLengthMaxMm: 200,
            recommendedPalmWidthMinMm: 75,
            recommendedPalmWidthMaxMm: 105,
          },
        }),
      ],
    )[0];

    expect(privateProfileForRecommendations).toBeNull();
    expect(recommendation.profileFieldsUsed.join(" ")).not.toMatch(/user_private_profiles|heightCm|handLengthMm|palmWidthMm|profession|sensitivity/);
  });

  it("5. Mouse recommendations use provided handLengthMm and palmWidthMm", () => {
    const recommendations = getProductRecommendations(
      recommendationInput({
        profile: profile({ problems: ["wrist_pain"] }),
        privateProfile: privateProfile({ handLengthMm: 182, palmWidthMm: 91 }),
      }),
      categoryScore("mouse"),
      [
        mouseProduct("hand-fit-match", {
          category: "mouse",
          mouse: {
            recommendedHandLengthMinMm: 170,
            recommendedHandLengthMaxMm: 195,
            recommendedPalmWidthMinMm: 80,
            recommendedPalmWidthMaxMm: 100,
          },
        }),
        mouseProduct("hand-fit-mismatch", {
          category: "mouse",
          mouse: {
            recommendedHandLengthMinMm: 95,
            recommendedHandLengthMaxMm: 130,
            recommendedPalmWidthMinMm: 50,
            recommendedPalmWidthMaxMm: 70,
          },
        }),
      ],
    );

    const match = recommendations.find((item) => item.product.id === "hand-fit-match");
    const mismatch = recommendations.find((item) => item.product.id === "hand-fit-mismatch");

    expect(match?.profileFieldsUsed).toEqual(expect.arrayContaining(["user_private_profiles.handLengthMm", "user_private_profiles.palmWidthMm"]));
    expect(match?.scoreBreakdown.ergonomicFit).toBeGreaterThan(mismatch?.scoreBreakdown.ergonomicFit ?? 100);
  });

  it("6. Mouse recommendations use provided gripStyle", () => {
    const recommendations = getProductRecommendations(
      recommendationInput({
        profile: profile({ problems: ["wrist_pain"] }),
        privateProfile: privateProfile({ handLengthMm: 180, palmWidthMm: 90, gripStyle: "claw" }),
      }),
      categoryScore("mouse"),
      [
        mouseProduct("grip-match", {
          category: "mouse",
          mouse: {
            recommendedHandLengthMinMm: 160,
            recommendedHandLengthMaxMm: 200,
            recommendedPalmWidthMinMm: 75,
            recommendedPalmWidthMaxMm: 105,
            recommendedGripStyles: ["claw"],
          },
        }),
        mouseProduct("grip-mismatch", {
          category: "mouse",
          mouse: {
            recommendedHandLengthMinMm: 160,
            recommendedHandLengthMaxMm: 200,
            recommendedPalmWidthMinMm: 75,
            recommendedPalmWidthMaxMm: 105,
            recommendedGripStyles: ["palm"],
          },
        }),
      ],
    );

    const match = recommendations.find((item) => item.product.id === "grip-match");
    const mismatch = recommendations.find((item) => item.product.id === "grip-mismatch");

    expect(match?.profileFieldsUsed).toContain("user_private_profiles.gripStyle");
    expect(match?.scoreBreakdown.ergonomicFit).toBeGreaterThan(mismatch?.scoreBreakdown.ergonomicFit ?? 100);
  });

  it("7. hearingSensitive or lowNoise makes keyboard sound level affect scoring", () => {
    const recommendations = getProductRecommendations(
      recommendationInput({
        profile: profile({ problems: ["wrist_pain"] }),
        privateProfile: privateProfile({
          comfortPriorities: { lowNoise: true },
          sensitivity: { hearingSensitive: true },
        }),
      }),
      categoryScore("keyboard"),
      [
        keyboardProduct("quiet-keyboard", {
          category: "keyboard",
          keyboard: { soundLevel: "quiet", ergonomicLayout: false },
        }),
        keyboardProduct("loud-keyboard", {
          category: "keyboard",
          keyboard: { soundLevel: "loud", ergonomicLayout: false },
        }),
      ],
    );

    const quiet = recommendations.find((item) => item.product.id === "quiet-keyboard");
    const loud = recommendations.find((item) => item.product.id === "loud-keyboard");

    expect(quiet?.profileFieldsUsed).toEqual(
      expect.arrayContaining([
        "user_private_profiles.comfortPriorities.lowNoise",
        "user_private_profiles.sensitivity.hearingSensitive",
      ]),
    );
    expect(quiet?.scoreBreakdown.ergonomicFit).toBeGreaterThan(loud?.scoreBreakdown.ergonomicFit ?? 100);
  });

  it("8. wristStrain makes ergonomic keyboard and mouse traits affect scoring", () => {
    const recommendations = getProductRecommendations(
      recommendationInput({
        profile: profile({ problems: ["wrist_pain"] }),
        privateProfile: privateProfile({ sensitivity: { wristStrain: true } }),
      }),
      categoryScore("keyboard"),
      [
        keyboardProduct("ergonomic-keyboard", {
          category: "keyboard",
          keyboard: { ergonomicLayout: true, actuationForceG: 45, soundLevel: "quiet" },
        }),
        keyboardProduct("flat-heavy-keyboard", {
          category: "keyboard",
          keyboard: { ergonomicLayout: false, actuationForceG: 75, soundLevel: "quiet" },
        }),
      ],
    );

    const ergonomic = recommendations.find((item) => item.product.id === "ergonomic-keyboard");
    const flat = recommendations.find((item) => item.product.id === "flat-heavy-keyboard");

    expect(ergonomic?.profileFieldsUsed).toContain("user_private_profiles.sensitivity.wristStrain");
    expect(ergonomic?.scoreBreakdown.ergonomicFit).toBeGreaterThan(flat?.scoreBreakdown.ergonomicFit ?? 100);
  });

  it("9. recommendation_logs do not store raw private profile values", async () => {
    const rawPrivateProfile = privateProfile({
      profession: "Private neurosurgeon",
      heightCm: 213,
      handLengthMm: 247,
      palmWidthMm: 149,
      gripStyle: "claw",
      sensitivity: { wristStrain: true, hearingSensitive: true },
    });
    const recommendation = getProductRecommendations(
      recommendationInput({
        profile: profile({ problems: ["wrist_pain"] }),
        privateProfile: rawPrivateProfile,
      }),
      categoryScore("mouse"),
      [
        mouseProduct("log-safe-mouse", {
          category: "mouse",
          mouse: {
            recommendedHandLengthMinMm: 220,
            recommendedHandLengthMaxMm: 260,
            recommendedPalmWidthMinMm: 130,
            recommendedPalmWidthMaxMm: 150,
            recommendedGripStyles: ["claw"],
          },
        }),
      ],
    )[0];

    await saveRecommendationRunLog({
      userId: "user-a",
      inventory: [],
      recommendations: [recommendation],
      createdAt: new Date("2026-04-25T12:00:00Z"),
    });

    const log = mongoMock.docs("recommendation_logs")[0];

    expect(log).toBeDefined();
    expect(hasExactValue(log, "Private neurosurgeon")).toBe(false);
    expect(hasExactValue(log, 213)).toBe(false);
    expect(hasExactValue(log, 247)).toBe(false);
    expect(hasExactValue(log, 149)).toBe(false);
    expect(hasExactValue(log, "claw")).toBe(false);
  });

  it("10. Device recommendations still work without ergonomicSpecs, with lower confidence", () => {
    const recommendations = getProductRecommendations(
      recommendationInput({
        profile: profile({ problems: ["wrist_pain"] }),
        privateProfile: privateProfile({ handLengthMm: 180, palmWidthMm: 90 }),
      }),
      categoryScore("mouse"),
      [
        mouseProduct("mouse-with-specs", {
          category: "mouse",
          mouse: {
            recommendedHandLengthMinMm: 160,
            recommendedHandLengthMaxMm: 200,
            recommendedPalmWidthMinMm: 75,
            recommendedPalmWidthMaxMm: 105,
          },
        }),
        mouseProduct("mouse-without-specs", undefined),
      ],
    );

    const withSpecs = recommendations.find((item) => item.product.id === "mouse-with-specs");
    const withoutSpecs = recommendations.find((item) => item.product.id === "mouse-without-specs");

    expect(withoutSpecs).toBeDefined();
    expect(withoutSpecs?.missingDeviceSpecs).toContain("device_catalog.ergonomicSpecs");
    expect(withSpecs?.scoreBreakdown.confidence).toBeGreaterThan(withoutSpecs?.scoreBreakdown.confidence ?? 100);
  });
});
