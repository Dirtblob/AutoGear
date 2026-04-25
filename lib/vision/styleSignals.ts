import type { DetectedObject, SampledFrame, ScanCategorySummary, ScanSetupSignals, SetupStyle } from "./types";

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function categoryCount(categories: ScanCategorySummary[], target: string): number {
  return categories
    .filter((category) => category.category === target)
    .reduce((total, category) => total + category.countEstimate, 0);
}

function isGamingLabel(label: string): boolean {
  return /\b(rgb|gaming|mechanical)\b/i.test(label);
}

export function inferSetupStyle(
  categories: ScanCategorySummary[],
  detections: DetectedObject[],
  frames: SampledFrame[],
  setupSignals: ScanSetupSignals,
): SetupStyle {
  const monitorCount = categoryCount(categories, "monitor");
  const activeCategories = categories.filter((category) => category.countEstimate > 0);
  const averageFrameArea = average(frames.map((frame) => frame.width * frame.height));
  const averageDetectionArea = average(
    detections.map((detection) => Math.max(detection.bbox.width, 0) * Math.max(detection.bbox.height, 0)),
  );
  const objectDensity = frames.length > 0 ? detections.length / frames.length : detections.length;
  const areaDensity = averageFrameArea > 0 ? averageDetectionArea / averageFrameArea : 0;
  const gamingKeyboardDetected = detections.some(
    (detection) => detection.category === "keyboard" && isGamingLabel(detection.label),
  );

  if (monitorCount >= 2 && gamingKeyboardDetected) {
    return "gaming";
  }

  if (
    activeCategories.length <= 2 &&
    (setupSignals.hasLaptop || setupSignals.hasMonitor) &&
    !setupSignals.hasMouse &&
    !setupSignals.hasChair &&
    !setupSignals.possibleClutter
  ) {
    return "minimalist";
  }

  if (setupSignals.possibleClutter || objectDensity >= 8 || areaDensity >= 0.06) {
    return "cluttered";
  }

  if (areaDensity >= 0.035 || objectDensity >= 5) {
    return "compact";
  }

  if (setupSignals.hasMonitor && setupSignals.hasKeyboard && setupSignals.hasMouse && setupSignals.hasChair) {
    return "office";
  }

  // "premium" is intentionally deferred until later steps provide exact model or brand certainty.
  return "unknown";
}
