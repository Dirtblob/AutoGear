import type { DeviceTraitRatings } from "@/lib/devices/deviceTypes";
import { humanizeTrait, isBadDirectionTrait } from "@/lib/devices/deviceTraits";

const defaultTraits = [
  "productivity",
  "comfort",
  "ergonomics",
  "value",
  "compatibility",
  "confidence",
] as const;

function fillClass(value: number): string {
  if (value >= 80) return "bg-moss";
  if (value >= 60) return "bg-gold";
  return "bg-clay";
}

export function DeviceTraitBars({
  ratings,
  traits = defaultTraits,
  compact = false,
}: {
  ratings: DeviceTraitRatings;
  traits?: readonly string[];
  compact?: boolean;
}) {
  const visibleTraits = traits.filter((trait) => typeof ratings[trait] === "number");

  if (visibleTraits.length === 0) return null;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {visibleTraits.map((trait) => {
        const value = Math.max(0, Math.min(100, Math.round(ratings[trait])));
        const label = isBadDirectionTrait(trait) ? `${humanizeTrait(trait)} cost` : humanizeTrait(trait);

        return (
          <div key={trait} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-xs font-medium text-ink/58">
              <span>{label}</span>
              <span className="font-semibold text-ink/72">{value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink/8">
              <div className={`h-full rounded-full ${fillClass(value)}`} style={{ width: `${Math.max(6, value)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
