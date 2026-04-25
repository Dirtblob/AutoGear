import { refreshPrices } from "../lib/jobs/refreshPrices";

async function main(): Promise<void> {
  const result = await refreshPrices();

  console.log(
    JSON.stringify(
      {
        jobRunId: result.jobRunId,
        productsEligible: result.productsEligible,
        productsChecked: result.productsChecked,
        productsSkippedDueToQuota: result.productsSkippedDueToQuota,
        apiCallsUsed: result.apiCallsUsed,
        remainingMonthlyCalls: result.remainingMonthlyCalls,
        remainingDailyCalls: result.remainingDailyCalls,
        remainingMinuteCalls: result.remainingMinuteCalls,
        recommendationCount: result.recommendationCount,
        alertsCreated: result.alertsCreated,
        availableCount: result.availableCount,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
