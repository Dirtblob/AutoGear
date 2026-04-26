"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUserContext } from "@/lib/currentUser";
import { DEVICE_CATEGORIES } from "@/lib/devices/deviceTypes";
import { createManyDevInventoryItems } from "@/lib/inventory/mongoInventory";
import { buildToastHref } from "@/lib/ui/toasts";

const allowedCategories = new Set([...DEVICE_CATEGORIES, "storage", "cable_management", "other", "unknown"]);

interface ScanReviewPayloadItem {
  approved: boolean;
  category: string;
  brand: string;
  model: string;
  confidence: number;
  estimatedCount: number;
  sourceLabels: string[];
}

function getPayload(formData: FormData): ScanReviewPayloadItem[] {
  const rawPayload = formData.get("payload");
  if (typeof rawPayload !== "string" || rawPayload.trim().length === 0) return [];

  try {
    const parsed = JSON.parse(rawPayload) as unknown;
    return Array.isArray(parsed) ? (parsed as ScanReviewPayloadItem[]) : [];
  } catch {
    return [];
  }
}

function normalizeCategory(category: string): string {
  const normalized = category.trim().toLowerCase().replaceAll("-", "_");
  return allowedCategories.has(normalized) ? normalized : "other";
}

function buildScanNote(item: ScanReviewPayloadItem): string {
  const confidence = Math.round(Math.max(0, Math.min(1, item.confidence)) * 100);
  const labels = item.sourceLabels.filter(Boolean).join(", ");
  const countText = item.estimatedCount > 1 ? `Count estimate: ${item.estimatedCount}. ` : "";
  const labelText = labels.length > 0 ? `Detected labels: ${labels}. ` : "";

  return `Estimated from a local browser video scan after user review. ${countText}${labelText}Confidence estimate: ${confidence}%.`;
}

export async function saveScanInventoryAction(formData: FormData): Promise<void> {
  const context = await getCurrentUserContext();
  if (!context) {
    redirect(buildToastHref("/onboarding", "profile_required"));
  }

  const approvedItems = getPayload(formData)
    .filter((item) => item && item.approved)
    .map((item) => ({
      category: normalizeCategory(item.category),
      brand: item.brand.trim() || "Unknown",
      model: item.model.trim() || item.category.trim() || "Detected item",
      exactModel: null,
      catalogProductId: null,
      specsJson: null,
      condition: "UNKNOWN" as const,
      ageYears: null,
      notes: buildScanNote(item),
      source: "PHOTO" as const,
    }))
    .filter((item) => item.model || item.brand);

  if (approvedItems.length === 0) {
    redirect(buildToastHref("/scan", "scan_inventory_saved", "info"));
  }

  await createManyDevInventoryItems(approvedItems);

  revalidatePath("/scan");
  revalidatePath("/inventory");
  revalidatePath("/recommendations");
  redirect(buildToastHref("/inventory", "scan_inventory_saved"));
}
