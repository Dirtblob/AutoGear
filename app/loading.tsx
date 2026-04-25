export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-80 rounded-[2rem] bg-white/70 shadow-panel" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-72 rounded-[1.75rem] bg-white/70 shadow-panel" />
        <div className="h-72 rounded-[1.75rem] bg-white/70 shadow-panel" />
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <div className="h-56 rounded-[1.75rem] bg-white/70 shadow-panel" />
        <div className="h-56 rounded-[1.75rem] bg-white/70 shadow-panel" />
        <div className="h-56 rounded-[1.75rem] bg-white/70 shadow-panel" />
      </div>
    </div>
  );
}
