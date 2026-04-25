"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-[2rem] border border-clay/20 bg-white/90 p-8 shadow-panel backdrop-blur">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-clay">Error state</p>
      <h1 className="mt-3 font-display text-3xl font-semibold text-ink">Something interrupted the demo flow.</h1>
      <p className="mt-4 max-w-2xl leading-7 text-ink/68">
        The app hit an unexpected error while building the page. You can retry the route without losing the overall
        session.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-moss"
        >
          Try again
        </button>
        <p className="rounded-full border border-ink/10 px-4 py-3 text-sm text-ink/58">
          {error.digest ? `Error digest: ${error.digest}` : "No digest provided"}
        </p>
      </div>
    </div>
  );
}
