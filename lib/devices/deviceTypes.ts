export const DEVICE_CATEGORIES = [
  "laptop",
  "monitor",
  "keyboard",
  "mouse",
  "chair",
  "desk",
  "desk_lamp",
  "headphones",
  "earbuds",
  "webcam",
  "microphone",
  "tablet",
  "phone",
  "docking_station",
  "monitor_arm",
  "laptop_stand",
  "external_storage",
  "router",
  "printer",
  "smart_speaker",
  "accessibility_device",
] as const;

export type DeviceCategory = (typeof DEVICE_CATEGORIES)[number];

export type DeviceLifecycleStatus = "current" | "recent" | "older" | "discontinued" | "unknown";
export type DeviceSoundLevel = "silent" | "quiet" | "normal" | "loud";
export type DeviceClampForceLevel = "low" | "medium" | "high";
export type DeviceNoiseIsolationLevel = "low" | "medium" | "high";

export type DeviceSpecsValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | null
  | undefined;

export type DeviceSpecs = Record<string, DeviceSpecsValue>;
export type NormalizedDeviceSpecs = Record<string, DeviceSpecsValue>;
export type DeviceTraitRatings = Record<string, number>;

export interface DeviceDimensionsMm {
  length?: number;
  width?: number;
  height?: number;
}

export interface MouseErgonomicSpecs {
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  weightGrams?: number;
  recommendedGripStyles?: string[];
  recommendedHandLengthMinMm?: number;
  recommendedHandLengthMaxMm?: number;
  recommendedPalmWidthMinMm?: number;
  recommendedPalmWidthMaxMm?: number;
}

export interface KeyboardErgonomicSpecs {
  layout?: string;
  widthMm?: number;
  depthMm?: number;
  heightMm?: number;
  switchType?: string;
  actuationForceG?: number;
  soundLevel?: DeviceSoundLevel;
  ergonomicLayout?: boolean;
}

export interface HeadphonesErgonomicSpecs {
  weightGrams?: number;
  clampForceLevel?: DeviceClampForceLevel;
  earCupInnerHeightMm?: number;
  earCupInnerWidthMm?: number;
  noiseIsolationLevel?: DeviceNoiseIsolationLevel;
}

export interface MonitorErgonomicSpecs {
  screenSizeInches?: number;
  resolution?: string;
  refreshRateHz?: number;
  curvatureR?: number;
  standHeightAdjustable?: boolean;
  vesaMount?: boolean;
}

export interface LaptopErgonomicSpecs {
  screenSizeInches?: number;
  weightGrams?: number;
  keyboardLayout?: string;
  batteryLifeHours?: number;
}

export interface DeviceErgonomicSpecs {
  category: DeviceCategory;
  weightGrams?: number;
  dimensionsMm?: DeviceDimensionsMm;
  mouse?: MouseErgonomicSpecs;
  keyboard?: KeyboardErgonomicSpecs;
  headphones?: HeadphonesErgonomicSpecs;
  monitor?: MonitorErgonomicSpecs;
  laptop?: LaptopErgonomicSpecs;
}

export const COMMON_DEVICE_TRAITS = [
  "speed",
  "comfort",
  "ergonomics",
  "portability",
  "sizeEfficiency",
  "spaceCost",
  "noise",
  "productivity",
  "accessibility",
  "compatibility",
  "buildQuality",
  "durability",
  "repairability",
  "powerEfficiency",
  "value",
  "futureProofing",
  "setupSimplicity",
  "confidence",
] as const;

export const CATEGORY_DEVICE_TRAITS = {
  laptop: [
    "cpuSpeed",
    "gpuSpeed",
    "ramHeadroom",
    "storageHeadroom",
    "batteryLife",
    "portability",
    "thermalSustainability",
    "displayQuality",
    "externalDisplaySupport",
    "aiLocalCapability",
    "codingSuitability",
    "creativeWorkSuitability",
    "gamingSuitability",
  ],
  monitor: [
    "screenWorkspace",
    "textClarity",
    "colorQuality",
    "refreshSmoothness",
    "eyeComfort",
    "deskSpaceFit",
    "portConvenience",
    "macCompatibility",
    "gamingSuitability",
    "codingSuitability",
    "creativeWorkSuitability",
  ],
  keyboard: [
    "typingComfort",
    "noiseQuietness",
    "ergonomicSupport",
    "layoutEfficiency",
    "buildQuality",
    "portability",
    "gamingResponsiveness",
  ],
  mouse: [
    "wristComfort",
    "ergonomicSupport",
    "portability",
    "precision",
    "quietness",
    "productivityButtons",
    "gamingResponsiveness",
  ],
  chair: [
    "backSupport",
    "lumbarSupport",
    "adjustability",
    "longSessionComfort",
    "sizeFit",
    "usedMarketValue",
  ],
  headphones: [
    "noiseIsolation",
    "activeNoiseCanceling",
    "comfort",
    "micQuality",
    "batteryLife",
    "portability",
    "focusSupport",
  ],
  earbuds: [
    "noiseIsolation",
    "activeNoiseCanceling",
    "comfort",
    "micQuality",
    "batteryLife",
    "portability",
    "focusSupport",
  ],
  webcam: ["callQuality", "lowLightPerformance", "setupSimplicity", "compatibility", "professionalism"],
  microphone: ["callQuality", "lowLightPerformance", "setupSimplicity", "compatibility", "professionalism"],
  desk_lamp: [
    "eyeComfort",
    "deskCoverage",
    "colorTemperatureControl",
    "glareReduction",
    "spaceEfficiency",
  ],
  desk: ["ergonomics", "spaceEfficiency", "adjustability", "stability", "cableManagement"],
  docking_station: ["portConvenience", "compatibility", "powerDelivery", "setupSimplicity", "futureProofing"],
  monitor_arm: ["ergonomics", "deskSpaceFit", "adjustability", "buildQuality", "setupSimplicity"],
  laptop_stand: ["ergonomics", "portability", "deskSpaceFit", "adjustability", "stability"],
  external_storage: ["speed", "storageHeadroom", "portability", "durability", "value"],
  tablet: ["speed", "displayQuality", "portability", "batteryLife", "creativeWorkSuitability"],
  phone: ["speed", "displayQuality", "batteryLife", "cameraQuality", "portability"],
  router: ["speed", "coverage", "setupSimplicity", "compatibility", "futureProofing"],
  printer: ["setupSimplicity", "compatibility", "noise", "value", "spaceEfficiency"],
  smart_speaker: ["setupSimplicity", "compatibility", "soundQuality", "privacy", "value"],
  accessibility_device: ["accessibility", "setupSimplicity", "compatibility", "comfort", "reliability"],
} as const satisfies Record<DeviceCategory, readonly string[]>;

export const BAD_DIRECTION_TRAITS = ["noise", "spaceCost"] as const;

export interface RawCatalogDevice {
  id: string;
  category: DeviceCategory;
  brand: string;
  model: string;
  displayName: string;
  releaseYear?: number;
  aliases?: string[];
  generation?: string;
  lifecycleStatus?: DeviceLifecycleStatus;
  estimatedPriceCents: number;
  typicalUsedPriceCents?: number;
  specs: DeviceSpecs;
  ergonomicSpecs?: DeviceErgonomicSpecs;
  normalizedSpecs?: NormalizedDeviceSpecs;
  traitRatings?: DeviceTraitRatings;
  traitConfidence?: number;
  sourceUrls?: string[];
  lastVerifiedAt?: string;
  searchQueries?: string[];
}

export type DeviceCatalogItem = RawCatalogDevice;

export interface CatalogDevice extends RawCatalogDevice {
  aliases: string[];
  lifecycleStatus: DeviceLifecycleStatus;
  normalizedSpecs: NormalizedDeviceSpecs;
  traitRatings: DeviceTraitRatings;
  traitConfidence: number;
  sourceUrls: string[];
  lastVerifiedAt: string;
  searchQueries: string[];
  strengths: string[];
  weaknesses: string[];
}

export interface DeviceDeltaDeviceSummary {
  label: string;
  category: DeviceCategory | string;
  missing: boolean;
  confidence: number;
}

export interface DeviceDelta {
  currentDevice: DeviceDeltaDeviceSummary;
  candidateDevice: DeviceDeltaDeviceSummary;
  traitDeltas: Record<string, number>;
  totalImprovementScore: number;
  problemSpecificImprovements: string[];
  regressions: string[];
  explanationFacts: string[];
  confidence: number;
}

export interface DeviceSearchQuery {
  text: string;
  category?: DeviceCategory | string;
  limit?: number;
}

export interface DeviceSearchResult {
  device: CatalogDevice;
  score: number;
  matchedFields: string[];
}

export interface DeviceValidationIssue {
  id: string;
  severity: "error" | "warning";
  message: string;
}

export function isDeviceCategory(value: string): value is DeviceCategory {
  return (DEVICE_CATEGORIES as readonly string[]).includes(value);
}
