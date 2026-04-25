import { describe, expect, it } from "vitest";
import { getCategoryRecommendations } from "./categoryEngine";
import type { InventoryItem, ProductCategory, UserProfile } from "./types";

function profile(overrides: Partial<UserProfile>): UserProfile {
  const base: UserProfile = {
    id: "test-profile",
    name: "Test User",
    ageRange: "25-34",
    profession: "Remote worker",
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

function item(category: ProductCategory, name: string = category): InventoryItem {
  return {
    id: `item-${category}`,
    name,
    category,
    condition: "good",
    painPoints: [],
  };
}

function categoryScore(recommendations: ReturnType<typeof getCategoryRecommendations>, category: ProductCategory) {
  const recommendation = recommendations.find((entry) => entry.category === category);
  expect(recommendation).toBeDefined();
  return recommendation!;
}

describe("getCategoryRecommendations", () => {
  it("ranks laptop stand and monitor above laptop for a laptop-only coder with neck pain", () => {
    const recommendations = getCategoryRecommendations({
      profile: profile({
        profession: "Software engineer",
        budgetUsd: 300,
        spendingStyle: "VALUE",
        problems: ["neck_pain", "eye_strain", "low_productivity", "budget_limited"],
        constraints: {
          deskWidthInches: 48,
          roomLighting: "mixed",
          sharesSpace: false,
          portableSetup: true,
        },
      }),
      inventory: [item("laptop", "13-inch laptop")],
    });
    const laptopStand = categoryScore(recommendations, "laptop_stand");
    const monitor = categoryScore(recommendations, "monitor");
    const laptop = categoryScore(recommendations, "laptop");

    expect(laptopStand.score).toBeGreaterThan(laptop.score);
    expect(monitor.score).toBeGreaterThan(laptop.score);
    expect(recommendations.indexOf(laptopStand)).toBeLessThan(recommendations.indexOf(laptop));
    expect(recommendations.indexOf(monitor)).toBeLessThan(recommendations.indexOf(laptop));
    expect(laptopStand.problemsAddressed).toContain("neck_pain");
  });

  it("prioritizes mouse upgrades for wrist pain when the current mouse is basic", () => {
    const recommendations = getCategoryRecommendations({
      profile: profile({ problems: ["wrist_pain"] }),
      inventory: [item("mouse", "Basic mouse")],
    });

    expect(recommendations[0].category).toBe("mouse");
    expect(recommendations[0].priority).toMatch(/critical|high/);
    expect(recommendations[0].missingOrUpgradeReason).toContain("mouse");
  });

  it("defers laptop replacement for a budget-limited student", () => {
    const recommendations = getCategoryRecommendations({
      profile: profile({
        profession: "Student",
        budgetUsd: 150,
        spendingStyle: "lean",
        problems: ["slow_computer", "low_productivity", "budget_limited"],
      }),
      inventory: [item("laptop", "Slow laptop")],
    });

    expect(recommendations[0].category).not.toBe("laptop");
    expect(categoryScore(recommendations, "laptop_stand").score).toBeGreaterThan(
      categoryScore(recommendations, "laptop").score,
    );
    expect(categoryScore(recommendations, "laptop").explanation).toContain("budget");
  });

  it("ranks headphones high for a noise-sensitive remote worker", () => {
    const recommendations = getCategoryRecommendations({
      profile: profile({
        profession: "Remote product manager",
        problems: ["noise_sensitivity"],
        constraints: {
          deskWidthInches: 48,
          roomLighting: "bright",
          sharesSpace: true,
          portableSetup: false,
        },
      }),
      inventory: [],
    });

    expect(recommendations[0].category).toBe("headphones");
    expect(recommendations[0].score).toBeGreaterThanOrEqual(65);
    expect(recommendations[0].problemsAddressed).toContain("noise_sensitivity");
  });

  it("penalizes large monitor and chair upgrades for a small desk user", () => {
    const recommendations = getCategoryRecommendations({
      profile: profile({
        problems: ["clutter", "small_space"],
        roomConstraints: ["small_space", "limited_desk_width"],
        constraints: {
          deskWidthInches: 30,
          roomLighting: "mixed",
          sharesSpace: false,
          portableSetup: true,
        },
      }),
      inventory: [item("laptop", "13-inch laptop")],
    });

    expect(recommendations.slice(0, 2).map((recommendation) => recommendation.category)).toEqual(
      expect.arrayContaining(["storage", "cable_management"]),
    );
    expect(categoryScore(recommendations, "monitor").score).toBeLessThan(categoryScore(recommendations, "storage").score);
    expect(categoryScore(recommendations, "chair").score).toBeLessThan(categoryScore(recommendations, "storage").score);
  });

  it("recommends laptop upgrades for a slow computer user with high budget", () => {
    const recommendations = getCategoryRecommendations({
      profile: profile({
        budgetUsd: 1800,
        spendingStyle: "premium",
        problems: ["slow_computer", "low_productivity"],
      }),
      inventory: [
        {
          ...item("laptop", "Old slow laptop"),
          condition: "poor",
          painPoints: ["slow_computer"],
        },
      ],
    });

    expect(recommendations[0].category).toBe("laptop");
    expect(recommendations[0].problemsAddressed).toContain("slow_computer");
  });

  it("recommends monitor and desk lamp for eye strain with no monitor and bad lighting", () => {
    const recommendations = getCategoryRecommendations({
      profile: profile({
        budgetUsd: 400,
        problems: ["eye_strain", "bad_lighting"],
        constraints: {
          deskWidthInches: 48,
          roomLighting: "low",
          sharesSpace: false,
          portableSetup: false,
        },
      }),
      inventory: [item("laptop", "Laptop")],
    });

    expect(recommendations.slice(0, 2).map((recommendation) => recommendation.category)).toEqual(
      expect.arrayContaining(["monitor", "desk_lamp"]),
    );
    expect(categoryScore(recommendations, "monitor").problemsAddressed).toContain("eye_strain");
    expect(categoryScore(recommendations, "desk_lamp").problemsAddressed).toContain("bad_lighting");
  });

  it("uses normalized laptop RAM to raise laptop upgrades for slow-computer complaints", () => {
    const baseProfile = profile({
      budgetUsd: 700,
      problems: ["slow_computer"],
    });
    const lowRamRecommendations = getCategoryRecommendations({
      profile: baseProfile,
      inventory: [item("laptop", "MacBook Air 8 gb unified memory")],
    });
    const healthyRamRecommendations = getCategoryRecommendations({
      profile: baseProfile,
      inventory: [item("laptop", "Laptop 16GB RAM")],
    });

    expect(categoryScore(lowRamRecommendations, "laptop").score).toBeGreaterThan(
      categoryScore(healthyRamRecommendations, "laptop").score,
    );
    expect(categoryScore(lowRamRecommendations, "laptop").reasons.join(" ")).toContain("8GB RAM or less");
  });

  it("uses normalized monitor resolution to raise monitor upgrades below 1080p", () => {
    const baseProfile = profile({ problems: ["low_productivity"] });
    const lowResolutionRecommendations = getCategoryRecommendations({
      profile: baseProfile,
      inventory: [item("monitor", "Old 1366 x 768 monitor")],
    });
    const fullHdRecommendations = getCategoryRecommendations({
      profile: baseProfile,
      inventory: [item("monitor", "24 inch 1920 x 1080 monitor")],
    });

    expect(categoryScore(lowResolutionRecommendations, "monitor").score).toBeGreaterThan(
      categoryScore(fullHdRecommendations, "monitor").score,
    );
    expect(categoryScore(lowResolutionRecommendations, "monitor").reasons.join(" ")).toContain("below 1080p");
  });

  it("uses normalized input-device and chair specs for ergonomic replacement signals", () => {
    const mouseRecommendations = getCategoryRecommendations({
      profile: profile({ problems: ["wrist_pain"] }),
      inventory: [item("mouse", "basic optical mouse")],
    });
    const verticalMouseRecommendations = getCategoryRecommendations({
      profile: profile({ problems: ["wrist_pain"] }),
      inventory: [item("mouse", "vertical ergonomic mouse")],
    });
    const keyboardRecommendations = getCategoryRecommendations({
      profile: profile({ problems: ["noise_sensitivity"] }),
      inventory: [item("keyboard", "loud clicky blue switch keyboard")],
    });
    const chairRecommendations = getCategoryRecommendations({
      profile: profile({ problems: ["back_pain"] }),
      inventory: [item("chair", "basic chair without lumbar support")],
    });

    expect(categoryScore(mouseRecommendations, "mouse").score).toBeGreaterThan(
      categoryScore(verticalMouseRecommendations, "mouse").score,
    );
    expect(categoryScore(keyboardRecommendations, "keyboard").reasons.join(" ")).toContain("quiet replacement");
    expect(categoryScore(chairRecommendations, "chair").reasons.join(" ")).toContain("lacks lumbar support");
  });
});
