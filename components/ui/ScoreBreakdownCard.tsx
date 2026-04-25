import type { ScoreBreakdown } from "@/lib/recommendation/types";

const breakdownLabels: Array<{ key: keyof ScoreBreakdown; label: string }> = [
  { key: "problemFit", label: "Problem fit" },
  { key: "traitDeltaFit", label: "Trait delta" },
  { key: "constraintFit", label: "Constraint fit" },
  { key: "valueFit", label: "Value fit" },
  { key: "compatibilityFit", label: "Compatibility fit" },
  { key: "availabilityFit", label: "Availability fit" },
  { key: "confidence", label: "Confidence" },
];

function fillClass(value: number): string {
  if (value >= 80) return "bg-[linear-gradient(90deg,#42685a,#6f9c8b)]";
  if (value >= 60) return "bg-[linear-gradient(90deg,#e0ab45,#f0cd7a)]";
  return "bg-[linear-gradient(90deg,#b76d4f,#d79376)]";
}

export function ScoreBreakdownCard({
  breakdown,
  tone = "light",
}: {
  breakdown: ScoreBreakdown;
  tone?: "light" | "dark";
}) {
  return (
    <div className={`rounded-[1.4rem] p-4 ${tone === "dark" ? "bg-white/8 backdrop-blur" : "bg-white"}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${tone === "dark" ? "text-white/55" : "text-ink/45"}`}>
          Score breakdown
        </p>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
            tone === "dark" ? "bg-white/10 text-white/80" : "bg-mist text-ink/60"
          }`}
        >
          Transparent scoring
        </span>
      </div>

      <div className="space-y-3">
        {breakdownLabels.map(({ key, label }) => (
          <div key={key} className="space-y-2">
            <div className={`flex items-center justify-between gap-3 text-sm ${tone === "dark" ? "text-white/75" : "text-ink/60"}`}>
              <span>{label}</span>
              <span className={`font-semibold ${tone === "dark" ? "text-white" : "text-ink"}`}>{breakdown[key]}</span>
            </div>
            <div className={`h-2.5 overflow-hidden rounded-full ${tone === "dark" ? "bg-white/10" : "bg-mist"}`}>
              <div
                className={`h-full rounded-full ${fillClass(breakdown[key])}`}
                style={{ width: `${Math.max(8, Math.min(100, breakdown[key]))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
