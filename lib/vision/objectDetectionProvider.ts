import type { InventoryCategory, ProductCategory } from "@/lib/recommendation/types";
import type { DetectedObject, DetectionBoundingBox } from "./types";

export interface ObjectDetectionProvider {
  name: string;
  load(): Promise<void>;
  detect(image: HTMLCanvasElement | HTMLVideoElement): Promise<DetectedObject[]>;
}

const labelCategoryMap: Array<[RegExp, ProductCategory | "other" | "unknown"]> = [
  [/\b(laptop|notebook|macbook)\b/i, "laptop"],
  [/\b(tv|monitor|display|screen)\b/i, "monitor"],
  [/\b(keyboard)\b/i, "keyboard"],
  [/\b(mouse|trackball)\b/i, "mouse"],
  [/\b(chair|seat)\b/i, "chair"],
  [/\b(headphone|headset|earbud)\b/i, "headphones"],
  [/\b(camera|webcam)\b/i, "webcam"],
  [/\b(book|box|shelf|drawer|container)\b/i, "storage"],
  [/\b(remote|book|cell phone|cup)\b/i, "other"],
];

export function clampConfidence(confidence: number): number {
  if (!Number.isFinite(confidence)) return 0;
  return Math.max(0, Math.min(1, confidence));
}

export function normalizeDetectionLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

export function categoryFromDetectionLabel(label: string): InventoryCategory {
  const normalized = normalizeDetectionLabel(label);
  const match = labelCategoryMap.find(([pattern]) => pattern.test(normalized));

  return match?.[1] ?? "unknown";
}

export function createBoundingBox(box: DetectionBoundingBox): DetectionBoundingBox {
  return {
    x: Math.max(0, Math.round(box.x)),
    y: Math.max(0, Math.round(box.y)),
    width: Math.max(0, Math.round(box.width)),
    height: Math.max(0, Math.round(box.height)),
  };
}

export function createDetectedObject(
  label: string,
  confidence: number,
  bbox: DetectionBoundingBox,
  frameTimestampMs = 0,
): DetectedObject {
  return {
    label: normalizeDetectionLabel(label),
    category: categoryFromDetectionLabel(label),
    confidence: clampConfidence(confidence),
    bbox: createBoundingBox(bbox),
    frameTimestampMs,
  };
}
