import type { DeviceTraitRatings } from "@/lib/devices/deviceTypes";
import { humanizeTrait, isBadDirectionTrait } from "@/lib/devices/deviceTraits";

type TraitScale = 10 | 100;

const defaultTraits = [
  "productivity",
  "comfort",
  "ergonomics",
  "value",
  "compatibility",
  "confidence",
] as const;

const PRECOMPUTED_TRAITS_ON_TEN_SCALE = new Set([
  "productivity",
  "comfort",
  "ergonomics",
  "value",
  "gaming",
  "portability",
  "buildQuality",
  "noise",
  "quietness",
  "speed",
  "accessibility",
]);

const SCORES_ON_HUNDRED_SCALE = new Set([
  "compatibility",
  "confidence",
  "precision",
  "finalRecommendationScore",
  "fitScore",
  "traitDeltaScore",
  "budgetScore",
]);

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// Imported device intelligence comes from precomputedTraits, which store ratings on a 0-10 scale.
// Recommendation and scoring breakdown values are already 0-100 and should be rendered as-is.
function getTraitScale(trait: string): TraitScale {
  if (SCORES_ON_HUNDRED_SCALE.has(trait)) return 100;
  if (PRECOMPUTED_TRAITS_ON_TEN_SCALE.has(trait)) return 10;
  return 10;
}

export function getBarPercent(value: number, scale: TraitScale): number {
  return clampPercent(scale === 10 ? value * 10 : value);
}

function formatDisplayValue(value: number, scale: TraitScale): string {
  if (scale === 10) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
  }

  return String(clampPercent(value));
}

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
        const rawValue = ratings[trait];
        const scale = getTraitScale(trait);
        const barPercent = getBarPercent(rawValue, scale);
        const label = isBadDirectionTrait(trait) ? `${humanizeTrait(trait)} cost` : humanizeTrait(trait);

        return (
          <div key={trait} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-xs font-medium text-ink/58">
              <span>{label}</span>
              <span className="font-semibold text-ink/72">{formatDisplayValue(rawValue, scale)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink/8">
              <div
                className={`h-full rounded-full ${fillClass(barPercent)}`}
                style={{ width: `${Math.max(6, barPercent)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
