import type { AvailabilitySummary } from "./types";

interface AvailabilityStatusBadge {
  label: "Fresh price" | "Cached price from PricesAPI" | "PricesAPI quota-limited" | "Unknown availability";
  className: string;
}

function pluralize(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}

export function formatLastCheckedDistance(checkedAt: Date | null, currentDate: Date = new Date()): string | null {
  if (!checkedAt) return null;

  const elapsedMs = Math.max(0, currentDate.getTime() - checkedAt.getTime());
  const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));

  if (elapsedHours < 1) {
    const minutes = Math.max(1, Math.floor(elapsedMs / (1000 * 60)));
    return pluralize(minutes, "minute");
  }

  if (elapsedHours < 48) {
    return pluralize(elapsedHours, "hour");
  }

  const days = Math.floor(elapsedHours / 24);
  return pluralize(days, "day");
}

export function formatLastCheckedTimestamp(checkedAt: Date | null): string | null {
  if (!checkedAt) return null;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(checkedAt);
}

export function availabilityDetailMessages(
  summary: AvailabilitySummary | undefined,
  currentDate: Date = new Date(),
): string[] {
  if (!summary) {
    return [];
  }

  const messages: string[] = [];

  if (summary.refreshSource === "cached" && summary.checkedAt) {
    messages.push("Cached price from PricesAPI");
  }

  if (summary.isStale) {
    messages.push("Price snapshot is stale");
  }

  const lastCheckedDistance = formatLastCheckedDistance(summary.checkedAt, currentDate);
  const lastCheckedTimestamp = formatLastCheckedTimestamp(summary.checkedAt);
  if (lastCheckedDistance && lastCheckedTimestamp) {
    messages.push(`Last checked ${lastCheckedTimestamp} (${lastCheckedDistance})`);
  }

  if (summary.refreshSkippedReason === "free_tier_quota") {
    messages.push("Skipped due to PricesAPI free-tier quota");
  }

  return messages;
}

export function getAvailabilityStatusBadge(summary: AvailabilitySummary | undefined): AvailabilityStatusBadge {
  if (!summary || summary.status === "checking_not_configured" || summary.refreshSource === "not_configured") {
    return {
      label: "Unknown availability",
      className: "bg-white/10 text-slate-200",
    };
  }

  if (summary.refreshSkippedReason === "free_tier_quota") {
    return {
      label: "PricesAPI quota-limited",
      className: "bg-rose-400/16 text-rose-100",
    };
  }

  if (summary.refreshSource === "live") {
    return {
      label: "Fresh price",
      className: "bg-emerald-400/20 text-emerald-100",
    };
  }

  if (summary.refreshSource === "cached") {
    return {
      label: "Cached price from PricesAPI",
      className: "bg-amber-300/20 text-amber-100",
    };
  }

  return {
    label: "Unknown availability",
    className: "bg-white/10 text-slate-200",
  };
}
