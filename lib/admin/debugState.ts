import { promises as fs } from "node:fs";
import path from "node:path";

const DEBUG_STATE_FILE = path.join(process.cwd(), "prisma", "admin-debug-state.json");
const MAX_NARRATION_ERRORS = 5;

export interface StoredVisionScanSummary {
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
}

export interface StoredVisionScanDebug {
  recordedAtIso: string;
  modelStatus: "loaded" | "unavailable";
  error?: string;
  summary?: StoredVisionScanSummary;
}

export interface StoredNarrationError {
  recordedAtIso: string;
  provider: string;
  message: string;
  productId?: string;
  category?: string;
}

export interface StoredBackgroundJobError {
  recordedAtIso: string;
  jobName: string;
  message: string;
}

export interface AdminDebugState {
  visionScan: StoredVisionScanDebug | null;
  latestNarrationErrors: StoredNarrationError[];
  lastBackgroundJobError: StoredBackgroundJobError | null;
}

const emptyState: AdminDebugState = {
  visionScan: null,
  latestNarrationErrors: [],
  lastBackgroundJobError: null,
};

function shouldSkipPersistence(): boolean {
  return process.env.NODE_ENV === "test";
}

async function readStateFile(): Promise<AdminDebugState> {
  try {
    const content = await fs.readFile(DEBUG_STATE_FILE, "utf8");
    const parsed = JSON.parse(content) as Partial<AdminDebugState>;

    return {
      visionScan: parsed.visionScan ?? null,
      latestNarrationErrors: Array.isArray(parsed.latestNarrationErrors) ? parsed.latestNarrationErrors : [],
      lastBackgroundJobError: parsed.lastBackgroundJobError ?? null,
    };
  } catch {
    return emptyState;
  }
}

async function writeStateFile(state: AdminDebugState): Promise<void> {
  if (shouldSkipPersistence()) {
    return;
  }

  await fs.mkdir(path.dirname(DEBUG_STATE_FILE), { recursive: true });
  await fs.writeFile(DEBUG_STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

export async function readAdminDebugState(): Promise<AdminDebugState> {
  return readStateFile();
}

export async function recordVisionScanDebug(payload: StoredVisionScanDebug): Promise<void> {
  const state = await readStateFile();

  await writeStateFile({
    ...state,
    visionScan: payload,
  });
}

export async function recordNarrationError(payload: Omit<StoredNarrationError, "recordedAtIso">): Promise<void> {
  const state = await readStateFile();

  await writeStateFile({
    ...state,
    latestNarrationErrors: [
      {
        ...payload,
        recordedAtIso: new Date().toISOString(),
      },
      ...state.latestNarrationErrors,
    ].slice(0, MAX_NARRATION_ERRORS),
  });
}

export async function recordBackgroundJobError(
  payload: Omit<StoredBackgroundJobError, "recordedAtIso">,
): Promise<void> {
  const state = await readStateFile();

  await writeStateFile({
    ...state,
    lastBackgroundJobError: {
      ...payload,
      recordedAtIso: new Date().toISOString(),
    },
  });
}
