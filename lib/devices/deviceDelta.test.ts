import { describe, expect, it } from "vitest";
import { findDeviceById } from "./deviceCatalog";
import { computeDeviceDelta } from "./deviceDelta";
import type { CatalogDevice } from "./deviceTypes";
import type { UserProfile } from "@/lib/recommendation/types";

function mustDevice(id: string): CatalogDevice {
  const device = findDeviceById(id);
  if (!device) throw new Error(`Missing device ${id}`);
  return device;
}

type ProfileOverrides = Partial<Omit<UserProfile, "constraints">> & {
  constraints?: Partial<UserProfile["constraints"]>;
};

function profile(overrides: ProfileOverrides = {}): UserProfile {
  const base: UserProfile = {
    id: "device-delta-profile",
    name: "Test User",
    ageRange: "25-34",
    profession: "Software engineer",
    budgetUsd: 1200,
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

describe("computeDeviceDelta", () => {
  it("shows positive speed and RAM deltas from MacBook Air M1 8GB to MacBook Air M5 24GB", () => {
    const delta = computeDeviceDelta(
      mustDevice("device-laptop-apple-macbook-air-m1-8gb"),
      mustDevice("device-laptop-apple-macbook-air-m5-24gb"),
      profile({ problems: ["slow_computer"] }),
    );

    expect(delta.traitDeltas.speed).toBeGreaterThan(20);
    expect(delta.traitDeltas.ramHeadroom).toBeGreaterThan(40);
    expect(delta.problemSpecificImprovements.join(" ")).toContain("Ram Headroom");
  });

  it("gives a no-monitor user strong screen workspace delta for a 27-inch monitor", () => {
    const delta = computeDeviceDelta(
      null,
      mustDevice("device-monitor-dell-s2722qc"),
      profile({ problems: ["eye_strain", "low_productivity"] }),
    );

    expect(delta.traitDeltas.screenWorkspace).toBeGreaterThan(45);
    expect(delta.totalImprovementScore).toBeGreaterThan(80);
  });

  it("penalizes 34/40-inch ultrawides for small desks", () => {
    const smallDesk = profile({
      problems: ["small_space", "low_productivity"],
      roomConstraints: ["small_space", "limited_desk_width"],
      constraints: { deskWidthInches: 32 },
    });
    const compactDelta = computeDeviceDelta(null, mustDevice("device-monitor-dell-s2722qc"), smallDesk);
    const ultrawideDelta = computeDeviceDelta(null, mustDevice("device-monitor-dell-u4025qw"), smallDesk);

    expect(ultrawideDelta.regressions.join(" ")).toContain("large");
    expect(ultrawideDelta.totalImprovementScore).toBeLessThan(compactDelta.totalImprovementScore);
  });

  it("penalizes loud keyboards for noise-sensitive users", () => {
    const quiet = computeDeviceDelta(
      null,
      mustDevice("device-keyboard-logitech-mx-keys-s"),
      profile({ problems: ["noise_sensitivity"], preferences: ["quiet products"] }),
    );
    const loud = computeDeviceDelta(
      null,
      mustDevice("device-keyboard-keychron-k2-pro-blue-switch"),
      profile({ problems: ["noise_sensitivity"], preferences: ["quiet products"] }),
    );

    expect(loud.totalImprovementScore).toBeLessThan(quiet.totalImprovementScore);
    expect(loud.regressions.join(" ")).toContain("too loud");
  });

  it("rewards ergonomic vertical mice for wrist-pain users", () => {
    const basicMouse = mustDevice("device-mouse-apple-magic-mouse-usb-c");
    const verticalMouse = mustDevice("device-mouse-logitech-lift-vertical-mouse");
    const delta = computeDeviceDelta(basicMouse, verticalMouse, profile({ problems: ["wrist_pain"] }));

    expect(delta.traitDeltas.wristComfort).toBeGreaterThan(30);
    expect(delta.totalImprovementScore).toBeGreaterThan(75);
  });

  it("rewards chairs with lumbar support and adjustability for back-pain users", () => {
    const delta = computeDeviceDelta(
      mustDevice("device-chair-ikea-markus"),
      mustDevice("device-chair-steelcase-leap-v2"),
      profile({ problems: ["back_pain"] }),
    );

    expect(delta.traitDeltas.lumbarSupport).toBeGreaterThan(40);
    expect(delta.traitDeltas.adjustability).toBeGreaterThan(25);
  });
});
