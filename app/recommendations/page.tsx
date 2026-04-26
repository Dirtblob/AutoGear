import Link from "next/link";
import { DeviceDeltaComparison } from "@/components/DeviceDeltaComparison";
import { LivePricePanel } from "@/components/LivePricePanel";
import { ScoreBadge } from "@/components/ScoreBadge";
import { ActionButton } from "@/components/ui/ActionButton";
import { buildLivePriceCardState } from "@/lib/availability/livePrice";
import { ScoreBreakdownCard } from "@/components/ui/ScoreBreakdownCard";
import { buildRecommendationNarrationId } from "@/lib/llm/explanationCache";
import type { RecommendationNarrationSource } from "@/lib/llm/types";
import { readCachedRecommendationNarrations } from "@/lib/llm/recommendationNarrator";
import {
  buildHackathonDemoPriorityList,
  HACKATHON_DEMO_EXPLANATION,
  HACKATHON_DEMO_SCENARIO_ID,
} from "@/lib/recommendation/demoMode";
import { buildRecommendationRejections } from "@/lib/recommendation/rejections";
import {
  buildCategoryScoreBreakdown,
  buildLifeGapInsights,
  matchesFilters,
  parseRecommendationSort,
  priorityForScore,
  sortCategoryViews,
  sortProductViews,
  type RecommendationFilters,
  type RecommendationSort,
} from "@/lib/recommendation/dashboard";
import { getCategoryRecommendations } from "@/lib/recommendation/categoryEngine";
import { getProductRecommendations } from "@/lib/recommendation/productEngine";
import { categoryLabels } from "@/lib/recommendation/scoring";
import { formatUsd } from "@/lib/ui/format";
import { getAvailabilityForProduct, loadRecommendationContext } from "@/lib/userData";
import { refreshRecommendationExplanation, toggleSavedProduct } from "./actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const sortOptions: Array<{ value: RecommendationSort; label: string }> = [
  { value: "highest_impact", label: "Highest impact" },
  { value: "best_value", label: "Best value" },
  { value: "lowest_cost", label: "Lowest cost" },
  { value: "highest_confidence", label: "Highest confidence" },
];

const filterOptions: Array<{ key: keyof RecommendationFilters; label: string }> = [
  { key: "underBudgetOnly", label: "Under budget only" },
  { key: "availableOnly", label: "Available only" },
  { key: "quietProductsOnly", label: "Quiet products only" },
  { key: "smallSpaceFriendlyOnly", label: "Small-space friendly" },
];

function getFirstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isEnabled(value: string | undefined): boolean {
  return value === "1";
}

function buildHref(
  current: Record<string, string | string[] | undefined>,
  next: Partial<Record<string, string | undefined>>,
): string {
  const params = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(current)) {
    const value = getFirstValue(rawValue);
    if (value) params.set(key, value);
  }

  for (const [key, value] of Object.entries(next)) {
    if (!value || value === "0") params.delete(key);
    else params.set(key, value);
  }

  const query = params.toString();
  return query ? `/recommendations?${query}` : "/recommendations";
}

function formatPriority(priority: string): string {
  return priority.replace(/_/g, " ");
}

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

function scoreTone(score: number): string {
  if (score >= 80) return "bg-moss text-white";
  if (score >= 60) return "bg-gold text-ink";
  return "bg-clay text-white";
}

function pillTone(enabled: boolean): string {
  return enabled
    ? "bg-ink text-white shadow-soft"
    : "border border-ink/10 bg-white text-ink/70 hover:border-moss/30 hover:text-ink";
}

function availabilityTone(status: string): string {
  if (status === "available") return "bg-moss/12 text-moss";
  if (status === "checking_not_configured") return "bg-gold/18 text-ink";
  return "bg-clay/10 text-clay";
}

function priorityTone(priority: string): string {
  if (priority === "critical") return "bg-clay text-white";
  if (priority === "high") return "bg-gold text-ink";
  if (priority === "medium") return "bg-moss text-white";
  return "bg-ink/10 text-ink";
}

function narratorSourceLabel(source: RecommendationNarrationSource | null | undefined): string {
  return source === "gemma" ? "Gemma" : "deterministic fallback";
}

export default async function RecommendationsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const sort = parseRecommendationSort(getFirstValue(params.sort));
  const filters: RecommendationFilters = {
    underBudgetOnly: isEnabled(getFirstValue(params.under_budget)),
    availableOnly: isEnabled(getFirstValue(params.available_only)),
    quietProductsOnly: isEnabled(getFirstValue(params.quiet_only)),
    smallSpaceFriendlyOnly: isEnabled(getFirstValue(params.small_space)),
  };
  const context = await loadRecommendationContext();

  if (!context) {
    return (
      <div className="rounded-[2rem] border border-dashed border-ink/15 bg-white/85 p-10 text-center shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-clay">Recommendations</p>
        <h1 className="mt-3 font-display text-3xl font-semibold">No profile is ready for scoring yet.</h1>
        <p className="mx-auto mt-4 max-w-2xl leading-7 text-ink/65">
          Finish onboarding and add a few inventory items first, then this page will rank upgrade opportunities,
          recommended categories, and specific models to consider.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/onboarding" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">
            Complete onboarding
          </Link>
          <Link href="/inventory" className="rounded-full border border-ink/10 px-5 py-3 text-sm font-semibold text-ink">
            Add inventory
          </Link>
        </div>
      </div>
    );
  }

  const {
    profileId,
    profile,
    inventory,
    availabilityByProductId,
    demoScenarioId,
    exactCurrentModelsProvided,
    savedProductIds,
    usedItemsOkay,
    ports,
    deviceType,
    privateProfile,
    pricingByProductId,
    candidateProducts,
  } = context;
  const recommendationInput = {
    profile,
    inventory,
    candidateProducts,
    privateProfile,
    exactCurrentModelsProvided,
    ports,
    deviceType,
    usedItemsOkay,
    availabilityByProductId,
    pricingByProductId,
  };
  const demoPriorityList =
    demoScenarioId === HACKATHON_DEMO_SCENARIO_ID ? buildHackathonDemoPriorityList(recommendationInput) : [];
  const categoryRecommendations = getCategoryRecommendations(recommendationInput);
  const productsByCategory = categoryRecommendations.map((categoryRecommendation) => ({
    categoryRecommendation,
    recommendations: getProductRecommendations(recommendationInput, categoryRecommendation, candidateProducts),
  }));
  const categoryViews = sortCategoryViews(
    productsByCategory.map(({ categoryRecommendation, recommendations }) => {
      const rawProducts = recommendations.map((recommendation) => {
        const availability = getAvailabilityForProduct(availabilityByProductId, recommendation.product.id);
        return {
          categoryRecommendation,
          recommendation,
          availability,
          priority: priorityForScore(recommendation.score),
          saved: savedProductIds.has(recommendation.product.id),
        };
      });
      const filteredProducts = sortProductViews(
        rawProducts.filter((productView) =>
          matchesFilters(productView.recommendation, productView.availability, filters, profile),
        ),
        sort,
      );

      return {
        categoryRecommendation,
        scoreBreakdown: buildCategoryScoreBreakdown(categoryRecommendation, filteredProducts, profile),
        products: filteredProducts,
      };
    }),
    sort,
  );

  const visibleCategoryViews = categoryViews.filter((categoryView) => categoryView.products.length > 0).slice(0, 4);
  const visibleCategoryIds = new Set(visibleCategoryViews.map((categoryView) => categoryView.categoryRecommendation.category));
  const lifeGaps = buildLifeGapInsights(profile, categoryViews);
  const visibleProductViews = visibleCategoryViews.flatMap((categoryView) =>
    categoryView.products.slice(0, 3).map((productView) => ({
      categoryRecommendation: categoryView.categoryRecommendation,
      productView,
    })),
  );
  const narratedRecommendations = await readCachedRecommendationNarrations(
    visibleProductViews.map(({ categoryRecommendation, productView }) => ({
      recommendationId: buildRecommendationNarrationId(profileId, categoryRecommendation.category),
      profile,
      inventory,
      exactCurrentModelsProvided,
      categoryRecommendation,
      productRecommendation: productView.recommendation,
      availability: productView.availability,
    })),
  );
  const narratorMode = narratedRecommendations.some((entry) => entry.source === "gemma" && entry.cacheStatus === "hit")
    ? "Cached Gemma explanations active"
    : "Deterministic fallback active";
  const narrationByProductId = new Map(
    narratedRecommendations.map((entry) => [entry.input.productRecommendation.id, entry]),
  );
  const visibleProductIds = new Set(
    visibleCategoryViews.flatMap((categoryView) =>
      categoryView.products.slice(0, 3).map((productView) => productView.recommendation.product.id),
    ),
  );
  const rejections = buildRecommendationRejections(recommendationInput, {
    recommendedCategoryIds: visibleCategoryIds,
    recommendedProductIds: visibleProductIds,
    maxItems: 4,
  });
  const heroProduct = visibleCategoryViews[0]?.products[0];
  const heroNarration = heroProduct ? narrationByProductId.get(heroProduct.recommendation.product.id) : null;
  const topProductCount = visibleCategoryViews.reduce(
    (total, categoryView) => total + Math.min(categoryView.products.length, 3),
    0,
  );
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-[2rem] bg-[linear-gradient(145deg,rgba(23,33,31,1)_0%,rgba(31,46,42,1)_46%,rgba(66,104,90,0.96)_100%)] text-white shadow-panel">
          <div className="bg-[radial-gradient(circle_at_top_left,rgba(224,171,69,0.34),transparent_18rem),radial-gradient(circle_at_bottom_right,rgba(66,104,90,0.32),transparent_22rem)] p-8 md:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                Recommendations dashboard
              </span>
              <span className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/65">
                {sortOptions.find((option) => option.value === sort)?.label}
              </span>
            </div>

            <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="text-sm font-medium text-white/65">
                  Built from the active profile, current inventory, and deterministic category + product scoring.
                </p>
                <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight md:text-5xl">
                  Upgrade opportunities for {profile.name}
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-white/72">
                  {profile.profession} profile, {formatUsd(profile.budgetUsd)} budget, {inventory.length} inventory items, and{" "}
                  {profile.problems.length} reported pain points. Filters refine what shows up without hiding why the
                  engine scored things the way it did.
                </p>

                {heroProduct ? (
                  <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/8 p-5 backdrop-blur">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Top next move</p>
                    <div className="mt-3 flex items-start justify-between gap-4">
                      <div>
                        <h2 className="font-display text-2xl font-semibold">{heroProduct.recommendation.product.name}</h2>
                        <p className="mt-2 text-sm leading-6 text-white/72">
                          {heroNarration?.output.explanation ?? heroProduct.recommendation.explanation.problemSolved}
                        </p>
                        {heroNarration ? (
                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
                            Explanation source: {narratorSourceLabel(heroNarration.source)}
                          </p>
                        ) : null}
                      </div>
                      <ScoreBadge score={heroProduct.recommendation.score} size="lg" />
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/8 p-5 text-sm leading-6 text-white/72 backdrop-blur">
                    No products are visible right now. Loosen the active filters to reveal specific models again.
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Budget", formatUsd(profile.budgetUsd)],
                  ["Top categories", String(visibleCategoryViews.length)],
                  ["Specific models", String(topProductCount)],
                  ["Active filters", String(activeFilterCount)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-3xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">{label}</p>
                    <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-panel backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-moss">Sort and filter</p>
          <h2 className="mt-3 font-display text-2xl font-semibold">Tune the ranking view</h2>
          <p className="mt-3 leading-7 text-ink/62">
            Sort changes how categories and models are ordered. Filters hide options that do not fit the moment.
          </p>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">Sort by</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {sortOptions.map((option) => (
                <Link
                  key={option.value}
                  href={buildHref(params, { sort: option.value })}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${pillTone(sort === option.value)}`}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">Filters</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {filterOptions.map((option) => {
                const paramKey =
                  option.key === "underBudgetOnly"
                    ? "under_budget"
                    : option.key === "availableOnly"
                      ? "available_only"
                      : option.key === "quietProductsOnly"
                        ? "quiet_only"
                        : "small_space";
                const enabled = filters[option.key];

                return (
                  <Link
                    key={option.key}
                    href={buildHref(params, { [paramKey]: enabled ? undefined : "1" })}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${pillTone(enabled)}`}
                  >
                    {option.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-6 rounded-3xl bg-mist p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">Current setup</p>
            <p className="mt-3 text-sm leading-7 text-ink/68">
              {profile.constraints.deskWidthInches}&quot; desk width, {profile.constraints.roomLighting} room lighting,
              {profile.constraints.sharesSpace ? " shared room" : " private room"}, and{" "}
              {profile.constraints.portableSetup ? "portable setup" : "mostly fixed desk"}.
            </p>
          </div>

          <div className="mt-4 rounded-3xl border border-moss/12 bg-[#f3f8f4] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">Narrator guardrail</p>
            <p className="mt-3 text-sm leading-7 text-ink/68">
              {narratorMode}. Page renders only read cached explanations or deterministic fallback copy. Gemini is
              called only when you generate or refresh an explanation, and it never changes category scores, product
              scores, ranking order, or budget logic.
            </p>
          </div>
        </aside>
      </section>

      {demoPriorityList.length > 0 ? (
        <section className="rounded-[2rem] border border-gold/30 bg-gold/10 p-6 shadow-panel">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-clay">Demo mode</p>
              <h2 className="mt-2 font-display text-3xl font-semibold">Laptop-only student priority stack</h2>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-ink/68">{HACKATHON_DEMO_EXPLANATION}</p>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-5">
            {demoPriorityList.map((item) => (
              <article key={item.category} className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-clay">{item.rank}</p>
                <h3 className="mt-3 font-display text-xl font-semibold">{categoryLabels[item.category]}</h3>
                <p className="mt-2 text-sm font-medium text-ink/58">
                  {item.recommendation?.product.name ?? "Upgrade later"}
                </p>
                <p className="mt-3 text-sm leading-6 text-ink/65">
                  {item.recommendation?.explanation.problemSolved ??
                    "Only then does a full laptop replacement become worth the bigger spend."}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-clay">1</p>
            <h2 className="mt-2 font-display text-3xl font-semibold">Your biggest upgrade opportunities</h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-ink/60">
            These are the strongest life gaps based on the current problems, constraints, and the categories that can
            relieve them most directly.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {lifeGaps.map((gap) => (
            <article key={gap.id} className="rounded-[1.75rem] border border-white/70 bg-white/92 p-6 shadow-panel">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${priorityTone(gap.priority)}`}>
                    {formatPriority(gap.priority)}
                  </span>
                  <h3 className="mt-4 font-display text-2xl font-semibold">{gap.label}</h3>
                </div>
                <ScoreBadge score={gap.score} />
              </div>
              <p className="mt-4 leading-7 text-ink/65">{gap.explanation}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {gap.topCategories.map((label) => (
                  <span key={label} className="rounded-full bg-mist px-3 py-2 text-xs font-semibold text-ink/65">
                    {label}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-clay">2</p>
            <h2 className="mt-2 font-display text-3xl font-semibold">Recommended categories</h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-ink/60">
            Category cards explain why a type of upgrade is important before picking specific models.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          {visibleCategoryViews.map((categoryView) => (
            <article
              key={categoryView.categoryRecommendation.category}
              className="rounded-[1.75rem] border border-white/70 bg-white/92 p-6 shadow-panel"
            >
              <div className="flex items-start justify-between gap-5">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${priorityTone(categoryView.categoryRecommendation.priority)}`}>
                      {formatPriority(categoryView.categoryRecommendation.priority)} priority
                    </span>
                    <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">
                      {categoryLabels[categoryView.categoryRecommendation.category]}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-2xl font-semibold">
                    {categoryLabels[categoryView.categoryRecommendation.category]}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-ink/58">
                    {categoryView.categoryRecommendation.missingOrUpgradeReason}
                  </p>
                </div>
                <ScoreBadge score={categoryView.categoryRecommendation.score} />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <DetailBlock
                  label="Problems solved"
                  value={
                    categoryView.categoryRecommendation.problemsAddressed.length > 0
                      ? categoryView.categoryRecommendation.problemsAddressed.map(humanize).join(", ")
                      : "Primarily fills a setup gap."
                  }
                />
                <DetailBlock label="Confidence" value={`${categoryView.scoreBreakdown.confidence}/100`} />
                <DetailBlock label="Explanation" value={categoryView.categoryRecommendation.explanation} />
                <DetailBlock
                  label="Tradeoffs"
                  value={categoryView.products[0]?.recommendation.tradeoffs[0] ?? "The category is strong, but the best product still needs fit and price checks."}
                />
              </div>

              <div className="mt-5">
                <ScoreBreakdownCard breakdown={categoryView.scoreBreakdown} />
              </div>

              <details className="mt-5 rounded-3xl border border-ink/10 bg-mist/55 p-4">
                <summary className="cursor-pointer list-none text-sm font-semibold text-ink">Why this?</summary>
                <div className="mt-3 space-y-2 text-sm leading-6 text-ink/68">
                  {categoryView.categoryRecommendation.reasons.map((reason) => (
                    <p key={reason}>{reason}</p>
                  ))}
                </div>
              </details>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-clay">3</p>
            <h2 className="mt-2 font-display text-3xl font-semibold">Specific models to consider</h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-ink/60">
            Each category runs through the product recommendation engine so the models below inherit the same profile,
            budget, and constraint context.
          </p>
        </div>

        {visibleCategoryViews.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-ink/15 bg-white/80 p-8 text-center shadow-panel">
            <h3 className="font-display text-2xl font-semibold">No models match the current filter set.</h3>
            <p className="mx-auto mt-3 max-w-2xl leading-7 text-ink/65">
              The category engine still ran, but the active filters removed every product candidate. Loosen one or two
              filters to see specific model recommendations again.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {visibleCategoryViews.map((categoryView) => (
              <section
                key={categoryView.categoryRecommendation.category}
                className="rounded-[1.75rem] border border-white/70 bg-white/92 p-6 shadow-panel"
              >
                <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/10 pb-5">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-moss">
                      {categoryLabels[categoryView.categoryRecommendation.category]}
                    </p>
                    <h3 className="mt-2 font-display text-2xl font-semibold">
                      Best models for {categoryLabels[categoryView.categoryRecommendation.category].toLowerCase()}
                    </h3>
                  </div>
                  <span className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${scoreTone(categoryView.categoryRecommendation.score)}`}>
                    Category score {categoryView.categoryRecommendation.score}
                  </span>
                </div>

                <div className="mt-6 grid gap-5 xl:grid-cols-2">
                  {categoryView.products.slice(0, 3).map((productView) => {
                    const livePriceState = buildLivePriceCardState(
                      productView.availability,
                      Math.round(productView.recommendation.product.priceUsd * 100),
                    );
                    const narration = narrationByProductId.get(productView.recommendation.product.id);
                    const narrationOutput = narration?.output;
                    const explanationActionLabel =
                      narration?.source === "gemma"
                        ? "Refresh explanation"
                        : narration?.cacheStatus === "hit"
                          ? "Retry Gemma explanation"
                          : "Generate explanation";

                    return (
                      <article
                        key={productView.recommendation.product.id}
                        className="flex h-full flex-col rounded-[1.5rem] border border-ink/10 bg-mist/35 p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${priorityTone(productView.priority)}`}>
                                {formatPriority(productView.priority)} priority
                              </span>
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${availabilityTone(productView.availability.status)}`}>
                                {productView.availability.label}
                              </span>
                            </div>
                            <h4 className="mt-4 font-display text-2xl font-semibold">
                              {productView.recommendation.product.name}
                            </h4>
                            {narrationOutput ? (
                              <p className="mt-2 text-sm font-semibold text-moss">{narrationOutput.headline}</p>
                            ) : null}
                            <p className="mt-2 text-sm font-medium text-ink/58">
                              {productView.recommendation.product.brand} · {categoryLabels[productView.recommendation.product.category]} ·{" "}
                              {formatUsd(productView.recommendation.product.priceUsd)}
                            </p>
                          </div>
                          <ScoreBadge score={productView.recommendation.score} />
                        </div>

                        <div className="mt-5">
                          <LivePricePanel
                            deviceCatalogId={productView.recommendation.product.catalogDeviceId ?? productView.recommendation.product.id}
                            slug={productView.recommendation.product.catalogDeviceId ?? productView.recommendation.product.id}
                            initialState={livePriceState}
                          />
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          <DetailBlock
                            label="Problems solved"
                            value={productView.recommendation.product.solves.map(humanize).join(", ")}
                          />
                          <DetailBlock
                            label="Final recommendation score"
                            value={`${productView.recommendation.finalRecommendationScore}/100`}
                          />
                          <DetailBlock
                            label="Fit score"
                            value={`${productView.recommendation.fitScore}/100`}
                          />
                          <DetailBlock
                            label="Trait delta score"
                            value={`${productView.recommendation.traitDeltaScore}/100`}
                          />
                          <DetailBlock
                            label="Confidence"
                            value={
                              narrationOutput?.confidenceNote ??
                              `${productView.recommendation.confidenceLevel} (${productView.recommendation.scoreBreakdown.confidence}/100)`
                            }
                          />
                          <DetailBlock
                            label="Profile fields used"
                            value={
                              productView.recommendation.profileFieldsUsed.length
                                ? productView.recommendation.profileFieldsUsed.join(", ")
                                : "No private profile fields used."
                            }
                          />
                          <DetailBlock
                            label="Missing device specs"
                            value={
                              productView.recommendation.missingDeviceSpecs.length
                                ? productView.recommendation.missingDeviceSpecs.join(", ")
                                : "No fit-critical device specs missing."
                            }
                          />
                          <DetailBlock
                            label="Explanation"
                            value={narrationOutput?.explanation ?? productView.recommendation.explanation.whyThisModel}
                          />
                          {productView.recommendation.deviceDelta?.explanationFacts[0] ? (
                            <DetailBlock
                              label="Why this is better"
                              value={productView.recommendation.deviceDelta.explanationFacts[0]}
                            />
                          ) : null}
                          <DetailBlock
                            label="Tradeoffs"
                            value={narrationOutput?.tradeoffs ?? productView.recommendation.tradeoffs.join(" ")}
                          />
                        </div>

                        <div className="mt-5">
                          <ScoreBreakdownCard breakdown={productView.recommendation.scoreBreakdown} />
                        </div>

                        <DeviceDeltaComparison delta={productView.recommendation.deviceDelta} />

                        {narrationOutput ? (
                          <div className="mt-5 rounded-3xl border border-moss/10 bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                              Narrator layer: {narratorSourceLabel(narration?.source)}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-ink/68">{narrationOutput.whyThisHelps}</p>
                          </div>
                        ) : null}

                        <div className="mt-5 flex flex-wrap items-center gap-3">
                          <form action={refreshRecommendationExplanation}>
                            <input type="hidden" name="productId" value={productView.recommendation.product.id} />
                            <input type="hidden" name="returnTo" value={buildHref(params, {})} />
                            <ActionButton pendingText="Generating..." variant="secondary" className="px-4 py-2">
                              {explanationActionLabel}
                            </ActionButton>
                          </form>
                          <form action={toggleSavedProduct}>
                            <input type="hidden" name="profileId" value={profileId} />
                            <input type="hidden" name="productId" value={productView.recommendation.product.id} />
                            <input type="hidden" name="returnTo" value={buildHref(params, {})} />
                            <ActionButton
                              pendingText="Updating..."
                              variant={productView.saved ? "success" : "primary"}
                              className="px-4 py-2"
                            >
                              {productView.saved ? "Watching item" : "Save / watch this item"}
                            </ActionButton>
                          </form>
                          <Link
                            href={`/products/${productView.recommendation.product.id}`}
                            className="rounded-full border border-ink/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-moss/30 hover:text-moss"
                          >
                            View details
                          </Link>
                        </div>

                        <details className="mt-5 rounded-3xl bg-white p-4">
                          <summary className="cursor-pointer list-none text-sm font-semibold text-ink">Why this?</summary>
                          <div className="mt-3 space-y-3 text-sm leading-6 text-ink/68">
                            <p>{narrationOutput?.explanation ?? productView.recommendation.explanation.problemSolved}</p>
                            <p>{narrationOutput?.whyThisHelps ?? productView.recommendation.explanation.whyNow}</p>
                            <p>{narrationOutput?.tradeoffs ?? productView.recommendation.explanation.tradeoff}</p>
                            <p>{narrationOutput?.whyNotCheaper ?? productView.recommendation.whyNotCheaper}</p>
                            <p>{narrationOutput?.whyNotMoreExpensive ?? productView.recommendation.whyNotMoreExpensive}</p>
                            {narrationOutput?.followUpQuestion ? <p>{narrationOutput.followUpQuestion}</p> : null}
                          </div>
                        </details>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-clay">4</p>
            <h2 className="mt-2 font-display text-3xl font-semibold">What we intentionally did not recommend</h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-ink/60">
            This keeps the dashboard explainable by showing where the engine deliberately held back.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          {rejections.map((item) => (
            <article key={item.id} className="rounded-[1.75rem] border border-white/70 bg-white/92 p-6 shadow-panel">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-clay">
                    {item.kind === "model" ? "Model held back" : "Category deprioritized"}
                  </p>
                  <h3 className="mt-3 font-display text-2xl font-semibold">{item.item}</h3>
                  <p className="mt-2 text-sm font-medium text-ink/55">{categoryLabels[item.category]}</p>
                </div>
                <span className="rounded-full bg-mist px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink/60">
                  {item.kind}
                </span>
              </div>
              <div className="mt-5 grid gap-3">
                <DetailBlock label="Reason" value={item.reason} />
                <DetailBlock label="Would recommend if" value={item.wouldRecommendIf} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(23,33,31,0.04)]">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">{label}</p>
      <p className="mt-2 text-sm leading-6 text-ink/68">{value}</p>
    </div>
  );
}
