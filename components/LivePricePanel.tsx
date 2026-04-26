"use client";

import { useState } from "react";
import {
  buildLivePriceCardStateFromResponse,
  buttonLabelForLivePrice,
  type LivePriceCardState,
  type PricesCheckResponse,
} from "@/lib/availability/livePrice";
import { formatLastCheckedTimestamp } from "@/lib/availability/display";
import { formatUsdFromCents } from "@/lib/ui/format";

interface LivePricePanelProps {
  deviceCatalogId?: string | null;
  slug?: string | null;
  initialState: LivePriceCardState;
  className?: string;
}

function statusTone(status: LivePriceCardState["status"], quotaReached: boolean): string {
  if (quotaReached) return "bg-clay/12 text-clay";
  if (status === "live_checked") return "bg-moss/12 text-moss";
  if (status === "cached") return "bg-gold/16 text-ink";
  if (status === "stale_cached") return "bg-clay/10 text-clay";
  return "bg-ink/8 text-ink/60";
}

export function LivePricePanel({ deviceCatalogId, slug, initialState, className = "" }: LivePricePanelProps) {
  const [state, setState] = useState(initialState);
  const [isChecking, setIsChecking] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const buttonLabel = buttonLabelForLivePrice(state);

  async function checkLivePrice() {
    if (!deviceCatalogId && !slug) {
      setRequestError("This recommendation is missing a catalog identifier.");
      return;
    }

    setIsChecking(true);
    setRequestError(null);

    try {
      const response = await fetch("/api/prices/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceCatalogId: deviceCatalogId ?? undefined,
          slug: slug ?? undefined,
          forceRefresh: state.status === "stale_cached",
        }),
      });
      const payload = (await response.json()) as PricesCheckResponse & { error?: string };

      if (!response.ok || !payload.status) {
        throw new Error(payload.error ?? "Could not check live pricing.");
      }

      setState(buildLivePriceCardStateFromResponse(payload, state.catalogEstimateCents));
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Could not check live pricing.");
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <div className={`rounded-2xl border border-ink/8 bg-white p-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Live pricing</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${statusTone(state.status, state.quotaReached)}`}>
              {state.statusLabel}
            </span>
            <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink/60">
              {state.availabilityLabel}
            </span>
          </div>
        </div>

        {buttonLabel ? (
          <button
            type="button"
            onClick={checkLivePrice}
            disabled={isChecking}
            className="inline-flex min-w-[10.5rem] items-center justify-center rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-moss/30 hover:text-moss disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isChecking ? "Checking live deals..." : buttonLabel}
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-mist/55 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Best offer</p>
          <p className="mt-2 text-sm font-semibold text-ink">
            {state.bestOffer ? formatUsdFromCents(state.bestOffer.totalPriceCents) : state.catalogEstimateCents !== null ? formatUsdFromCents(state.catalogEstimateCents) : "No price yet"}
          </p>
          <p className="mt-1 text-sm leading-6 text-ink/62">
            {state.bestOffer?.title ?? "Showing the catalog estimate until a matching live offer is available."}
          </p>
        </div>
        <div className="rounded-2xl bg-mist/55 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Seller</p>
          <p className="mt-2 text-sm font-semibold text-ink">{state.bestOffer?.seller ?? "No seller yet"}</p>
          <p className="mt-1 text-sm leading-6 text-ink/62">{state.offerCount} offer{state.offerCount === 1 ? "" : "s"} matched.</p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-mist/55 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Fetched at</p>
          <p className="mt-2 text-sm text-ink/68">{state.fetchedAtIso ? formatLastCheckedTimestamp(new Date(state.fetchedAtIso)) : "Not checked yet"}</p>
        </div>
        <div className="rounded-2xl bg-mist/55 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Price basis</p>
          <p className="mt-2 text-sm text-ink/68">
            {state.bestOffer ? `Offer total ${formatUsdFromCents(state.bestOffer.totalPriceCents)}` : state.catalogEstimateCents !== null ? `Catalog estimate ${formatUsdFromCents(state.catalogEstimateCents)}` : "No estimate available"}
          </p>
        </div>
      </div>

      {state.message ? <p className="mt-3 text-sm leading-6 text-ink/64">{state.message}</p> : null}
      {requestError ? <p className="mt-3 text-sm leading-6 text-clay">{requestError}</p> : null}
    </div>
  );
}
