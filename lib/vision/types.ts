import type { InventoryCategory } from "@/lib/recommendation/types";

export type DimensionSizeClass = "tiny" | "small" | "medium" | "large" | "unknown";
export type SetupStyle = "minimalist" | "gaming" | "office" | "compact" | "premium" | "cluttered" | "unknown";

export interface DimensionEstimate {
  sizeClass: DimensionSizeClass;
  relativeWidthRatio: number;
  relativeHeightRatio: number;
  confidence: number;
  needsReferenceObject: boolean;
}

export interface DetectionBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedObject {
  label: string;
  category: InventoryCategory;
  confidence: number;
  bbox: DetectionBoundingBox;
  frameTimestampMs: number;
}

export interface SampledFrame {
  canvas: HTMLCanvasElement;
  timestampMs: number;
  width: number;
  height: number;
  averageBrightness: number;
}

export interface ScanCategorySummary {
  category: InventoryCategory;
  labels: string[];
  confidence: number;
  countEstimate: number;
  frameHits: number;
  sizeEstimate: DimensionEstimate;
}

export interface ScanSetupSignals {
  hasLaptop: boolean;
  hasMonitor: boolean;
  hasKeyboard: boolean;
  hasMouse: boolean;
  hasChair: boolean;
  hasDeskLamp: boolean;
  possibleLaptopOnlySetup: boolean;
  possiblePoorLighting: boolean;
  possibleClutter: boolean;
}

export interface SuggestedInventoryItem {
  id: string;
  category: InventoryCategory;
  confidence: number;
  estimatedCount: number;
  sizeClass: DimensionSizeClass;
  suggestedBrand: string;
  suggestedModel: string;
  sourceLabels: string[];
}

export interface ScanSummary {
  sampledFrameCount: number;
  totalDetections: number;
  averageBrightness: number;
  detectedCategories: ScanCategorySummary[];
  setupSignals: ScanSetupSignals;
  estimatedStyle: SetupStyle;
  possibleIssues: string[];
  suggestedInventoryItems: SuggestedInventoryItem[];
}
