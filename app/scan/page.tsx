import Link from "next/link";
import { VideoScanner } from "@/components/VideoScanner";
import { getCurrentUserContext } from "@/lib/currentUser";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const context = await getCurrentUserContext();

  if (!context) {
    return (
      <div className="rounded-[2rem] border border-dashed border-ink/15 bg-white/85 p-10 text-center shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-clay">Video scan</p>
        <h1 className="mt-3 font-display text-3xl font-semibold">Create a profile before scanning the setup.</h1>
        <p className="mx-auto mt-4 max-w-2xl leading-7 text-ink/65">
          The scan flow saves approved inventory items into the active local profile, so onboarding needs to exist
          first.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/onboarding" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">
            Complete onboarding
          </Link>
          <Link href="/inventory" className="rounded-full border border-ink/10 px-5 py-3 text-sm font-semibold text-ink">
            Open inventory
          </Link>
        </div>
      </div>
    );
  }

  return <VideoScanner />;
}
