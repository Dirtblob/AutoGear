export interface WatchlistAlertRuleInput {
  productName: string;
  previousAvailable: boolean;
  currentAvailable: boolean;
  previousPriceCents: number | null;
  currentPriceCents: number;
  targetPriceCents: number | null;
  previousScore: number | null;
  currentScore: number | null;
  previousRank: number | null;
  currentRank: number | null;
  provider: string;
  url: string | null;
}

export interface WatchlistAlertDraft {
  title: string;
  message: string;
  oldPriceCents: number | null;
  newPriceCents: number;
  thresholdCents: number | null;
  scoreAtAlert: number;
  provider: string;
  url: string | null;
}

function formatDollars(priceCents: number | null): string {
  if (priceCents === null) {
    return "an unknown price";
  }

  return `$${(priceCents / 100).toFixed(2)}`;
}

export function buildWatchlistAlertDrafts(input: WatchlistAlertRuleInput): WatchlistAlertDraft[] {
  const alerts: WatchlistAlertDraft[] = [];
  const scoreAtAlert = input.currentScore ?? 0;

  if (input.currentAvailable && !input.previousAvailable) {
    alerts.push({
      title: "Now available",
      message: `${input.productName} is available again at ${formatDollars(input.currentPriceCents)}.`,
      oldPriceCents: input.previousPriceCents,
      newPriceCents: input.currentPriceCents,
      thresholdCents: input.targetPriceCents,
      scoreAtAlert,
      provider: input.provider,
      url: input.url,
    });
  }

  if (
    input.targetPriceCents !== null &&
    input.currentPriceCents <= input.targetPriceCents &&
    (input.previousPriceCents === null || input.previousPriceCents > input.targetPriceCents)
  ) {
    alerts.push({
      title: "Price fell below your target",
      message: `${input.productName} dropped to ${formatDollars(input.currentPriceCents)}, below your ${formatDollars(input.targetPriceCents)} target.`,
      oldPriceCents: input.previousPriceCents,
      newPriceCents: input.currentPriceCents,
      thresholdCents: input.targetPriceCents,
      scoreAtAlert,
      provider: input.provider,
      url: input.url,
    });
  }

  if (
    input.previousPriceCents !== null &&
    input.previousPriceCents > 0 &&
    input.currentPriceCents <= Math.floor(input.previousPriceCents * 0.85)
  ) {
    alerts.push({
      title: "Price dropped by 15% or more",
      message: `${input.productName} fell from ${formatDollars(input.previousPriceCents)} to ${formatDollars(input.currentPriceCents)}.`,
      oldPriceCents: input.previousPriceCents,
      newPriceCents: input.currentPriceCents,
      thresholdCents: input.targetPriceCents,
      scoreAtAlert,
      provider: input.provider,
      url: input.url,
    });
  }

  if (input.previousScore !== null && input.currentScore !== null && input.currentScore - input.previousScore >= 10) {
    alerts.push({
      title: "Recommendation score jumped",
      message: `${input.productName} gained ${input.currentScore - input.previousScore} points and now scores ${input.currentScore}.`,
      oldPriceCents: input.previousPriceCents,
      newPriceCents: input.currentPriceCents,
      thresholdCents: input.targetPriceCents,
      scoreAtAlert,
      provider: input.provider,
      url: input.url,
    });
  }

  if (
    input.currentRank !== null &&
    input.currentRank <= 3 &&
    (input.previousRank === null || input.previousRank > 3)
  ) {
    alerts.push({
      title: "Entered the top 3",
      message: `${input.productName} moved into the top 3 for this watched category at rank #${input.currentRank}.`,
      oldPriceCents: input.previousPriceCents,
      newPriceCents: input.currentPriceCents,
      thresholdCents: input.targetPriceCents,
      scoreAtAlert,
      provider: input.provider,
      url: input.url,
    });
  }

  return alerts;
}
