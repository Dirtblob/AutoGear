import type { InventoryCategory } from "@/lib/recommendation/types";
import type {
  DetectedObject,
  DimensionEstimate,
  SampledFrame,
  ScanCategorySummary,
  ScanSetupSignals,
  ScanSummary,
  SuggestedInventoryItem,
} from "./types";
import { estimateObjectDimensions } from "./dimensionEstimator";
import { inferSetupStyle } from "./styleSignals";

const supportedSuggestionCategories = new Set<InventoryCategory>([
  "laptop",
  "monitor",
  "keyboard",
  "mouse",
  "chair",
  "desk_lamp",
  "headphones",
  "webcam",
  "storage",
  "cable_management",
]);

const categoryModelNames: Partial<Record<InventoryCategory, string>> = {
  laptop: "Laptop",
  monitor: "Monitor",
  keyboard: "Keyboard",
  mouse: "Mouse",
  chair: "Chair",
  desk_lamp: "Desk lamp",
  headphones: "Headphones",
  webcam: "Webcam",
  storage: "Desk storage",
  cable_management: "Cable organizer",
};

const clutterLabels = new Set(["book", "cell phone", "remote", "cup"]);

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function detectionsByFrame(detections: DetectedObject[]): Map<number, DetectedObject[]> {
  const frames = new Map<number, DetectedObject[]>();

  for (const detection of detections) {
    const existing = frames.get(detection.frameTimestampMs) ?? [];
    existing.push(detection);
    frames.set(detection.frameTimestampMs, existing);
  }

  return frames;
}

function frameByTimestamp(frames: SampledFrame[]): Map<number, SampledFrame> {
  return new Map(frames.map((frame) => [frame.timestampMs, frame]));
}

function buildDetectedCategories(detections: DetectedObject[], frames: SampledFrame[]): ScanCategorySummary[] {
  const grouped = new Map<InventoryCategory, DetectedObject[]>();
  const framesByTime = frameByTimestamp(frames);

  for (const detection of detections) {
    if (detection.category === "unknown") continue;
    const existing = grouped.get(detection.category) ?? [];
    existing.push(detection);
    grouped.set(detection.category, existing);
  }

  const perFrame = detectionsByFrame(detections);

  return [...grouped.entries()]
    .map(([category, items]) => {
      const labels = Array.from(new Set(items.map((item) => item.label)));
      const frameHits = new Set(items.map((item) => item.frameTimestampMs)).size;
      const countEstimate = Math.max(
        1,
        ...[...perFrame.values()].map(
          (frameDetections) => frameDetections.filter((item) => item.category === category).length,
        ),
      );
      const leadDetection =
        [...items].sort((left, right) => right.confidence - left.confidence || right.bbox.width - left.bbox.width)[0];
      const estimateFrame = framesByTime.get(leadDetection.frameTimestampMs) ?? frames[0];
      const sizeEstimate: DimensionEstimate = estimateFrame
        ? estimateObjectDimensions(leadDetection, estimateFrame)
        : {
            sizeClass: "unknown",
            relativeWidthRatio: 0,
            relativeHeightRatio: 0,
            confidence: 0,
            needsReferenceObject: true,
          };

      return {
        category,
        labels,
        confidence: Math.round(average(items.map((item) => item.confidence)) * 100) / 100,
        countEstimate,
        frameHits,
        sizeEstimate,
      };
    })
    .sort((left, right) => right.confidence - left.confidence || right.frameHits - left.frameHits);
}

function buildSignals(categories: ScanCategorySummary[], frames: SampledFrame[], detections: DetectedObject[]): ScanSetupSignals {
  const categorySet = new Set(categories.map((category) => category.category));
  const averageFrameBrightness = average(frames.map((frame) => frame.averageBrightness));
  const clutterCount = detections.filter((detection) => clutterLabels.has(detection.label)).length;

  return {
    hasLaptop: categorySet.has("laptop"),
    hasMonitor: categorySet.has("monitor"),
    hasKeyboard: categorySet.has("keyboard"),
    hasMouse: categorySet.has("mouse"),
    hasChair: categorySet.has("chair"),
    hasDeskLamp: categorySet.has("desk_lamp"),
    possibleLaptopOnlySetup: categorySet.has("laptop") && !categorySet.has("monitor"),
    possiblePoorLighting: averageFrameBrightness > 0 && averageFrameBrightness < 90,
    possibleClutter: clutterCount >= 2 || detections.length >= 10,
  };
}

function buildSuggestedInventoryItems(categories: ScanCategorySummary[]): SuggestedInventoryItem[] {
  return categories
    .filter((category) => supportedSuggestionCategories.has(category.category))
    .map((category) => ({
      id: `${category.category}-${category.labels[0] ?? category.category}`,
      category: category.category,
      confidence: category.confidence,
      estimatedCount: category.countEstimate,
      sizeClass: category.sizeEstimate.sizeClass,
      suggestedBrand: "",
      suggestedModel: categoryModelNames[category.category] ?? category.category.replaceAll("_", " "),
      sourceLabels: category.labels,
    }));
}

function buildPossibleIssues(setupSignals: ScanSetupSignals): string[] {
  const issues: string[] = [];

  if (setupSignals.possibleLaptopOnlySetup) {
    issues.push("Possible laptop-only setup");
    issues.push("No external monitor detected");
  }

  if (setupSignals.possiblePoorLighting) {
    issues.push("Lighting may be weak");
  }

  if (setupSignals.possibleClutter) {
    issues.push("Desk appears cluttered");
  }

  return issues;
}

export function aggregateScanSummary(frames: SampledFrame[], detections: DetectedObject[]): ScanSummary {
  const detectedCategories = buildDetectedCategories(detections, frames);
  const setupSignals = buildSignals(detectedCategories, frames, detections);
  const estimatedStyle = inferSetupStyle(detectedCategories, detections, frames, setupSignals);
  const possibleIssues = buildPossibleIssues(setupSignals);

  return {
    sampledFrameCount: frames.length,
    totalDetections: detections.length,
    averageBrightness: Math.round(average(frames.map((frame) => frame.averageBrightness))),
    detectedCategories,
    setupSignals,
    estimatedStyle,
    possibleIssues,
    suggestedInventoryItems: buildSuggestedInventoryItems(detectedCategories),
  };
}
