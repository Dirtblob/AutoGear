import { NextResponse, type NextRequest } from "next/server";
import { recordVisionScanDebug, type StoredVisionScanDebug, type StoredVisionScanSummary } from "@/lib/admin/debugState";

function sanitizeSummary(value: unknown): StoredVisionScanSummary | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const summary = value as Partial<StoredVisionScanSummary>;

  return {
    sampledFrameCount: Number(summary.sampledFrameCount ?? 0),
    totalDetections: Number(summary.totalDetections ?? 0),
    estimatedStyle: String(summary.estimatedStyle ?? "unknown"),
    possibleIssues: Array.isArray(summary.possibleIssues) ? summary.possibleIssues.map(String).slice(0, 8) : [],
    detectedCategories: Array.isArray(summary.detectedCategories)
      ? summary.detectedCategories.slice(0, 6).map((entry) => ({
          category: String(entry.category ?? "unknown"),
          confidence: Number(entry.confidence ?? 0),
          countEstimate: Number(entry.countEstimate ?? 0),
        }))
      : [],
    suggestedInventoryCount: Number(summary.suggestedInventoryCount ?? 0),
  };
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = (await request.json()) as Partial<StoredVisionScanDebug>;
    const modelStatus = body.modelStatus === "loaded" ? "loaded" : "unavailable";

    await recordVisionScanDebug({
      recordedAtIso: new Date().toISOString(),
      modelStatus,
      error: typeof body.error === "string" ? body.error.slice(0, 400) : undefined,
      summary: sanitizeSummary(body.summary),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not record vision scan status" },
      { status: 400 },
    );
  }
}
