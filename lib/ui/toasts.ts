export type ToastTone = "success" | "error" | "info";

export const toastRegistry = {
  profile_saved: {
    title: "Profile ready",
    description: "Onboarding is saved. You're ready to capture the current setup.",
    tone: "success",
  },
  demo_profile_ready: {
    title: "Demo profile loaded",
    description: "A polished sample profile is ready for your 3-minute walkthrough.",
    tone: "success",
  },
  item_added: {
    title: "Inventory updated",
    description: "The item was added and will influence the next recommendation run.",
    tone: "success",
  },
  item_updated: {
    title: "Item updated",
    description: "The setup record now reflects the latest model and condition details.",
    tone: "success",
  },
  item_deleted: {
    title: "Item removed",
    description: "That piece of gear is no longer included in recommendation scoring.",
    tone: "info",
  },
  demo_inventory_ready: {
    title: "Demo setup loaded",
    description: "The sample inventory now highlights obvious upgrade gaps for the pitch.",
    tone: "success",
  },
  scan_inventory_saved: {
    title: "Scan items saved",
    description: "Approved scan estimates were added to inventory and can now affect recommendation scoring.",
    tone: "success",
  },
  recommendations_ready: {
    title: "Recommendations refreshed",
    description: "The dashboard has been rebuilt from the current profile and inventory.",
    tone: "success",
  },
  price_refresh_completed: {
    title: "Price refresh finished",
    description: "Availability and price data were refreshed through the normal quota checks.",
    tone: "success",
  },
  price_refresh_low_quota: {
    title: "Refresh finished with low quota",
    description: "The refresh ran, but fewer than 10 daily calls remain and some prices may stay cached soon.",
    tone: "info",
  },
  price_refresh_quota_blocked: {
    title: "Refresh paused by quota",
    description: "No minute, daily, or monthly PricesAPI capacity was available, so LifeUpgrade kept cached prices.",
    tone: "info",
  },
  gemma_explanation_ready: {
    title: "Gemma explanation returned",
    description: "The test recommendation used Gemma narration. Deterministic scores and product facts stayed unchanged.",
    tone: "success",
  },
  gemma_explanation_fallback: {
    title: "Deterministic fallback used",
    description: "Gemma was missing, unavailable, or returned invalid JSON, so LifeUpgrade used deterministic explanation copy.",
    tone: "info",
  },
  product_saved: {
    title: "Saved to watchlist",
    description: "This model is marked so it stands out during the demo.",
    tone: "success",
  },
  product_unsaved: {
    title: "Removed from watchlist",
    description: "The model is no longer pinned in the recommendation flow.",
    tone: "info",
  },
  profile_deleted: {
    title: "Profile deleted",
    description: "The local profile and its associated data were removed.",
    tone: "info",
  },
  inventory_deleted: {
    title: "Inventory deleted",
    description: "The local inventory and generated recommendations were cleared.",
    tone: "info",
  },
  profile_required: {
    title: "Profile needed",
    description: "Create a local profile before adding inventory or generating recommendations.",
    tone: "info",
  },
} satisfies Record<
  string,
  {
    title: string;
    description: string;
    tone: ToastTone;
  }
>;

export type ToastId = keyof typeof toastRegistry;

export function buildToastHref(path: string, toast: ToastId, tone?: ToastTone): string {
  const url = new URL(path, "http://lifeupgrade.local");
  url.searchParams.set("toast", toast);

  if (tone) {
    url.searchParams.set("toastType", tone);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
