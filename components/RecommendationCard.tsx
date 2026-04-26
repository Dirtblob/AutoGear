import Link from "next/link";
import type { AvailabilitySummary } from "@/lib/availability";
import { availabilityDetailMessages, getAvailabilityStatusBadge } from "@/lib/availability/display";
import type { LLMRecommendationOutput, RecommendationNarrationSource } from "@/lib/llm/types";
import { categoryLabels } from "@/lib/recommendation/scoring";
import type { ProductRecommendation } from "@/lib/recommendation/types";
import { formatUsd, formatUsdFromCents } from "@/lib/ui/format";
import { DeviceDeltaComparison } from "./DeviceDeltaComparison";
import { ScoreBadge } from "./ScoreBadge";

interface RecommendationCardProps {
  recommendation: ProductRecommendation;
  availability?: AvailabilitySummary;
  narration?: LLMRecommendationOutput | null;
  narrationSource?: RecommendationNarrationSource | null;
}

function narratorSourceLabel(source: RecommendationNarrationSource | null | undefined): string {
  return source === "gemma" ? "Gemma" : "deterministic fallback";
}

export function RecommendationCard({ recommendation, availability, narration, narrationSource }: RecommendationCardProps) {
  const { product } = recommendation;
  const summary = product.strengths.slice(0, 2).join(", ");
  const availabilityMessages = availabilityDetailMessages(availability);
  const priceStatusBadge = getAvailabilityStatusBadge(availability);
  const displayedPrice =
    recommendation.currentBestPriceCents === null ? formatUsd(product.priceUsd) : formatUsdFromCents(recommendation.currentBestPriceCents);
  const betterThanCurrentRow = recommendation.deviceDelta?.explanationFacts[0]
    ? (["Why this is better", recommendation.deviceDelta.explanationFacts[0]] satisfies [string, string])
    : null;
  const explanationRows: Array<[string, string]> = narration
    ? [
        ["Why it helps", narration.whyThisHelps],
        ...(betterThanCurrentRow ? [betterThanCurrentRow] : []),
        ["Tradeoffs", narration.tradeoffs],
        ["Confidence", narration.confidenceNote],
        ["Ranking changed because", recommendation.rankingChangedReason],
      ]
    : [
        ["Why it helps", recommendation.explanation.problemSolved],
        ...(betterThanCurrentRow ? [betterThanCurrentRow] : []),
        ["Why now", recommendation.explanation.whyNow],
        ["Why this model", recommendation.explanation.whyThisModel],
        ["Profile fields used", recommendation.profileFieldsUsed.length ? recommendation.profileFieldsUsed.join(", ") : "No private profile fields used."],
        ["Missing device specs", recommendation.missingDeviceSpecs.length ? recommendation.missingDeviceSpecs.join(", ") : "No fit-critical device specs missing."],
        ["Confidence", `${recommendation.confidenceLevel} (${recommendation.scoreBreakdown.confidence}/100)`],
        ["Ranking changed because", recommendation.rankingChangedReason],
      ];

  return (
    <article className="rounded-[1.85rem] border border-white/70 bg-white/92 p-6 shadow-panel backdrop-blur">
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-clay">
            {categoryLabels[product.category]}
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold">{product.name}</h2>
          <p className="mt-1 text-sm font-medium text-ink/55">
            {product.brand} · {displayedPrice} · {availability?.label ?? "Checking not configured"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink/60">
              {availability?.label ?? "Checking not configured"}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${priceStatusBadge.className}`}>
              {priceStatusBadge.label}
            </span>
          </div>
          {availabilityMessages.length > 0 ? (
            <div className="mt-2 space-y-1 text-xs leading-5 text-ink/48">
              {availabilityMessages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          ) : null}
        </div>
        <ScoreBadge score={recommendation.score} size="md" />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {[
          ["Final", recommendation.finalRecommendationScore],
          ["Fit", recommendation.fitScore],
          ["Trait delta", recommendation.traitDeltaScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-ink/8 bg-mist/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">{label}</p>
            <p className="mt-1 font-display text-2xl font-semibold text-ink">{value}/100</p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-[1.4rem] bg-[linear-gradient(135deg,rgba(23,33,31,1),rgba(66,104,90,0.94))] p-4 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
          {narration ? `Narrator layer: ${narratorSourceLabel(narrationSource)}` : "Personal summary"}
        </p>
        <p className="mt-3 font-display text-xl font-semibold text-white">{narration?.headline ?? product.name}</p>
        <p className="mt-2 text-sm leading-7 text-white/82">{narration?.explanation ?? summary}</p>
      </div>

      <dl className="mt-5 grid gap-3">
        {explanationRows.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-ink/8 bg-mist/65 p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">{label}</dt>
            <dd className="mt-1 text-sm leading-6 text-ink/70">{value}</dd>
          </div>
        ))}
      </dl>

      <DeviceDeltaComparison delta={recommendation.deviceDelta} />

      {narration?.followUpQuestion ? (
        <div className="mt-5 rounded-2xl border border-dashed border-moss/20 bg-white p-4 text-sm leading-6 text-ink/68">
          {narration.followUpQuestion}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {product.solves.slice(0, 3).map((problem) => (
          <span key={problem} className="rounded-full bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-moss shadow-[inset_0_0_0_1px_rgba(66,104,90,0.14)]">
            {problem.replaceAll("_", " ")}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-4 border-t border-ink/8 pt-4">
        <span className="rounded-full bg-ink/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
          {recommendation.fit} fit
        </span>
        <Link href={`/products/${product.id}`} className="text-sm font-semibold text-moss hover:text-ink">
          Details
        </Link>
      </div>
    </article>
  );
}
