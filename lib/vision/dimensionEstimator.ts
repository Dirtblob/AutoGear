import type { DetectedObject, DimensionEstimate, SampledFrame } from "./types";

function roundRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sizeClassFromAreaRatio(areaRatio: number): DimensionEstimate["sizeClass"] {
  if (!Number.isFinite(areaRatio) || areaRatio <= 0) return "unknown";
  if (areaRatio < 0.015) return "tiny";
  if (areaRatio < 0.06) return "small";
  if (areaRatio < 0.18) return "medium";
  return "large";
}

export function estimateObjectDimensions(
  detection: DetectedObject,
  frame: Pick<SampledFrame, "width" | "height">,
): DimensionEstimate {
  const frameWidth = Math.max(frame.width, 1);
  const frameHeight = Math.max(frame.height, 1);
  const frameArea = frameWidth * frameHeight;
  const bboxArea = Math.max(detection.bbox.width, 0) * Math.max(detection.bbox.height, 0);
  const relativeWidthRatio = detection.bbox.width / frameWidth;
  const relativeHeightRatio = detection.bbox.height / frameHeight;
  const areaRatio = bboxArea / Math.max(frameArea, 1);
  const confidence = clamp(detection.confidence * 0.6 + Math.max(relativeWidthRatio, relativeHeightRatio) * 0.4, 0.15, 0.92);

  return {
    sizeClass: sizeClassFromAreaRatio(areaRatio),
    relativeWidthRatio: roundRatio(relativeWidthRatio),
    relativeHeightRatio: roundRatio(relativeHeightRatio),
    confidence: Math.round(confidence * 100) / 100,
    needsReferenceObject: true,
  };
}
