"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { deleteDevInventoryItems } from "@/lib/inventory/mongoInventory";
import { hackathonDemoProfile } from "@/lib/recommendation/demoMode";
import { buildToastHref } from "@/lib/ui/toasts";

function revalidateLocalProfileViews(): void {
  revalidatePath("/");
  revalidatePath("/onboarding");
  revalidatePath("/inventory");
  revalidatePath("/recommendations");
  revalidatePath("/settings");
}

export async function deleteLocalProfileAction(): Promise<void> {
  await Promise.all([
    deleteDevInventoryItems(),
    db.userProfile.deleteMany({
      where: { id: hackathonDemoProfile.id },
    }),
  ]);

  revalidateLocalProfileViews();
  redirect(buildToastHref("/onboarding", "profile_deleted"));
}

export async function deleteLocalInventoryAction(): Promise<void> {
  await Promise.all([
    deleteDevInventoryItems(),
    db.recommendation.deleteMany({
      where: { userProfileId: hackathonDemoProfile.id },
    }),
  ]);

  revalidateLocalProfileViews();
  redirect(buildToastHref("/settings", "inventory_deleted"));
}
