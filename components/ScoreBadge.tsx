function bandForScore(score: number): string {
  if (score >= 82) return "Elite";
  if (score >= 66) return "Strong";
  return "Consider";
}

function colorForScore(score: number): string {
  if (score >= 82) return "#2dd4bf";
  if (score >= 66) return "#fbbf24";
  return "#fb7185";
}

export function ScoreBadge({
  score,
  size = "md",
}: {
  score: number;
  size?: "sm" | "md" | "lg";
}) {
  const ringColor = colorForScore(score);
  const dimensions = size === "sm" ? "size-16" : size === "lg" ? "size-24" : "size-20";
  const inner = size === "sm" ? "size-[3.15rem]" : size === "lg" ? "size-[4.75rem]" : "size-[4rem]";
  const scoreText = size === "sm" ? "text-xl" : size === "lg" ? "text-3xl" : "text-2xl";

  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full p-[0.35rem] shadow-[0_20px_44px_rgba(8,47,73,0.5)] ${dimensions}`}
      style={{
        background: `conic-gradient(${ringColor} ${Math.max(10, score)}%, rgba(148,163,184,0.25) 0)`,
      }}
    >
      <div className={`grid place-items-center rounded-full border border-white/10 bg-slate-950 text-center shadow-inner ${inner}`}>
        <div>
          <p className={`font-display font-bold leading-none text-slate-100 ${scoreText}`}>{score}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Score</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: ringColor }}>
            {bandForScore(score)}
          </p>
        </div>
      </div>
    </div>
  );
}
