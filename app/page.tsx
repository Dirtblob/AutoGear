import Link from "next/link";
import { runLaptopOnlyStudentDemoAction } from "@/app/actions";
import { ProductCard } from "@/components/ProductCard";
import { RecommendationCard } from "@/components/RecommendationCard";
import { ScoreBadge } from "@/components/ScoreBadge";
import { ActionButton } from "@/components/ui/ActionButton";
import { getCachedAvailabilitySummaries } from "@/lib/availability";
import { loadCachedRecommendationPriceSnapshots } from "@/lib/availability/priceSnapshots";
import { buildRecommendationNarrationId } from "@/lib/llm/explanationCache";
import { readCachedRecommendationNarrations } from "@/lib/llm/recommendationNarrator";
import { loadMongoRecommendationProducts, recommendationProductToAvailabilityModel } from "@/lib/recommendation/mongoDeviceProducts";
import {
  buildHackathonDemoPriorityList,
  buildHackathonDemoRecommendationInput,
  hackathonDemoProfile,
} from "@/lib/recommendation/demoMode";
import { getCategoryRecommendations } from "@/lib/recommendation/categoryEngine";
import { categoryLabels } from "@/lib/recommendation/scoring";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const candidateProducts = await loadMongoRecommendationProducts();
  const previewProducts = candidateProducts.slice(0, 3);
  const availabilityModels = candidateProducts.map((product) => recommendationProductToAvailabilityModel(product, { allowUsed: true }));
  const [cachedAvailabilityByProductId, pricingByProductId] = await Promise.all([
    getCachedAvailabilitySummaries(availabilityModels),
    loadCachedRecommendationPriceSnapshots(availabilityModels),
  ]);
  const availabilityByProductId = cachedAvailabilityByProductId;
  const demoInput = {
    ...buildHackathonDemoRecommendationInput(),
    candidateProducts,
    availabilityByProductId,
    pricingByProductId,
  };
  const demoPriorityList = buildHackathonDemoPriorityList(demoInput);
  const topRecommendations = demoPriorityList
    .slice(0, 2)
    .flatMap((item) => (item.recommendation ? [item.recommendation] : []));
  const categoryRecommendations = getCategoryRecommendations(demoInput);
  const narratedRecommendations = await readCachedRecommendationNarrations(
    topRecommendations.map((recommendation) => ({
      recommendationId: buildRecommendationNarrationId(demoInput.profile.id, recommendation.product.category),
      profile: demoInput.profile,
      inventory: demoInput.inventory,
      exactCurrentModelsProvided: demoInput.exactCurrentModelsProvided,
      categoryRecommendation:
        categoryRecommendations.find((categoryRecommendation) => categoryRecommendation.category === recommendation.product.category) ??
        {
          category: recommendation.product.category,
          score: recommendation.score,
          reasons: recommendation.reasons,
        },
      productRecommendation: recommendation,
      availability: availabilityByProductId[recommendation.product.id],
    })),
    { recordMetrics: false },
  );
  const narrationByProductId = new Map(
    narratedRecommendations.map((entry) => [entry.input.productRecommendation.id, entry]),
  );

  return (
    <div className="space-y-10 lg:space-y-12">
      <section className="overflow-hidden rounded-[2.35rem] border border-cyan-300/20 bg-[linear-gradient(145deg,rgba(2,6,23,0.98)_0%,rgba(8,47,73,0.94)_46%,rgba(6,78,59,0.9)_100%)] p-6 text-white shadow-[0_30px_90px_rgba(2,6,23,0.6)] md:p-10">
        <div className="grid gap-8 xl:grid-cols-[1.08fr_0.92fr] xl:items-stretch">
          <div className="flex flex-col justify-between gap-8">
            <div className="space-y-6">
              <div className="inline-flex w-fit rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100/80">
                Explainable upgrade engine
              </div>
              <div className="max-w-4xl space-y-5">
                <h1 className="font-display text-4xl font-semibold tracking-tight md:text-6xl">
                  Turn a messy setup into a clean, judge-ready upgrade story.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-white/72">
                  AutoGear scores what someone already owns, what hurts, and what constraints matter most, then
                  ranks the upgrades with reasons clear enough to present in under three minutes.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[auto_auto_1fr] md:items-center">
              <Link
                href="/onboarding"
                className="inline-flex items-center justify-center rounded-full bg-gold px-5 py-3 text-sm font-semibold text-ink transition hover:bg-white"
              >
                Start onboarding
              </Link>
              <form action={runLaptopOnlyStudentDemoAction}>
                <ActionButton pendingText="Loading demo..." variant="glass">
                  Run demo mode
                </ActionButton>
              </form>
              <div className="rounded-[1.6rem] border border-white/10 bg-white/8 px-4 py-3 text-sm leading-6 text-white/72">
                Fastest pitch flow: load demo, open recommendations, walk through the top score and breakdown.
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["Top recommendation", `${topRecommendations[0]?.score ?? 0}/100`],
                ["Seed categories", "8 launch-ready"],
                ["Decision style", "Deterministic scoring"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[1.5rem] border border-white/10 bg-white/8 p-4 backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">{label}</p>
                  <p className="mt-3 font-display text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[1.9rem] border border-white/10 bg-white/8 p-5 backdrop-blur">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-white/60">Demo profile</p>
                  <h2 className="mt-1 font-display text-3xl font-semibold">{hackathonDemoProfile.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-white/68">
                    Computer science student, laptop-only setup, eye strain and neck pain, one-time budget.
                  </p>
                </div>
                <ScoreBadge score={topRecommendations[0]?.score ?? 0} size="lg" />
              </div>
              <div className="space-y-3">
                {demoPriorityList.map((item) => (
                  <div key={item.category} className="rounded-[1.35rem] border border-white/10 bg-black/10 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="font-display text-lg font-semibold">
                        {item.rank}. {categoryLabels[item.category]}
                      </p>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                        {item.recommendation?.score ?? 0}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-white/72">
                      {item.recommendation?.explanation.problemSolved ??
                        "Only then revisit a laptop upgrade once the high-impact fixes are in place."}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.9rem] border border-white/10 bg-slate-900/70 p-5 text-slate-100 backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">Why it demos well</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                {[
                  "The hero score makes the priority obvious immediately.",
                  "Every recommendation includes a personal explanation and tradeoffs.",
                  "The UI is compact enough to screenshot cleanly without feeling cramped.",
                ].map((point) => (
                  <div key={point} className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
                    {point}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        {topRecommendations.map((recommendation) => (
          <RecommendationCard
            key={recommendation.product.id}
            recommendation={recommendation}
            availability={availabilityByProductId[recommendation.product.id]}
            narration={narrationByProductId.get(recommendation.product.id)?.output ?? null}
            narrationSource={narrationByProductId.get(recommendation.product.id)?.source ?? null}
          />
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200/80">Catalog preview</p>
            <h2 className="font-display text-2xl font-semibold text-white">Seed products ready for scoring</h2>
          </div>
          <Link href="/recommendations" className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">
            See rankings
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {previewProducts.map((product) => (
            <ProductCard key={product.id} product={product} availability={availabilityByProductId[product.id]} />
          ))}
        </div>
      </section>
    </div>
  );
}
