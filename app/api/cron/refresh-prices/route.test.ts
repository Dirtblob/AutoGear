import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { refreshPricesMock } = vi.hoisted(() => ({
  refreshPricesMock: vi.fn(),
}));

vi.mock("@/lib/jobs/refreshPrices", () => ({
  refreshPrices: refreshPricesMock,
}));

describe("/api/cron/refresh-prices", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret";
    refreshPricesMock.mockReset();
  });

  it("rejects requests without a valid secret", async () => {
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/cron/refresh-prices"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(refreshPricesMock).not.toHaveBeenCalled();
  });

  it("accepts the CRON_SECRET header and returns the job summary", async () => {
    refreshPricesMock.mockResolvedValue({
      productsEligible: 2,
      productsChecked: 2,
      productsSkippedDueToQuota: 0,
      apiCallsUsed: 2,
      pricesApiCallsUsed: 2,
      remainingMonthlyCalls: 948,
      remainingDailyCalls: 28,
      remainingMinuteCalls: 6,
      availableCount: 1,
      summaries: {},
      recommendationCount: 4,
      jobRunId: "job-123",
    });

    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest("http://localhost/api/cron/refresh-prices", {
        headers: {
          CRON_SECRET: "test-cron-secret",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      productsEligible: 2,
      productsChecked: 2,
      productsSkippedDueToQuota: 0,
      apiCallsUsed: 2,
      pricesApiCallsUsed: 2,
      remainingMonthlyCalls: 948,
      remainingDailyCalls: 28,
      remainingMinuteCalls: 6,
      availableCount: 1,
      summaries: {},
      recommendationCount: 4,
      jobRunId: "job-123",
    });
    expect(refreshPricesMock).toHaveBeenCalledTimes(1);
  });

  it("accepts a bearer token for manual or external triggers", async () => {
    refreshPricesMock.mockResolvedValue({
      productsEligible: 1,
      productsChecked: 1,
      productsSkippedDueToQuota: 0,
      apiCallsUsed: 1,
      pricesApiCallsUsed: 1,
      remainingMonthlyCalls: 949,
      remainingDailyCalls: 29,
      remainingMinuteCalls: 7,
      availableCount: 1,
      summaries: {},
      recommendationCount: 3,
      jobRunId: "job-456",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/cron/refresh-prices", {
        method: "POST",
        headers: {
          Authorization: "Bearer test-cron-secret",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      productsEligible: 1,
      productsChecked: 1,
      productsSkippedDueToQuota: 0,
      apiCallsUsed: 1,
      pricesApiCallsUsed: 1,
      remainingMonthlyCalls: 949,
      remainingDailyCalls: 29,
      remainingMinuteCalls: 7,
      availableCount: 1,
      summaries: {},
      recommendationCount: 3,
      jobRunId: "job-456",
    });
    expect(refreshPricesMock).toHaveBeenCalledTimes(1);
  });
});
