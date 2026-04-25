function RecommendationSkeleton() {
  return <div className="h-80 rounded-[1.75rem] bg-white/75 shadow-panel" />;
}

export default function RecommendationsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="h-96 rounded-[2rem] bg-white/75 shadow-panel" />
        <div className="h-96 rounded-[2rem] bg-white/75 shadow-panel" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <RecommendationSkeleton />
        <RecommendationSkeleton />
        <RecommendationSkeleton />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <RecommendationSkeleton />
        <RecommendationSkeleton />
      </div>
    </div>
  );
}
