"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { saveScanInventoryAction } from "@/app/scan/actions";
import { ActionButton } from "@/components/ui/ActionButton";
import type { ScanSummary, SuggestedInventoryItem } from "@/lib/vision/types";

interface DraftScanItem extends SuggestedInventoryItem {
  approved: boolean;
  brand: string;
  model: string;
}

function inputClassName(): string {
  return "w-full rounded-[1.1rem] border border-ink/10 bg-mist/75 px-4 py-3 outline-none ring-moss/20 transition focus:border-moss/30 focus:ring-4";
}

function humanizeCategory(value: string): string {
  return value.replaceAll("_", " ");
}

function signalLabel([key, value]: [string, boolean]): string | null {
  if (!value) return null;

  return key
    .replace(/^has/, "")
    .replace(/^possible/, "Possible ")
    .replace(/([A-Z])/g, " $1")
    .trim();
}

function humanizeStyle(value: string): string {
  return value.replaceAll("_", " ");
}

export function ScanReview({ summary }: { summary: ScanSummary | null }) {
  const [items, setItems] = useState<DraftScanItem[]>([]);

  useEffect(() => {
    if (!summary) {
      setItems([]);
      return;
    }

    setItems(
      summary.suggestedInventoryItems.map((item) => ({
        ...item,
        approved: true,
        brand: item.suggestedBrand,
        model: item.suggestedModel,
      })),
    );
  }, [summary]);

  if (!summary) {
    return (
      <section className="rounded-[2rem] border border-dashed border-ink/12 bg-white/80 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-moss">Review before saving</p>
        <h2 className="mt-3 font-display text-3xl font-semibold">No scan summary yet</h2>
        <p className="mt-3 max-w-2xl leading-7 text-ink/66">
          Start a scan, walk around the setup for a few moments, then review the estimated inventory items before
          anything is saved.
        </p>
      </section>
    );
  }

  const approvedCount = items.filter((item) => item.approved).length;
  const payload = JSON.stringify(
    items.map((item) => ({
      approved: item.approved,
      category: item.category,
      brand: item.brand,
      model: item.model,
      confidence: item.confidence,
      estimatedCount: item.estimatedCount,
      sourceLabels: item.sourceLabels,
    })),
  );

  return (
    <section className="space-y-6 rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-moss">Estimated scan review</p>
          <h2 className="mt-3 font-display text-3xl font-semibold">Review detections before they touch inventory</h2>
          <p className="mt-3 max-w-3xl leading-7 text-ink/66">
            These detections are estimates from sampled video frames. Only approved items will be saved.
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/58">
            These are visual estimates, not exact measurements. Exact model/specs are added in the next step.
          </p>
        </div>
        <div className="rounded-[1.4rem] bg-mist px-4 py-3 text-sm text-ink/72">
          {summary.sampledFrameCount} frames sampled, {summary.totalDetections} raw detections
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4 rounded-[1.6rem] bg-mist/70 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Estimated setup style</p>
            <div className="mt-3 rounded-[1.2rem] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(23,33,31,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold capitalize text-ink">{humanizeStyle(summary.estimatedStyle)}</p>
                <span className="rounded-full border border-ink/10 px-3 py-1 text-xs font-semibold text-ink/60">
                  Visual estimate
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-ink/64">
                Style is inferred from layout heuristics only. Premium style is held back until exact models are known.
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Detected categories</p>
            <div className="mt-3 space-y-3">
              {summary.detectedCategories.length > 0 ? (
                summary.detectedCategories.map((category) => (
                  <div key={category.category} className="rounded-[1.2rem] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(23,33,31,0.05)]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold capitalize text-ink">{humanizeCategory(category.category)}</p>
                      <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white">
                        {Math.round(category.confidence * 100)}%
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-ink/65">
                      Count estimate: {category.countEstimate}. Seen in {category.frameHits} sampled frames.
                    </p>
                    <p className="mt-1 text-sm text-ink/62">
                      Size estimate: {category.sizeEstimate.sizeClass}. Width ratio {category.sizeEstimate.relativeWidthRatio},
                      height ratio {category.sizeEstimate.relativeHeightRatio}.
                    </p>
                    <p className="mt-1 text-xs text-ink/48">
                      Reference object needed for exact measurements. Confidence {Math.round(category.sizeEstimate.confidence * 100)}%.
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-ink/40">{category.labels.join(", ")}</p>
                  </div>
                ))
              ) : (
                <p className="rounded-[1.2rem] bg-white px-4 py-3 text-sm text-ink/65">
                  Nothing confident enough to suggest yet. Manual entry is still available.
                </p>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Possible issue detected</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {summary.possibleIssues.length > 0 ? (
                summary.possibleIssues.map((issue) => (
                  <span key={issue} className="rounded-full border border-gold/25 bg-gold/10 px-3 py-2 text-xs font-semibold text-ink/76">
                    {issue}
                  </span>
                ))
              ) : (
                <span className="rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink/60">
                  No obvious issue detected
                </span>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Setup signals</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(summary.setupSignals)
                .map((entry) => signalLabel(entry as [string, boolean]))
                .filter((label): label is string => Boolean(label))
                .map((label) => (
                  <span key={label} className="rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink/72">
                    {label}
                  </span>
                ))}
            </div>
          </div>
        </div>

        <form action={saveScanInventoryAction} className="space-y-4">
          <input type="hidden" name="payload" value={payload} />

          <div className="rounded-[1.6rem] border border-ink/10 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Suggested inventory items</p>
            <p className="mt-2 text-sm leading-6 text-ink/66">
              Approve the items that look right, tweak brand or model text, and save only the ones you want in the
              inventory list.
            </p>

            <div className="mt-4 space-y-4">
              {items.length > 0 ? (
                items.map((item, index) => (
                  <div key={item.id} className="rounded-[1.35rem] border border-ink/10 bg-mist/45 p-4">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={item.approved}
                        onChange={(event) =>
                          setItems((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, approved: event.target.checked } : entry,
                            ),
                          )
                        }
                        className="mt-1 size-4 rounded border-ink/30 text-moss focus:ring-moss"
                      />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-semibold capitalize text-ink">{humanizeCategory(item.category)}</p>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/60">
                            Estimate {Math.round(item.confidence * 100)}%
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-ink/62">
                          Count estimate: {item.estimatedCount}. Size class: {item.sizeClass}. Based on labels:{" "}
                          {item.sourceLabels.join(", ")}.
                        </p>
                      </div>
                    </label>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-ink/72">Brand</span>
                        <input
                          value={item.brand}
                          onChange={(event) =>
                            setItems((current) =>
                              current.map((entry, entryIndex) =>
                                entryIndex === index ? { ...entry, brand: event.target.value } : entry,
                              ),
                            )
                          }
                          className={inputClassName()}
                          placeholder="Optional brand"
                          disabled={!item.approved}
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-medium text-ink/72">Model</span>
                        <input
                          value={item.model}
                          onChange={(event) =>
                            setItems((current) =>
                              current.map((entry, entryIndex) =>
                                entryIndex === index ? { ...entry, model: event.target.value } : entry,
                              ),
                            )
                          }
                          className={inputClassName()}
                          placeholder="Review or rename this estimate"
                          disabled={!item.approved}
                        />
                      </label>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-ink/12 p-4 text-sm leading-6 text-ink/66">
                  No save-ready inventory suggestions came out of this scan. You can rescan or add items manually.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-gold/20 bg-gold/10 p-4 text-sm leading-6 text-ink/74">
            Video is processed locally in your browser for the MVP. Only approved inventory items are saved.
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ActionButton
              type="submit"
              pendingText="Saving approved items..."
              variant="primary"
              disabled={approvedCount === 0 || items.length === 0}
            >
              Save approved items to inventory
            </ActionButton>
            <Link
              href="/inventory"
              className="rounded-full border border-ink/12 px-5 py-3 text-sm font-semibold text-ink/72 transition hover:bg-mist"
            >
              Open manual inventory entry
            </Link>
          </div>
        </form>
      </div>
    </section>
  );
}
