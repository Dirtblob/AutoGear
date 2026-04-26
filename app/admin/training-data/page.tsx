import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfirmActionForm } from "@/components/admin/ConfirmActionForm";
import { productCatalog } from "@/data/seeds/productCatalog";
import {
  deleteAllTrainingExamplesAction,
  deleteLowQualityTrainingExamplesAction,
  generateTrainingExamplesFromScenariosAction,
} from "@/app/admin/training-data/actions";
import { db } from "@/lib/db";
import { buildRecommendationNarrationId } from "@/lib/llm/explanationCache";
import { readCachedRecommendationNarration } from "@/lib/llm/recommendationNarrator";
import {
  buildDeterministicRecommendationExplanation,
  buildRecommendationKey,
  buildStoredTrainingExample,
  getTrainingExampleRecommendationKey,
  parseTrainingInputPayload,
  parseTrainingTargetPayload,
  type TrainingExampleSource,
} from "@/lib/llm/trainingData";
import { rerankProductRecommendationsWithAvailability } from "@/lib/recommendation/availabilityRanking";
import { getCategoryRecommendations } from "@/lib/recommendation/categoryEngine";
import { getProductRecommendations } from "@/lib/recommendation/productEngine";
import { categoryLabels } from "@/lib/recommendation/scoring";
import { getAvailabilityForProduct, loadLatestRecommendationContext, loadRecommendationContext } from "@/lib/userData";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const trainingSourceOptions: TrainingExampleSource[] = ["generated", "edited", "approved"];

function getFirstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function inputClassName(): string {
  return "w-full rounded-[1rem] border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-moss/20 transition focus:border-moss/35 focus:ring-4";
}

function textareaClassName(): string {
  return `${inputClassName()} min-h-28 resize-y leading-6`;
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function sourceBadgeTone(source: TrainingExampleSource): string {
  if (source === "approved") return "bg-moss/12 text-moss";
  if (source === "edited") return "bg-gold/18 text-ink";
  return "bg-ink/8 text-ink/70";
}

function parseTrainingSource(value: FormDataEntryValue | null): TrainingExampleSource {
  return trainingSourceOptions.includes(value as TrainingExampleSource)
    ? (value as TrainingExampleSource)
    : "generated";
}

function parseOptionalInteger(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 1 || parsed > 5) return null;
  return parsed;
}

function buildStatusHref(status: string): string {
  return `/admin/training-data?status=${encodeURIComponent(status)}`;
}

function buildStatusHrefWithCount(status: string, count: number): string {
  return `/admin/training-data?status=${encodeURIComponent(status)}&count=${encodeURIComponent(String(count))}`;
}

async function findExistingTrainingExampleId(recommendationKey: string): Promise<string | null> {
  const existingExamples = await db.trainingExample.findMany({
    select: {
      id: true,
      inputJson: true,
    },
    orderBy: { createdAt: "desc" },
  });

  for (const example of existingExamples) {
    if (getTrainingExampleRecommendationKey(example) === recommendationKey) {
      return example.id;
    }
  }

  return null;
}

async function saveOrUpdateTrainingExample(
  example: ReturnType<typeof buildStoredTrainingExample>,
  recommendationKey: string,
): Promise<"created" | "updated"> {
  const existingId = await findExistingTrainingExampleId(recommendationKey);
  const data = {
    inputJson: example.inputJson,
    targetOutputJson: example.targetOutputJson,
    source: example.source,
    qualityRating: example.qualityRating ?? null,
    notes: example.notes ?? null,
  };

  if (existingId) {
    await db.trainingExample.update({
      where: { id: existingId },
      data,
    });

    return "updated";
  }

  await db.trainingExample.create({ data });
  return "created";
}

async function saveTrainingExampleAction(formData: FormData): Promise<void> {
  "use server";

  const productId = String(formData.get("productId") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const source = parseTrainingSource(formData.get("source"));
  const qualityRating = parseOptionalInteger(formData.get("qualityRating"));
  const notes = String(formData.get("notes") ?? "").trim();
  const idealExplanation = String(formData.get("idealExplanation") ?? "").trim();

  if (!productId || !category) {
    redirect(buildStatusHref("missing_recommendation"));
  }

  const context = await loadRecommendationContext();
  if (!context) {
    redirect(buildStatusHref("missing_profile"));
  }

  const recommendationInput = {
    profile: context.profile,
    inventory: context.inventory,
    privateProfile: context.privateProfile,
    exactCurrentModelsProvided: context.exactCurrentModelsProvided,
    usedItemsOkay: context.usedItemsOkay,
    ports: context.ports,
    deviceType: context.deviceType,
    availabilityByProductId: context.availabilityByProductId,
  } as const;

  const categoryRecommendation = getCategoryRecommendations(recommendationInput).find(
    (candidate) => candidate.category === category,
  );

  if (!categoryRecommendation) {
    redirect(buildStatusHref("missing_recommendation"));
  }

  const recommendation = rerankProductRecommendationsWithAvailability(
    getProductRecommendations(recommendationInput, categoryRecommendation, productCatalog),
    context.availabilityByProductId,
  ).find((candidate) => candidate.product.id === productId);

  if (!recommendation) {
    redirect(buildStatusHref("missing_recommendation"));
  }

  const availability = getAvailabilityForProduct(context.availabilityByProductId, recommendation.product.id);
  const availabilitySnapshot = await db.availabilitySnapshot.findFirst({
    where: { productModelId: recommendation.product.id },
    orderBy: { checkedAt: "desc" },
  });
  const deterministicExplanation = buildDeterministicRecommendationExplanation(recommendation);
  const llmExplanation = (
    await readCachedRecommendationNarration(
      {
        profile: context.profile,
        inventory: context.inventory,
        categoryRecommendation,
        productRecommendation: recommendation,
        availability,
        exactCurrentModelsProvided: context.exactCurrentModelsProvided,
      },
      {
        recommendationId: buildRecommendationNarrationId(context.profile.id, categoryRecommendation.category),
        recordMetrics: false,
      },
    )
  ).output.explanation;
  const recommendationKey = buildRecommendationKey(context.profile.id, recommendation.product.id);
  const example = buildStoredTrainingExample({
    profile: context.profile,
    inventory: context.inventory,
    categoryRecommendation,
    recommendation,
    availability,
    availabilitySnapshot: availabilitySnapshot
      ? {
          provider: availabilitySnapshot.provider,
          retailer: availabilitySnapshot.retailer,
          available: availabilitySnapshot.available,
          priceCents: availabilitySnapshot.priceCents,
          shippingCents: availabilitySnapshot.shippingCents,
          totalPriceCents: availabilitySnapshot.totalPriceCents,
          checkedAt: availabilitySnapshot.checkedAt,
          condition: availabilitySnapshot.condition,
          url: availabilitySnapshot.url,
        }
      : null,
    deterministicExplanation,
    llmExplanation,
    idealExplanation,
    source,
    qualityRating,
    notes,
  });

  await saveOrUpdateTrainingExample(example, recommendationKey);

  revalidatePath("/admin/training-data");
  redirect(buildStatusHrefWithCount("saved", 1));
}

async function generateTrainingExamplesFromLatestRecommendationsAction(): Promise<void> {
  "use server";

  const context = await loadLatestRecommendationContext();
  if (!context) {
    redirect(buildStatusHref("missing_profile"));
  }

  const latestRecommendations = await db.recommendation.findMany({
    where: {
      userProfileId: context.profileId,
      productModelId: { not: null },
    },
    orderBy: [{ createdAt: "desc" }, { score: "desc" }],
  });

  if (latestRecommendations.length === 0) {
    redirect(buildStatusHref("missing_recommendation"));
  }

  const recommendationInput = {
    profile: context.profile,
    inventory: context.inventory,
    privateProfile: context.privateProfile,
    exactCurrentModelsProvided: context.exactCurrentModelsProvided,
    usedItemsOkay: context.usedItemsOkay,
    ports: context.ports,
    deviceType: context.deviceType,
    availabilityByProductId: context.availabilityByProductId,
  } as const;

  const categoryRecommendations = getCategoryRecommendations(recommendationInput);
  const rankedRecommendationsByCategory = new Map(
    categoryRecommendations.map((categoryRecommendation) => [
      categoryRecommendation.category,
      rerankProductRecommendationsWithAvailability(
        getProductRecommendations(recommendationInput, categoryRecommendation, productCatalog),
        context.availabilityByProductId,
      ),
    ]),
  );
  const latestAvailabilitySnapshots = await db.availabilitySnapshot.findMany({
    where: {
      productModelId: {
        in: latestRecommendations.flatMap((recommendation) =>
          recommendation.productModelId ? [recommendation.productModelId] : [],
        ),
      },
    },
    orderBy: [{ checkedAt: "desc" }, { id: "desc" }],
  });
  const latestAvailabilitySnapshotByProductId = new Map<string, (typeof latestAvailabilitySnapshots)[number]>();

  for (const snapshot of latestAvailabilitySnapshots) {
    if (!latestAvailabilitySnapshotByProductId.has(snapshot.productModelId)) {
      latestAvailabilitySnapshotByProductId.set(snapshot.productModelId, snapshot);
    }
  }

  let savedCount = 0;

  for (const storedRecommendation of latestRecommendations) {
    const productId = storedRecommendation.productModelId;
    if (!productId) continue;

    const categoryRecommendation = categoryRecommendations.find(
      (candidate) => candidate.category === storedRecommendation.category,
    );
    const rankedRecommendations = categoryRecommendation
      ? (rankedRecommendationsByCategory.get(categoryRecommendation.category) ?? [])
      : [];
    const recommendation = rankedRecommendations.find((candidate) => candidate.product.id === productId);

    if (!categoryRecommendation || !recommendation) {
      continue;
    }

    const availability = getAvailabilityForProduct(context.availabilityByProductId, recommendation.product.id);
    const latestAvailabilitySnapshot = latestAvailabilitySnapshotByProductId.get(recommendation.product.id);
    const rejectedAlternatives = rankedRecommendations
      .filter((candidate) => candidate.product.id !== recommendation.product.id)
      .slice(0, 3)
      .map((candidate) => ({
        label: candidate.product.name,
        reason: candidate.reasons[0] ?? candidate.whyNotCheaper,
      }));
    const deterministicExplanation = buildDeterministicRecommendationExplanation(recommendation);
    const example = buildStoredTrainingExample({
      profile: context.profile,
      inventory: context.inventory,
      categoryRecommendation,
      recommendation,
      availability,
      availabilitySnapshot: latestAvailabilitySnapshot
        ? {
            provider: latestAvailabilitySnapshot.provider,
            retailer: latestAvailabilitySnapshot.retailer,
            available: latestAvailabilitySnapshot.available,
            priceCents: latestAvailabilitySnapshot.priceCents,
            shippingCents: latestAvailabilitySnapshot.shippingCents,
            totalPriceCents: latestAvailabilitySnapshot.totalPriceCents,
            checkedAt: latestAvailabilitySnapshot.checkedAt,
            condition: latestAvailabilitySnapshot.condition,
            url: latestAvailabilitySnapshot.url,
          }
        : null,
      rejectedAlternatives: rejectedAlternatives.length > 0 ? rejectedAlternatives : undefined,
      deterministicExplanation,
      llmExplanation: deterministicExplanation,
      source: "generated",
    });

    await saveOrUpdateTrainingExample(example, buildRecommendationKey(context.profile.id, recommendation.product.id));
    savedCount += 1;
  }

  revalidatePath("/admin/training-data");
  redirect(buildStatusHrefWithCount("generated", savedCount));
}

export default async function TrainingDataPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = getFirstValue(params.status);
  const statusCount = Number.parseInt(getFirstValue(params.count) ?? "0", 10);

  const [context, storedExamples, exampleCount] = await Promise.all([
    loadRecommendationContext(),
    db.trainingExample.findMany({
      orderBy: { createdAt: "desc" },
      take: 24,
    }),
    db.trainingExample.count(),
  ]);

  const parsedExamples = storedExamples.map((example) => {
    const inputPayload = parseTrainingInputPayload(example);
    const targetPayload = parseTrainingTargetPayload(example);

    return {
      ...example,
      inputPayload,
      targetPayload,
      recommendationKey: getTrainingExampleRecommendationKey(example),
    };
  });

  const latestByRecommendationKey = new Map<string, (typeof parsedExamples)[number]>();
  const countsByRecommendationKey = new Map<string, number>();

  for (const example of parsedExamples) {
    if (!example.recommendationKey) continue;
    countsByRecommendationKey.set(
      example.recommendationKey,
      (countsByRecommendationKey.get(example.recommendationKey) ?? 0) + 1,
    );
    if (!latestByRecommendationKey.has(example.recommendationKey)) {
      latestByRecommendationKey.set(example.recommendationKey, example);
    }
  }

  const recommendationDrafts: Array<{
    recommendationKey: string;
    category: string;
    categoryExplanation: string;
    categoryScore: number;
    productName: string;
    score: number;
    deterministicExplanation: string;
    llmExplanation: string;
    structuredInputJson: string;
    latestSaved: (typeof parsedExamples)[number] | undefined;
    savedCount: number;
    productId: string;
  }> = [];

  if (context) {
    const recommendationInput = {
      profile: context.profile,
      inventory: context.inventory,
      privateProfile: context.privateProfile,
      exactCurrentModelsProvided: context.exactCurrentModelsProvided,
      usedItemsOkay: context.usedItemsOkay,
      ports: context.ports,
      deviceType: context.deviceType,
      availabilityByProductId: context.availabilityByProductId,
    } as const;
    const categoryRecommendations = getCategoryRecommendations(recommendationInput).slice(0, 4);

    for (const categoryRecommendation of categoryRecommendations) {
      const rankedRecommendations = rerankProductRecommendationsWithAvailability(
        getProductRecommendations(recommendationInput, categoryRecommendation, productCatalog),
        context.availabilityByProductId,
      ).slice(0, 2);

      for (const recommendation of rankedRecommendations) {
        const deterministicExplanation = buildDeterministicRecommendationExplanation(recommendation);
        const llmExplanation = (
          await readCachedRecommendationNarration(
            {
              profile: context.profile,
              inventory: context.inventory,
              categoryRecommendation,
              productRecommendation: recommendation,
              availability: getAvailabilityForProduct(context.availabilityByProductId, recommendation.product.id),
              exactCurrentModelsProvided: context.exactCurrentModelsProvided,
            },
            {
              recommendationId: buildRecommendationNarrationId(context.profile.id, categoryRecommendation.category),
              recordMetrics: false,
            },
          )
        ).output.explanation;
        const recommendationKey = buildRecommendationKey(context.profile.id, recommendation.product.id);
        const latestSaved = latestByRecommendationKey.get(recommendationKey);

        recommendationDrafts.push({
          recommendationKey,
          category: categoryRecommendation.category,
          categoryExplanation: categoryRecommendation.explanation,
          categoryScore: categoryRecommendation.score,
          productName: recommendation.product.name,
          score: recommendation.score,
          deterministicExplanation,
          llmExplanation,
          structuredInputJson: JSON.stringify(
            {
              profile: context.profile,
              inventory: context.inventory,
              categoryRecommendation: {
                category: categoryRecommendation.category,
                score: categoryRecommendation.score,
                priority: categoryRecommendation.priority,
                reasons: categoryRecommendation.reasons,
                problemsAddressed: categoryRecommendation.problemsAddressed,
                explanation: categoryRecommendation.explanation,
              },
              recommendation: {
                product: recommendation.product,
                score: recommendation.score,
                scoreBreakdown: recommendation.scoreBreakdown,
                fit: recommendation.fit,
                reasons: recommendation.reasons,
                explanation: recommendation.explanation,
                tradeoffs: recommendation.tradeoffs,
                whyNotCheaper: recommendation.whyNotCheaper,
                whyNotMoreExpensive: recommendation.whyNotMoreExpensive,
                availabilityStatus: recommendation.availabilityStatus,
              },
              deterministicExplanation,
              llmExplanation,
            },
            null,
            2,
          ),
          latestSaved,
          savedCount: countsByRecommendationKey.get(recommendationKey) ?? 0,
          productId: recommendation.product.id,
        });
      }
    }
  }

  const scenarioStats =
    status === "scenarios_generated"
      ? {
          scenarios: Number.parseInt(getFirstValue(params.scenarios) ?? "0", 10),
          recommendations: Number.parseInt(getFirstValue(params.recommendations) ?? "0", 10),
          saved: Number.parseInt(getFirstValue(params.saved) ?? "0", 10),
          skipped: Number.parseInt(getFirstValue(params.skipped) ?? "0", 10),
        }
      : null;

  const statusMessage =
    status === "scenarios_generated" && scenarioStats
      ? `Scenarios created: ${scenarioStats.scenarios}. Recommendations generated: ${scenarioStats.recommendations}. Training examples saved: ${scenarioStats.saved}. Duplicates skipped: ${scenarioStats.skipped}.`
      : status === "generated"
        ? `${Number.isFinite(statusCount) ? statusCount : 0} training examples saved.`
        : status === "deleted_all"
          ? `Deleted ${Number.isFinite(statusCount) ? statusCount : 0} training examples.`
          : status === "deleted_low_quality"
            ? `Deleted ${Number.isFinite(statusCount) ? statusCount : 0} low-quality training examples.`
        : status === "saved"
          ? `${Number.isFinite(statusCount) ? statusCount : 1} training example${statusCount === 1 || !Number.isFinite(statusCount) ? "" : "s"} saved.`
        : status === "missing_profile"
          ? "No active profile was available, so nothing was saved."
          : status === "missing_recommendation"
            ? "That recommendation could not be resolved from the current scoring context."
            : null;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-[linear-gradient(145deg,rgba(23,33,31,1)_0%,rgba(31,46,42,1)_46%,rgba(66,104,90,0.96)_100%)] text-white shadow-panel">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(224,171,69,0.34),transparent_18rem),radial-gradient(circle_at_bottom_right,rgba(66,104,90,0.32),transparent_22rem)] p-8 md:p-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">Admin training data</p>
              <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">
                Capture recommendation examples for future Gemma fine-tuning
              </h1>
              <p className="mt-4 text-base leading-7 text-white/74">
                Save structured recommendation inputs alongside deterministic explanations, draft LLM explanations, and
                manually edited ideal explanations. Export stays JSONL-only so fine-tuning can happen later outside the
                app.
              </p>
            </div>

            <div className="w-full max-w-sm rounded-[1.6rem] border border-white/12 bg-white/8 p-5 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Dataset status</p>
              <p className="mt-3 text-4xl font-semibold">{exampleCount}</p>
              <p className="mt-2 text-sm leading-6 text-white/76">
                {exampleCount} training example{exampleCount === 1 ? "" : "s"} saved.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <form action={generateTrainingExamplesFromLatestRecommendationsAction}>
                  <button
                    type="submit"
                    className="rounded-full bg-gold px-5 py-3 text-sm font-semibold text-ink transition hover:bg-white"
                  >
                    Generate examples from latest recommendations
                  </button>
                </form>
                <ConfirmActionForm
                  action={generateTrainingExamplesFromScenariosAction}
                  confirmMessage="Generate training examples from 20 synthetic demo scenarios? This uses cached/mock availability and does not call PricesAPI."
                  pendingText="Generating from scenarios..."
                  variant="accent"
                  fullWidth={false}
                >
                  Generate examples from demo scenarios
                </ConfirmActionForm>
                <ConfirmActionForm
                  action={deleteLowQualityTrainingExamplesAction}
                  confirmMessage="Delete all low-quality training examples? This removes only rows with no quality rating or ratings below 3."
                  pendingText="Deleting low-quality examples..."
                  variant="secondary"
                  fullWidth={false}
                >
                  Delete low-quality examples
                </ConfirmActionForm>
                <ConfirmActionForm
                  action={deleteAllTrainingExamplesAction}
                  confirmMessage="Delete all training examples? This only removes TrainingExample rows and cannot be undone."
                  pendingText="Deleting training examples..."
                  variant="danger"
                  fullWidth={false}
                >
                  Delete all training examples
                </ConfirmActionForm>
                <Link
                  href="/admin/training-data/export"
                  className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-gold"
                >
                  Export JSONL
                </Link>
                <Link
                  href="/recommendations"
                  className="rounded-full border border-white/18 px-5 py-3 text-sm font-semibold text-white/88 transition hover:bg-white/10"
                >
                  Open recommendations
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {statusMessage ? (
        <section className="rounded-[1.6rem] border border-moss/18 bg-white px-5 py-4 text-sm font-medium text-ink shadow-soft">
          {statusMessage}
          {status === "scenarios_generated" ? (
            <p className="mt-2 text-xs leading-5 text-ink/55">
              ⚠ These examples are synthetic and should be reviewed before fine-tuning. Availability data is
              cached/mock and does not reflect live prices.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-5 md:grid-cols-3">
        <article className="rounded-[1.6rem] bg-white p-6 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">Use the score as truth</p>
          <p className="mt-3 text-sm leading-6 text-ink/72">
            These examples teach explanation style, not ranking policy. The deterministic engine still decides what
            ranks first.
          </p>
        </article>
        <article className="rounded-[1.6rem] bg-white p-6 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">Prefer edited examples</p>
          <p className="mt-3 text-sm leading-6 text-ink/72">
            Keep the best generated drafts, but give the highest quality ratings to examples you reviewed and cleaned
            up manually.
          </p>
        </article>
        <article className="rounded-[1.6rem] bg-white p-6 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">Export later</p>
          <p className="mt-3 text-sm leading-6 text-ink/72">
            JSONL export is ready now. Actual LoRA or QLoRA fine-tuning should happen offline after this dataset is
            large enough and reviewed.
          </p>
        </article>
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-ink">Capture current recommendations</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/65">
              Each card recomputes the active recommendation, then lets you save it as generated, edited, or approved
              training data.
            </p>
          </div>
        </div>

        {!context ? (
          <div className="rounded-[1.8rem] border border-dashed border-ink/15 bg-white p-10 text-center shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-clay">No active profile</p>
            <h3 className="mt-3 font-display text-3xl font-semibold">Create a profile before capturing examples.</h3>
            <p className="mx-auto mt-4 max-w-2xl leading-7 text-ink/65">
              Training data capture is driven by the current deterministic recommendation output, so onboarding and
              inventory need to exist first.
            </p>
            <div className="mt-6">
              <Link href="/onboarding" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">
                Open onboarding
              </Link>
            </div>
          </div>
        ) : recommendationDrafts.length === 0 ? (
          <div className="rounded-[1.8rem] border border-dashed border-ink/15 bg-white p-10 text-center shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-clay">Nothing ranked yet</p>
            <h3 className="mt-3 font-display text-3xl font-semibold">The current profile has no candidate examples.</h3>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {recommendationDrafts.map((draft) => {
              const savedTarget = draft.latestSaved?.targetPayload;
              const defaultIdeal =
                savedTarget?.idealExplanation ??
                savedTarget?.selectedAssistantExplanation ??
                "";

              return (
                <article key={draft.recommendationKey} className="rounded-[1.8rem] bg-white p-6 shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink/72">
                          {categoryLabels[draft.category as keyof typeof categoryLabels] ?? draft.category}
                        </span>
                        <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                          Product score {draft.score}
                        </span>
                        <span className="rounded-full bg-gold/18 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink">
                          Category score {draft.categoryScore}
                        </span>
                      </div>
                      <h3 className="mt-4 text-2xl font-semibold text-ink">{draft.productName}</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/65">{draft.categoryExplanation}</p>
                    </div>

                    {draft.latestSaved ? (
                      <div className="rounded-[1.2rem] bg-mist px-4 py-3 text-right text-sm text-ink/72">
                        <p className="font-semibold text-ink">Last saved {formatDateTime(draft.latestSaved.createdAt)}</p>
                        <p className="mt-1">
                          {draft.savedCount} example{draft.savedCount === 1 ? "" : "s"} for this recommendation
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-[1.2rem] bg-mist px-4 py-3 text-sm text-ink/72">No saved example yet</div>
                    )}
                  </div>

                  <div className="mt-6 grid gap-4">
                    <div className="rounded-[1.2rem] bg-mist px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">Deterministic explanation</p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink/76">{draft.deterministicExplanation}</p>
                    </div>

                    <div className="rounded-[1.2rem] bg-mist px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">LLM explanation draft</p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink/76">{draft.llmExplanation}</p>
                    </div>

                    <details className="rounded-[1.2rem] bg-mist px-4 py-4">
                      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                        Structured input JSON
                      </summary>
                      <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-[1rem] bg-white p-4 text-xs leading-6 text-ink/76">
                        {draft.structuredInputJson}
                      </pre>
                    </details>
                  </div>

                  <form action={saveTrainingExampleAction} className="mt-6 space-y-4">
                    <input type="hidden" name="productId" value={draft.productId} />
                    <input type="hidden" name="category" value={draft.category} />

                    <div className="grid gap-4 md:grid-cols-[180px_180px_1fr]">
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/62">Source</span>
                        <select
                          name="source"
                          defaultValue={draft.latestSaved?.source ?? "generated"}
                          className={inputClassName()}
                        >
                          <option value="generated">generated</option>
                          <option value="edited">edited</option>
                          <option value="approved">approved</option>
                        </select>
                      </label>

                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/62">Quality rating</span>
                        <select
                          name="qualityRating"
                          defaultValue={draft.latestSaved?.qualityRating?.toString() ?? ""}
                          className={inputClassName()}
                        >
                          <option value="">None</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="4">4</option>
                          <option value="5">5</option>
                        </select>
                      </label>

                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/62">Notes</span>
                        <input
                          name="notes"
                          defaultValue={draft.latestSaved?.notes ?? ""}
                          className={inputClassName()}
                          placeholder="What makes this example useful or risky?"
                        />
                      </label>
                    </div>

                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/62">
                        Ideal explanation
                      </span>
                      <textarea
                        name="idealExplanation"
                        defaultValue={defaultIdeal}
                        className={textareaClassName()}
                        placeholder="Rewrite the explanation the way you would want Gemma to answer later."
                      />
                    </label>

                    <button
                      type="submit"
                      className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-moss"
                    >
                      Save training example
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-[1.8rem] bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-ink">Recent saved examples</h2>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              Latest examples are shown here so you can sanity-check source labels, quality ratings, and the assistant
              text that will land in export.
            </p>
          </div>
          <Link
            href="/admin/training-data/export"
            className="rounded-full border border-ink/12 px-5 py-3 text-sm font-semibold text-ink transition hover:border-moss/30 hover:text-moss"
          >
            Download JSONL
          </Link>
        </div>

        {parsedExamples.length === 0 ? (
          <div className="mt-6 rounded-[1.4rem] border border-dashed border-ink/15 bg-mist/45 p-8 text-center text-sm text-ink/65">
            No training examples have been saved yet.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {parsedExamples.map((example) => {
              const productName =
                example.inputPayload?.structuredInput.recommendation.product.name ?? "Saved recommendation";
              const assistantText = example.targetPayload?.selectedAssistantExplanation ?? "No assistant output saved.";

              return (
                <article key={example.id} className="rounded-[1.4rem] border border-ink/8 bg-mist/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${sourceBadgeTone(example.source as TrainingExampleSource)}`}>
                          {example.source}
                        </span>
                        {example.qualityRating ? (
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink/70">
                            Quality {example.qualityRating}/5
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-ink">{productName}</h3>
                      <p className="mt-1 text-sm text-ink/58">{formatDateTime(example.createdAt)}</p>
                    </div>
                    <p className="max-w-xl text-sm leading-6 text-ink/72">{assistantText}</p>
                  </div>
                  {example.notes ? <p className="mt-3 text-sm leading-6 text-ink/60">Notes: {example.notes}</p> : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
