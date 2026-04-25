function bandForScore(score: number): string {
  if (score >= 82) return "Elite";
  if (score >= 66) return "Strong";
  return "Consider";
}

function colorForScore(score: number): string {
  if (score >= 82) return "#42685a";
  if (score >= 66) return "#e0ab45";
  return "#b76d4f";
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
      className={`grid shrink-0 place-items-center rounded-full p-[0.35rem] shadow-[0_16px_40px_rgba(23,33,31,0.16)] ${dimensions}`}
      style={{
        background: `conic-gradient(${ringColor} ${Math.max(10, score)}%, rgba(255,255,255,0.18) 0)`,
      }}
    >
      <div className={`grid place-items-center rounded-full bg-white text-center shadow-inner ${inner}`}>
        <div>
          <p className={`font-display font-bold leading-none text-ink ${scoreText}`}>{score}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/45">Score</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: ringColor }}>
            {bandForScore(score)}
          </p>
        </div>
      </div>
    </div>
  );
}
