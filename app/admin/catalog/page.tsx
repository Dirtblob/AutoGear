"use client";

import { useMemo, useState } from "react";
import { catalogProducts } from "@/data/productCatalog";
import {
  catalogProductDedupeKey,
  deduplicateCatalogProductDetails,
  findCatalogDuplicate,
  futureCatalogProviderTodo,
  normalizeCatalogProductDetails,
  searchCatalogCandidates,
  type CatalogCandidateReview,
} from "@/lib/catalog/ingestionPipeline";
import { createManualImportProvider } from "@/lib/catalog/providers/manualImportProvider";
import { staticCatalogProvider, toCatalogProductDetails } from "@/lib/catalog/providers/staticProvider";
import type { CatalogProductDetails } from "@/lib/catalog/providers/types";
import { PRODUCT_CATEGORIES, type ProductCategory } from "@/lib/recommendation/types";

type ReviewStatus = "pending" | "approved" | "rejected";

interface ReviewItem extends CatalogCandidateReview {
  id: string;
  status: ReviewStatus;
  specsJson: string;
  error?: string;
}

const sampleImportJson = JSON.stringify(
  [
    {
      brand: "BenQ",
      model: "ScreenBar Halo",
      displayName: "BenQ ScreenBar Halo Monitor Light",
      category: "desk_lamp",
      specs: {
        brightness: "500 lux",
        colorTemperature: "2700K-6500K",
        deskFootprint: "none",
        glareReduction: true,
      },
      aliases: ["ScreenBar Halo", "BenQ monitor light"],
      source: "manual",
      sourceUrl: "https://example.com/source-note",
    },
  ],
  null,
  2,
);

function inputClassName(): string {
  return "w-full rounded-[1.1rem] border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-moss/20 transition focus:border-moss/35 focus:ring-4";
}

function categoryLabel(category: ProductCategory): string {
  return category.replaceAll("_", " ");
}

function detailsWithSpecs(details: CatalogProductDetails, specsJson: string): CatalogProductDetails {
  const parsedSpecs = JSON.parse(specsJson) as unknown;
  if (!parsedSpecs || typeof parsedSpecs !== "object" || Array.isArray(parsedSpecs)) {
    throw new Error("Specs must be a JSON object.");
  }

  return normalizeCatalogProductDetails({
    ...details,
    specs: parsedSpecs as Record<string, unknown>,
  });
}

function createReviewId(review: CatalogCandidateReview, index: number): string {
  return `${review.candidate.source}:${catalogProductDedupeKey(review.candidate)}:${index}`;
}

export default function AdminCatalogPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ProductCategory | "all">("all");
  const [existingResults, setExistingResults] = useState<CatalogCandidateReview[]>([]);
  const [importJson, setImportJson] = useState(sampleImportJson);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [approvedProducts, setApprovedProducts] = useState<CatalogProductDetails[]>([]);
  const [message, setMessage] = useState("Search or import products to begin review.");
  const [busy, setBusy] = useState(false);

  const existingProducts = useMemo(() => catalogProducts.map(toCatalogProductDetails), []);
  const uniqueApprovedProducts = useMemo(() => deduplicateCatalogProductDetails(approvedProducts), [approvedProducts]);
  const selectedCategory = category === "all" ? undefined : category;

  async function searchExistingModels() {
    setBusy(true);
    setMessage("Searching static catalog.");

    try {
      const results = await searchCatalogCandidates({
        providers: [staticCatalogProvider],
        query,
        category: selectedCategory,
      });
      setExistingResults(results);
      setMessage(`Found ${results.length} existing catalog model${results.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not search catalog.");
    } finally {
      setBusy(false);
    }
  }

  async function importManualJson() {
    setBusy(true);
    setMessage("Parsing manual import JSON.");

    try {
      const provider = createManualImportProvider(importJson);
      const imported = await searchCatalogCandidates({
        providers: [provider],
        query: "",
        category: selectedCategory,
        existingProducts: [...existingProducts, ...uniqueApprovedProducts],
      });
      const reviewItems = imported.map<ReviewItem>((review, index) => ({
        ...review,
        id: createReviewId(review, index),
        status: "pending",
        specsJson: JSON.stringify(review.normalizedDetails?.specs ?? {}, null, 2),
      }));

      setReviews((current) => [...reviewItems, ...current]);
      setMessage(`Imported ${reviewItems.length} candidate${reviewItems.length === 1 ? "" : "s"} for review.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Manual import JSON could not be parsed.");
    } finally {
      setBusy(false);
    }
  }

  function updateSpecs(reviewId: string, specsJson: string) {
    setReviews((current) =>
      current.map((item) => (item.id === reviewId ? { ...item, specsJson, error: undefined } : item)),
    );
  }

  function approveCandidate(reviewId: string) {
    setReviews((current) =>
      current.map((item) => {
        if (item.id !== reviewId) return item;
        if (!item.normalizedDetails) return { ...item, error: "This candidate has no product details to approve." };

        try {
          const approved = detailsWithSpecs(item.normalizedDetails, item.specsJson);
          const duplicateOf = findCatalogDuplicate(approved, [...existingProducts, ...uniqueApprovedProducts]);
          setApprovedProducts((products) => deduplicateCatalogProductDetails([...products, approved]));

          return {
            ...item,
            status: "approved",
            normalizedDetails: approved,
            duplicateOf,
            dedupeKey: catalogProductDedupeKey(approved),
            error: undefined,
          };
        } catch (error) {
          return { ...item, error: error instanceof Error ? error.message : "Specs JSON is invalid." };
        }
      }),
    );
  }

  function rejectCandidate(reviewId: string) {
    setReviews((current) =>
      current.map((item) => (item.id === reviewId ? { ...item, status: "rejected", error: undefined } : item)),
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-moss">Admin catalog</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Product model ingestion</h1>
            <p className="mt-3 max-w-3xl leading-7 text-ink/65">
              Review provider candidates, edit normalized specs, and deduplicate by brand, model, and category before
              approving catalog additions.
            </p>
          </div>
          <div className="rounded-2xl bg-mist px-4 py-3 text-sm font-semibold text-ink/65">
            {uniqueApprovedProducts.length} approved this session
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold">Search existing models</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_220px]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={inputClassName()}
              placeholder="MX Master, 4K monitor, chair..."
            />
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as ProductCategory | "all")}
              className={inputClassName()}
            >
              <option value="all">All categories</option>
              {PRODUCT_CATEGORIES.map((productCategory) => (
                <option key={productCategory} value={productCategory}>
                  {categoryLabel(productCategory)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={searchExistingModels}
            disabled={busy}
            className="mt-4 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-moss disabled:opacity-60"
          >
            Search catalog
          </button>

          <div className="mt-5 space-y-3">
            {existingResults.slice(0, 8).map((result) => (
              <div key={result.dedupeKey} className="rounded-2xl border border-ink/8 bg-mist p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{result.candidate.title}</p>
                    <p className="mt-1 text-sm text-ink/58">
                      {result.candidate.brand} {result.candidate.model} · {categoryLabel(result.candidate.category)}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/58">
                    {Math.round(result.candidate.confidence * 100)}% confidence
                  </span>
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">
                  Source: {result.candidate.source}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold">Import JSON product models</h2>
          <textarea
            value={importJson}
            onChange={(event) => setImportJson(event.target.value)}
            rows={16}
            className={`${inputClassName()} mt-5 font-mono text-xs leading-5`}
            spellCheck={false}
          />
          <button
            type="button"
            onClick={importManualJson}
            disabled={busy}
            className="mt-4 rounded-full bg-moss px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink disabled:opacity-60"
          >
            Import candidates
          </button>
          <p className="mt-4 rounded-2xl bg-mist p-4 text-sm leading-6 text-ink/62">{futureCatalogProviderTodo}</p>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Candidate review queue</h2>
            <p className="mt-2 text-sm text-ink/58">{message}</p>
          </div>
          <div className="rounded-full bg-mist px-4 py-2 text-sm font-semibold text-ink/58">
            {reviews.filter((item) => item.status === "pending").length} pending
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {reviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink/15 bg-mist p-8 text-center text-ink/58">
              Manual imports will appear here for approval, rejection, deduplication, and spec editing.
            </div>
          ) : null}

          {reviews.map((item) => (
            <article key={item.id} className="rounded-2xl border border-ink/8 bg-mist p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{item.candidate.title}</h3>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/58">
                      {item.status}
                    </span>
                    {item.duplicateOf ? (
                      <span className="rounded-full bg-gold/45 px-3 py-1 text-xs font-semibold text-ink">
                        Duplicate of {item.duplicateOf.displayName}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-ink/60">
                    {item.candidate.brand} {item.candidate.model} · {categoryLabel(item.candidate.category)}
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">
                    Source: {item.candidate.source} · Confidence: {Math.round(item.candidate.confidence * 100)}%
                  </p>
                  {item.candidate.sourceUrl ? (
                    <a
                      href={item.candidate.sourceUrl}
                      className="mt-2 inline-block text-sm font-semibold text-moss underline decoration-moss/30 underline-offset-4"
                    >
                      View source
                    </a>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => approveCandidate(item.id)}
                    className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-moss"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => rejectCandidate(item.id)}
                    className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink/70 transition hover:bg-white/70"
                  >
                    Reject
                  </button>
                </div>
              </div>

              <label className="mt-4 block space-y-2">
                <span className="text-sm font-semibold text-ink/70">Specs JSON</span>
                <textarea
                  value={item.specsJson}
                  onChange={(event) => updateSpecs(item.id, event.target.value)}
                  rows={7}
                  className={`${inputClassName()} font-mono text-xs leading-5`}
                  spellCheck={false}
                />
              </label>
              {item.error ? <p className="mt-3 text-sm font-semibold text-clay">{item.error}</p> : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
