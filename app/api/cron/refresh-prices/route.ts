import { NextResponse, type NextRequest } from "next/server";
import { recordBackgroundJobError } from "@/lib/admin/debugState";
import { refreshPrices, type JobRunSummary } from "@/lib/jobs/refreshPrices";

export const runtime = "nodejs";

function hasValidCronSecret(request: NextRequest, expectedSecret: string): boolean {
  const cronSecretHeader = request.headers.get("CRON_SECRET");
  if (cronSecretHeader === expectedSecret) {
    return true;
  }

  const authorizationHeader = request.headers.get("Authorization");
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return false;
  }

  return authorizationHeader.slice("Bearer ".length).trim() === expectedSecret;
}

async function handleRefresh(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  if (!hasValidCronSecret(request, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary: JobRunSummary = await refreshPrices();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to refresh prices from cron route.", error);
    await recordBackgroundJobError({
      jobName: "refreshPrices",
      message: error instanceof Error ? error.message : "Unknown cron refresh failure",
    });
    return NextResponse.json({ error: "Failed to refresh prices." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleRefresh(request);
}

export async function POST(request: NextRequest) {
  return handleRefresh(request);
}
