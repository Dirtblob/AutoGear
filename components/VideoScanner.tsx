"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ScanReview } from "@/components/ScanReview";
import { FRAME_SAMPLE_INTERVAL_MS, MAX_SCAN_FRAMES, captureVideoFrame } from "@/lib/vision/frameSampler";
import { aggregateScanSummary } from "@/lib/vision/scanAggregator";
import { TfjsCocoProvider } from "@/lib/vision/tfjsCocoProvider";
import type { DetectedObject, SampledFrame, ScanSummary } from "@/lib/vision/types";

type ScanState = "idle" | "camera_ready" | "loading_model" | "scanning" | "finished" | "error";

export function VideoScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const providerRef = useRef(new TfjsCocoProvider());
  const framesRef = useRef<SampledFrame[]>([]);
  const detectionsRef = useRef<DetectedObject[]>([]);
  const startedAtRef = useRef<number>(0);
  const scanActiveRef = useRef(false);
  const detectionRunningRef = useRef(false);

  const [scanState, setScanState] = useState<ScanState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [sampledFrames, setSampledFrames] = useState(0);
  const [latestDetections, setLatestDetections] = useState<DetectedObject[]>([]);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [videoSize, setVideoSize] = useState({ width: 1280, height: 720 });

  useEffect(() => {
    return () => {
      stopSampling();
      stopCamera();
    };
  }, []);

  async function persistVisionScanDebug(payload: {
    modelStatus: "loaded" | "unavailable";
    error?: string;
    summary?: {
      sampledFrameCount: number;
      totalDetections: number;
      estimatedStyle: string;
      possibleIssues: string[];
      detectedCategories: Array<{
        category: string;
        confidence: number;
        countEstimate: number;
      }>;
      suggestedInventoryCount: number;
    };
  }): Promise<void> {
    try {
      await fetch("/api/admin/vision-scan", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch {
      // Debug telemetry should never block the local scan flow.
    }
  }

  function stopSampling(): void {
    scanActiveRef.current = false;

    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function stopCamera(): void {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function enableCamera(): Promise<void> {
    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      stopCamera();
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setVideoSize({
          width: videoRef.current.videoWidth || 1280,
          height: videoRef.current.videoHeight || 720,
        });
      }

      setScanState("camera_ready");
    } catch (error) {
      setScanState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "The browser could not access the camera. Manual entry is still available.",
      );
    }
  }

  async function ensureModel(): Promise<void> {
    if (modelReady) return;

    setScanState("loading_model");
    await providerRef.current.load();
    setModelReady(true);
    await persistVisionScanDebug({
      modelStatus: "loaded",
    });
    setScanState(streamRef.current ? "camera_ready" : "idle");
  }

  async function sampleCurrentFrame(): Promise<void> {
    if (!videoRef.current || detectionRunningRef.current || !scanActiveRef.current) return;

    detectionRunningRef.current = true;
    try {
      const timestampMs = Math.round(performance.now() - startedAtRef.current);
      const frame = captureVideoFrame(videoRef.current, timestampMs);
      const detections = await providerRef.current.detect(frame.canvas);
      const stampedDetections = detections.map((detection) => ({
        ...detection,
        frameTimestampMs: timestampMs,
      }));

      framesRef.current = [...framesRef.current, frame];
      detectionsRef.current = [...detectionsRef.current, ...stampedDetections];
      setLatestDetections(stampedDetections);
      setSampledFrames(framesRef.current.length);

      if (framesRef.current.length >= MAX_SCAN_FRAMES) {
        finishScan();
      }
    } finally {
      detectionRunningRef.current = false;
    }
  }

  function finishScan(): void {
    stopSampling();
    const nextSummary = aggregateScanSummary(framesRef.current, detectionsRef.current);
    setSummary(nextSummary);
    void persistVisionScanDebug({
      modelStatus: modelReady ? "loaded" : "unavailable",
      summary: {
        sampledFrameCount: nextSummary.sampledFrameCount,
        totalDetections: nextSummary.totalDetections,
        estimatedStyle: nextSummary.estimatedStyle,
        possibleIssues: nextSummary.possibleIssues,
        detectedCategories: nextSummary.detectedCategories.map((category) => ({
          category: category.category,
          confidence: category.confidence,
          countEstimate: category.countEstimate,
        })),
        suggestedInventoryCount: nextSummary.suggestedInventoryItems.length,
      },
    });
    setScanState("finished");
  }

  async function startScan(): Promise<void> {
    if (!streamRef.current) {
      await enableCamera();
    }

    try {
      await ensureModel();
      framesRef.current = [];
      detectionsRef.current = [];
      startedAtRef.current = performance.now();
      scanActiveRef.current = true;
      setSummary(null);
      setSampledFrames(0);
      setLatestDetections([]);
      setErrorMessage(null);
      setScanState("scanning");

      await sampleCurrentFrame();
      intervalRef.current = window.setInterval(() => {
        void sampleCurrentFrame();
      }, FRAME_SAMPLE_INTERVAL_MS);
    } catch (error) {
      stopSampling();
      setScanState("error");
      void persistVisionScanDebug({
        modelStatus: "unavailable",
        error: error instanceof Error ? error.message : "The object detection model failed to load.",
      });
      setErrorMessage(
        error instanceof Error
          ? `${error.message} You can keep using manual inventory entry while the model is unavailable.`
          : "The object detection model failed to load. Manual entry is still available.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-panel backdrop-blur md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-moss">Camera scan</p>
          <h1 className="mt-3 font-display text-3xl font-semibold md:text-5xl">Walk the space and capture setup estimates</h1>
          <p className="mt-4 max-w-3xl leading-7 text-ink/66">
            AutoGear samples one frame every {FRAME_SAMPLE_INTERVAL_MS}ms, runs local browser-side object detection,
            and turns repeated detections into inventory suggestions you can review before saving.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void enableCamera()}
              className="inline-flex items-center justify-center rounded-full border border-ink/12 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
            >
              {streamRef.current ? "Reconnect camera" : "Enable camera"}
            </button>
            <button
              type="button"
              onClick={() => void startScan()}
              disabled={scanState === "loading_model" || scanState === "scanning"}
              className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-moss disabled:cursor-not-allowed disabled:opacity-60"
            >
              {scanState === "loading_model" ? "Loading model..." : scanState === "scanning" ? "Scanning..." : "Start scan"}
            </button>
            <button
              type="button"
              onClick={() => finishScan()}
              disabled={scanState !== "scanning"}
              className="inline-flex items-center justify-center rounded-full border border-ink/12 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-60"
            >
              Stop scan
            </button>
          </div>

          <div className="mt-6 overflow-hidden rounded-[1.75rem] bg-[linear-gradient(155deg,#17211f_0%,#284036_100%)] p-3 text-white">
            <div className="relative overflow-hidden rounded-[1.35rem] bg-black/40">
              <video ref={videoRef} playsInline muted className="aspect-video w-full object-cover" />
              <svg viewBox={`0 0 ${videoSize.width} ${videoSize.height}`} className="pointer-events-none absolute inset-0 h-full w-full">
                {latestDetections.map((detection, index) => (
                  <g key={`${detection.label}-${index}`}>
                    <rect
                      x={detection.bbox.x}
                      y={detection.bbox.y}
                      width={detection.bbox.width}
                      height={detection.bbox.height}
                      rx="8"
                      fill="none"
                      stroke="rgba(224,171,69,0.95)"
                      strokeWidth="4"
                    />
                    <text
                      x={detection.bbox.x + 8}
                      y={Math.max(18, detection.bbox.y - 8)}
                      fill="white"
                      fontSize="20"
                      fontWeight="700"
                    >
                      {detection.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/76">
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-2">
                {sampledFrames}/{MAX_SCAN_FRAMES} frames sampled
              </span>
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-2">
                {modelReady ? "COCO-SSD ready" : "Model not loaded yet"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-2">
                Detections are estimates
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
          <div className="rounded-[1.5rem] bg-mist/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Privacy</p>
            <p className="mt-2 text-sm leading-6 text-ink/72">
              Video is processed locally in your browser. Only approved inventory items are saved.
            </p>
          </div>

          <div className="rounded-[1.5rem] bg-mist/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">How to get a clean scan</p>
            <p className="mt-2 text-sm leading-6 text-ink/72">
              Move slowly around the desk area, keep the camera steady for a second or two on the monitor and chair,
              and stop once the main objects have been seen a few times.
            </p>
          </div>

          {errorMessage ? (
            <div className="rounded-[1.5rem] border border-clay/15 bg-clay/8 p-4 text-sm leading-6 text-clay">
              {errorMessage}
            </div>
          ) : null}

          <div className="rounded-[1.5rem] border border-dashed border-ink/12 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Fallback path</p>
            <p className="mt-2 text-sm leading-6 text-ink/68">
              If camera access or the TensorFlow.js model fails, you can still capture the setup manually.
            </p>
            <div className="mt-4">
              <Link
                href="/inventory"
                className="inline-flex items-center justify-center rounded-full border border-ink/12 px-5 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
              >
                Open manual inventory entry
              </Link>
            </div>
          </div>
        </div>
      </section>

      <ScanReview summary={summary} />
    </div>
  );
}
