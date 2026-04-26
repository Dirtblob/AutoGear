import { NextResponse } from "next/server";
import { ensureCurrentUserProfile } from "@/lib/currentUser";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ unreadCount: 0, configured: false });
  }

  try {
    const profile = await ensureCurrentUserProfile();
    const unreadCount = await db.watchlistAlert.count({
      where: {
        userProfileId: profile.id,
        seen: false,
      },
    });

    return NextResponse.json({ unreadCount, configured: true });
  } catch (error) {
    console.warn("Failed to load unread alert count.", error);
    return NextResponse.json({ unreadCount: 0, configured: false });
  }
}
