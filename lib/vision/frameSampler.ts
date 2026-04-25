import type { SampledFrame } from "./types";

export const FRAME_SAMPLE_INTERVAL_MS = 750;
export const MAX_SCAN_FRAMES = 30;

function averageBrightnessFromCanvas(canvas: HTMLCanvasElement): number {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return 0;

  const { width, height } = canvas;
  const { data } = context.getImageData(0, 0, width, height);
  const step = Math.max(4, Math.floor((width * height) / 18_000));
  let brightnessTotal = 0;
  let sampleCount = 0;

  for (let index = 0; index < data.length; index += 4 * step) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    brightnessTotal += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sampleCount += 1;
  }

  return sampleCount > 0 ? Math.round(brightnessTotal / sampleCount) : 0;
}

export function captureVideoFrame(video: HTMLVideoElement, timestampMs: number): SampledFrame {
  const width = video.videoWidth || video.clientWidth || 640;
  const height = video.videoHeight || video.clientHeight || 480;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("The browser could not create a canvas context for scanning.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(video, 0, 0, width, height);

  return {
    canvas,
    timestampMs,
    width,
    height,
    averageBrightness: averageBrightnessFromCanvas(canvas),
  };
}
