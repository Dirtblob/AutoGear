import type { UserProblem, UserProfile } from "@/lib/recommendation/types";
import {
  BAD_DIRECTION_TRAITS,
  CATEGORY_DEVICE_TRAITS,
  COMMON_DEVICE_TRAITS,
  type CatalogDevice,
  type DeviceCategory,
  type DeviceTraitRatings,
  type NormalizedDeviceSpecs,
} from "./deviceTypes";

const allTraitKeys = new Set<string>([
  ...COMMON_DEVICE_TRAITS,
  ...Object.values(CATEGORY_DEVICE_TRAITS).flat(),
]);

export const DEVICE_TRAIT_KEYS = [...allTraitKeys].sort();

export const problemTraitMap: Record<UserProblem, string[]> = {
  eye_strain: ["textClarity", "eyeComfort", "displayQuality", "colorQuality", "glareReduction", "deskCoverage"],
  neck_pain: ["ergonomics", "screenWorkspace", "deskSpaceFit", "adjustability", "eyeComfort"],
  wrist_pain: ["wristComfort", "ergonomicSupport", "typingComfort", "quietness", "noiseQuietness"],
  back_pain: ["backSupport", "lumbarSupport", "adjustability", "longSessionComfort", "ergonomics"],
  slow_computer: [
    "speed",
    "cpuSpeed",
    "gpuSpeed",
    "ramHeadroom",
    "storageHeadroom",
    "thermalSustainability",
    "aiLocalCapability",
  ],
  low_productivity: [
    "productivity",
    "screenWorkspace",
    "portConvenience",
    "layoutEfficiency",
    "productivityButtons",
    "callQuality",
    "setupSimplicity",
  ],
  poor_focus: [
    "focusSupport",
    "noiseIsolation",
    "activeNoiseCanceling",
    "quietness",
    "noiseQuietness",
    "eyeComfort",
  ],
  noise_sensitivity: ["noiseIsolation", "activeNoiseCanceling", "quietness", "noiseQuietness", "noise"],
  clutter: ["sizeEfficiency", "spaceEfficiency", "deskSpaceFit", "portConvenience", "setupSimplicity"],
  bad_lighting: ["eyeComfort", "deskCoverage", "colorTemperatureControl", "glareReduction", "lowLightPerformance"],
  limited_mobility: ["accessibility", "setupSimplicity", "comfort", "ergonomics", "adjustability"],
  small_space: ["sizeEfficiency", "deskSpaceFit", "spaceEfficiency", "portability", "spaceCost"],
  budget_limited: ["value", "repairability", "durability", "usedMarketValue"],
};

const categoryBaselines: Partial<Record<DeviceCategory, Partial<DeviceTraitRatings>>> = {
  laptop: { speed: 28, cpuSpeed: 26, ramHeadroom: 24, storageHeadroom: 32, portability: 54 },
  monitor: { screenWorkspace: 8, textClarity: 18, eyeComfort: 24, deskSpaceFit: 90 },
  keyboard: { typingComfort: 38, noiseQuietness: 40, ergonomicSupport: 24 },
  mouse: { wristComfort: 32, ergonomicSupport: 22, precision: 42, quietness: 45 },
  chair: { backSupport: 24, lumbarSupport: 18, adjustability: 22, longSessionComfort: 26 },
  desk_lamp: { eyeComfort: 18, deskCoverage: 14, colorTemperatureControl: 8, glareReduction: 12 },
  headphones: { focusSupport: 18, noiseIsolation: 18, activeNoiseCanceling: 0, comfort: 36 },
  earbuds: { focusSupport: 16, noiseIsolation: 22, activeNoiseCanceling: 0, comfort: 32 },
  webcam: { callQuality: 28, lowLightPerformance: 20, setupSimplicity: 55 },
  microphone: { callQuality: 24, compatibility: 55, setupSimplicity: 50 },
};

export function clampTrait(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeTraitRatings(ratings: DeviceTraitRatings): DeviceTraitRatings {
  return Object.fromEntries(
    Object.entries(ratings)
      .filter(([, value]) => Number.isFinite(value))
      .map(([key, value]) => [key, clampTrait(value)]),
  );
}

export function isBadDirectionTrait(trait: string): boolean {
  return (BAD_DIRECTION_TRAITS as readonly string[]).includes(trait);
}

export function traitDelta(candidate: number, current: number, trait: string): number {
  return isBadDirectionTrait(trait) ? current - candidate : candidate - current;
}

export function getRelevantTraitsForProblems(
  problems: UserProblem[] = [],
  category?: DeviceCategory | string,
): string[] {
  const traits = new Set<string>();

  for (const problem of problems) {
    problemTraitMap[problem]?.forEach((trait) => traits.add(trait));
  }

  if (category && category in CATEGORY_DEVICE_TRAITS) {
    CATEGORY_DEVICE_TRAITS[category as DeviceCategory].forEach((trait) => {
      if (traits.size < 10) traits.add(trait);
    });
  }

  ["productivity", "comfort", "ergonomics", "value", "compatibility"].forEach((trait) => traits.add(trait));
  return [...traits];
}

export function getBaselineTraitRatings(category: DeviceCategory | string): DeviceTraitRatings {
  const baseline: DeviceTraitRatings = {
    speed: 25,
    comfort: 30,
    ergonomics: 25,
    portability: 35,
    sizeEfficiency: 45,
    spaceCost: 12,
    noise: 25,
    productivity: 24,
    accessibility: 25,
    compatibility: 45,
    buildQuality: 30,
    durability: 30,
    repairability: 25,
    powerEfficiency: 35,
    value: 42,
    futureProofing: 22,
    setupSimplicity: 55,
    confidence: 45,
    ...(categoryBaselines[category as DeviceCategory] ?? {}),
  };

  return normalizeTraitRatings(baseline);
}

export function summarizeDeviceSpecs(device: Pick<CatalogDevice, "category" | "normalizedSpecs" | "specs">): string {
  const specs = { ...device.specs, ...device.normalizedSpecs } as NormalizedDeviceSpecs;

  if (device.category === "laptop") {
    return [
      specs.chip,
      specs.ramGb ? `${specs.ramGb}GB RAM` : null,
      specs.storageGb ? `${specs.storageGb}GB` : null,
      specs.screenSizeInches ? `${specs.screenSizeInches}"` : specs.screenSize,
      specs.weightPounds ? `${specs.weightPounds} lb` : null,
    ]
      .filter(Boolean)
      .join(", ");
  }

  if (device.category === "monitor") {
    return [
      specs.sizeInches ? `${specs.sizeInches}"` : null,
      specs.resolution,
      specs.ppi ? `${specs.ppi} PPI` : null,
      specs.refreshRateHz ? `${specs.refreshRateHz}Hz` : null,
      specs.panelType,
      specs.usbC ? "USB-C" : null,
    ]
      .filter(Boolean)
      .join(", ");
  }

  if (device.category === "keyboard") {
    return [specs.layout, specs.switchType, specs.noiseLevel, specs.lowProfile ? "low profile" : null]
      .filter(Boolean)
      .join(", ");
  }

  if (device.category === "mouse") {
    return [specs.vertical ? "vertical" : specs.trackball ? "trackball" : null, specs.buttons ? `${specs.buttons} buttons` : null, specs.noiseLevel]
      .filter(Boolean)
      .join(", ");
  }

  if (device.category === "chair") {
    return [
      specs.lumbarSupport ? "lumbar" : null,
      specs.adjustable ? "adjustable" : null,
      specs.usedMarketCommon ? "used market common" : null,
    ]
      .filter(Boolean)
      .join(", ");
  }

  return Object.entries(specs)
    .filter(([, value]) => value !== undefined && value !== null)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
    .join(", ");
}

export function getDeviceTraitBadges(device: Pick<CatalogDevice, "traitRatings">, maxItems = 3): string[] {
  return Object.entries(device.traitRatings)
    .filter(([trait]) => trait !== "confidence" && !isBadDirectionTrait(trait))
    .sort((left, right) => right[1] - left[1])
    .slice(0, maxItems)
    .map(([trait, value]) => `${humanizeTrait(trait)} ${Math.round(value)}`);
}

export function getDeviceStrengths(device: Pick<CatalogDevice, "traitRatings">, maxItems = 5): string[] {
  return Object.entries(device.traitRatings)
    .filter(([trait, value]) => trait !== "confidence" && !isBadDirectionTrait(trait) && value >= 76)
    .sort((left, right) => right[1] - left[1])
    .slice(0, maxItems)
    .map(([trait]) => humanizeTrait(trait));
}

export function getDeviceWeaknesses(device: Pick<CatalogDevice, "traitRatings">, maxItems = 4): string[] {
  const lowGoodTraits = Object.entries(device.traitRatings)
    .filter(([trait, value]) => trait !== "confidence" && !isBadDirectionTrait(trait) && value <= 38)
    .map(([trait, value]) => [trait, 100 - value] as const);
  const highBadTraits = Object.entries(device.traitRatings)
    .filter(([trait, value]) => isBadDirectionTrait(trait) && value >= 66)
    .map(([trait, value]) => [trait, value] as const);

  return [...lowGoodTraits, ...highBadTraits]
    .sort((left, right) => right[1] - left[1])
    .slice(0, maxItems)
    .map(([trait]) => humanizeTrait(trait));
}

export function profileWorkloadTags(profile?: UserProfile): string[] {
  if (!profile) return [];

  const text = [profile.profession, ...profile.preferences, ...profile.accessibilityNeeds]
    .join(" ")
    .toLowerCase();
  const tags = new Set<string>();

  if (/code|developer|software|engineer|student|data/.test(text)) tags.add("coding");
  if (/design|video|photo|creative|music|3d/.test(text)) tags.add("creative");
  if (/game|gaming/.test(text)) tags.add("gaming");
  if (/ai|machine learning|local model|llm/.test(text)) tags.add("ai");
  if (/travel|portable|hybrid|commute/.test(text) || profile.constraints.portableSetup) tags.add("portable");

  return [...tags];
}

export function humanizeTrait(trait: string): string {
  return trait
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (value) => value.toUpperCase());
}
