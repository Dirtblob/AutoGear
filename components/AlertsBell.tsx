import Link from "next/link";
import { db } from "@/lib/db";
import { ensureCurrentUserProfile } from "@/lib/currentUser";

export async function AlertsBell() {
  const profile = await ensureCurrentUserProfile();
  const unreadCount = await db.watchlistAlert.count({
    where: {
      userProfileId: profile.id,
      seen: false,
    },
  });

  return (
    <Link
      href="/alerts"
      className="relative inline-flex size-11 items-center justify-center rounded-full border border-white/70 bg-white/85 text-ink shadow-[0_8px_30px_rgba(23,33,31,0.08)] transition hover:border-moss/30 hover:text-moss"
      aria-label={unreadCount > 0 ? `${unreadCount} unread alerts` : "Alerts"}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth="1.8">
        <path d="M12 4a4 4 0 0 0-4 4v2.1c0 .8-.27 1.57-.77 2.16L5.5 14.2a1 1 0 0 0 .77 1.65h11.46a1 1 0 0 0 .77-1.65l-1.73-1.94a3.34 3.34 0 0 1-.77-2.16V8a4 4 0 0 0-4-4Z" />
        <path d="M10 18a2 2 0 0 0 4 0" />
      </svg>
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 min-w-6 rounded-full bg-clay px-1.5 py-1 text-center text-[11px] font-bold leading-none text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
