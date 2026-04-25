import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiUsageCard } from "@/components/ApiUsageCard";
import { ActionButton } from "@/components/ui/ActionButton";
import { db } from "@/lib/db";
import { refreshPrices } from "@/lib/jobs/refreshPrices";
import { getPricesApiProviderName } from "@/lib/availability/pricesApiProvider";
import { buildPricesApiDashboardMetrics } from "@/lib/quota/dashboard";
import { getPricesApiUsageSnapshot } from "@/lib/quota/pricesApiQuota";
import { buildToastHref } from "@/lib/ui/toasts";

function formatTimestamp(value: Date | null): string {
  if (!value) return "Never";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

async function runRefreshNowAction(): Promise<void> {
  "use server";

  const providerName = getPricesApiProviderName();
  const snapshot = await getPricesApiUsageSnapshot(providerName);
  const hasCapacity = snapshot.monthlyRemaining > 0 && snapshot.dailyRemaining > 0 && snapshot.minuteRemaining > 0;

  if (!hasCapacity) {
    redirect(buildToastHref("/admin/api-usage", "price_refresh_quota_blocked"));
  }

  const lowDailyQuota = snapshot.dailyRemaining < 10;

  await refreshPrices();

  revalidatePath("/");
  revalidatePath("/recommendations");
  revalidatePath("/admin/api-usage");
  redirect(buildToastHref("/admin/api-usage", lowDailyQuota ? "price_refresh_low_quota" : "price_refresh_completed"));
}

export default async function ApiUsagePage() {
  const providerName = getPricesApiProviderName();
  const now = new Date();
  const [snapshot, lastRefreshJob] = await Promise.all([
    getPricesApiUsageSnapshot(providerName, now),
    db.jobRun.findFirst({
      where: { jobName: "refreshPrices" },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const metrics = buildPricesApiDashboardMetrics(snapshot, now);
  const lowDailyQuota = snapshot.dailyRemaining < 10;
  const refreshBlocked = snapshot.monthlyRemaining <= 0 || snapshot.dailyRemaining <= 0 || snapshot.minuteRemaining <= 0;
  const estimatedDaysRemainingLabel =
    metrics.estimatedQuotaDaysRemaining === null
      ? `${metrics.calendarDaysRemaining}+ days`
      : `${Math.min(metrics.calendarDaysRemaining, metrics.estimatedQuotaDaysRemaining)} days`;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-[linear-gradient(145deg,rgba(23,33,31,1)_0%,rgba(31,46,42,1)_46%,rgba(66,104,90,0.96)_100%)] text-white shadow-panel">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(224,171,69,0.34),transparent_18rem),radial-gradient(circle_at_bottom_right,rgba(66,104,90,0.32),transparent_22rem)] p-8 md:p-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">Admin quota dashboard</p>
              <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">
                PricesAPI usage and refresh controls
              </h1>
              <p className="mt-4 text-base leading-7 text-white/74">
                This view surfaces the live PricesAPI free-tier quota, current burn rate, last refresh job, and whether today is
                still safe for another refresh run.
              </p>
            </div>

            <form action={runRefreshNowAction} className="w-full max-w-sm rounded-[1.6rem] border border-white/12 bg-white/8 p-5 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Refresh job</p>
              <p className="mt-3 text-sm leading-6 text-white/76">
                Runs the standard price refresh flow and keeps all quota checks in place.
              </p>
              <div className="mt-5">
                <ActionButton
                  variant={refreshBlocked ? "secondary" : "accent"}
                  pendingText="Refreshing prices..."
                  fullWidth
                  disabled={refreshBlocked}
                >
                  Run refresh now
                </ActionButton>
              </div>
              <p className={`mt-4 text-sm leading-6 ${refreshBlocked ? "text-white/80" : lowDailyQuota ? "text-gold" : "text-white/64"}`}>
                {refreshBlocked
                  ? "Refresh is currently blocked because one of the minute, daily, or monthly limits is exhausted."
                  : lowDailyQuota
                    ? `Warning: only ${snapshot.dailyRemaining} daily call${snapshot.dailyRemaining === 1 ? "" : "s"} remain.`
                    : `Daily headroom looks healthy with ${snapshot.dailyRemaining} calls remaining today.`}
              </p>
            </form>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <ApiUsageCard
          title="Monthly calls used"
          value={`${snapshot.monthlyCallsUsed} / ${snapshot.policy.monthlyHardLimit}`}
          detail={`${snapshot.monthlyRemaining} calls remain this month.`}
          tone={snapshot.monthlyRemaining < 100 ? "warning" : "default"}
        />
        <ApiUsageCard
          title="Daily calls used"
          value={`${snapshot.dailyCallsUsed} / ${snapshot.policy.dailySoftLimit}`}
          detail={`${snapshot.dailyRemaining} calls remain today.`}
          tone={lowDailyQuota ? "warning" : "default"}
        />
        <ApiUsageCard
          title="Minute calls used"
          value={`${snapshot.minuteCallsUsed} / ${snapshot.policy.minuteHardLimit}`}
          detail={`${snapshot.minuteRemaining} calls remain in the current minute window.`}
          tone={snapshot.minuteRemaining <= 1 ? "warning" : "default"}
        />
        <ApiUsageCard
          title="Estimated days remaining in month"
          value={estimatedDaysRemainingLabel}
          detail={
            metrics.estimatedQuotaDaysRemaining === null
              ? "No monthly burn rate yet, so the current quota can cover the rest of the month."
              : `At the current pace of ${metrics.averageDailyBurn.toFixed(1)} calls/day.`
          }
          tone="success"
        />
        <ApiUsageCard
          title="Safe average calls/day remaining"
          value={`${metrics.safeAverageCallsPerDay}`}
          detail={`To stay within the monthly budget over the next ${metrics.calendarDaysRemaining} calendar day${metrics.calendarDaysRemaining === 1 ? "" : "s"}.`}
          tone="success"
        />
        <ApiUsageCard
          title="Last refresh job"
          value={formatTimestamp(lastRefreshJob?.createdAt ?? null)}
          detail={
            lastRefreshJob
              ? `${lastRefreshJob.productsChecked}/${lastRefreshJob.productsEligible} products checked, ${lastRefreshJob.pricesApiCallsUsed} PricesAPI calls used.`
              : "No refresh job has been recorded yet."
          }
          tone="default"
        />
        <ApiUsageCard
          title="Products skipped due to quota"
          value={`${lastRefreshJob?.productsSkippedDueToQuota ?? 0}`}
          detail={
            lastRefreshJob
              ? `Most recent run left ${lastRefreshJob.remainingDailyCalls} daily and ${lastRefreshJob.remainingMonthlyCalls} monthly calls available.`
              : "Quota skips will appear here after the first refresh job."
          }
          tone={(lastRefreshJob?.productsSkippedDueToQuota ?? 0) > 0 ? "warning" : "default"}
        />
      </section>
    </div>
  );
}
