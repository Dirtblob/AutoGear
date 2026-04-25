function InventorySkeletonCard() {
  return <div className="h-72 rounded-[1.75rem] bg-white/75 shadow-panel" />;
}

export default function InventoryLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid gap-5 xl:grid-cols-[1.14fr_0.86fr]">
        <div className="h-80 rounded-[2rem] bg-white/75 shadow-panel" />
        <div className="h-80 rounded-[2rem] bg-white/75 shadow-panel" />
      </div>
      <div className="h-[30rem] rounded-[2rem] bg-white/75 shadow-panel" />
      <div className="grid gap-5 xl:grid-cols-2">
        <InventorySkeletonCard />
        <InventorySkeletonCard />
      </div>
    </div>
  );
}
