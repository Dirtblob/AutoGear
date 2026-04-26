"use client";

import { useEffect, useMemo, useState } from "react";

type AgeRange = "under_18" | "18_24" | "25_34" | "35_44" | "45_54" | "55_plus" | "prefer_not_to_say";
type DominantHand = "left" | "right" | "ambidextrous";
type GripStyle = "palm" | "claw" | "fingertip" | "unknown";

type BooleanMap = Record<string, boolean>;

interface ProfileFormState {
  ageRange: AgeRange | "";
  profession: string;
  primaryUseCases: string;
  heightCm: string;
  handLengthMm: string;
  palmWidthMm: string;
  dominantHand: DominantHand | "";
  gripStyle: GripStyle | "";
  comfortPriorities: {
    lowNoise: boolean;
    lightweight: boolean;
    ergonomic: boolean;
    portability: boolean;
    largeDisplay: boolean;
    compactSize: boolean;
  };
  sensitivity: {
    wristStrain: boolean;
    fingerFatigue: boolean;
    hearingSensitive: boolean;
    eyeStrain: boolean;
  };
  budgetMin: string;
  budgetMax: string;
  budgetCurrency: string;
  allowProfileForRecommendations: boolean;
  allowRecommendationHistory: boolean;
}

interface ProfileApiPayload {
  profile?: {
    ageRange?: AgeRange;
    profession?: string;
    primaryUseCases?: string[];
    heightCm?: number;
    handLengthMm?: number;
    palmWidthMm?: number;
    dominantHand?: DominantHand;
    gripStyle?: GripStyle;
    comfortPriorities?: ProfileFormState["comfortPriorities"];
    sensitivity?: ProfileFormState["sensitivity"];
    budget?: {
      min: number;
      max: number;
      currency: string;
    };
    privacy?: {
      allowProfileForRecommendations: boolean;
      allowRecommendationHistory: boolean;
    };
  };
}

const ageRangeOptions: Array<{ value: AgeRange; label: string }> = [
  { value: "under_18", label: "Under 18" },
  { value: "18_24", label: "18-24" },
  { value: "25_34", label: "25-34" },
  { value: "35_44", label: "35-44" },
  { value: "45_54", label: "45-54" },
  { value: "55_plus", label: "55+" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const dominantHandOptions: Array<{ value: DominantHand; label: string }> = [
  { value: "right", label: "Right" },
  { value: "left", label: "Left" },
  { value: "ambidextrous", label: "Ambidextrous" },
];

const gripStyleOptions: Array<{ value: GripStyle; label: string }> = [
  { value: "palm", label: "Palm" },
  { value: "claw", label: "Claw" },
  { value: "fingertip", label: "Fingertip" },
  { value: "unknown", label: "Unknown" },
];

const comfortOptions: Array<{ key: keyof ProfileFormState["comfortPriorities"]; label: string }> = [
  { key: "lowNoise", label: "Low noise" },
  { key: "lightweight", label: "Lightweight" },
  { key: "ergonomic", label: "Ergonomic" },
  { key: "portability", label: "Portability" },
  { key: "largeDisplay", label: "Large display" },
  { key: "compactSize", label: "Compact size" },
];

const sensitivityOptions: Array<{ key: keyof ProfileFormState["sensitivity"]; label: string }> = [
  { key: "wristStrain", label: "Wrist strain" },
  { key: "fingerFatigue", label: "Finger fatigue" },
  { key: "hearingSensitive", label: "Hearing sensitive" },
  { key: "eyeStrain", label: "Eye strain" },
];

const emptyFormState: ProfileFormState = {
  ageRange: "",
  profession: "",
  primaryUseCases: "",
  heightCm: "",
  handLengthMm: "",
  palmWidthMm: "",
  dominantHand: "",
  gripStyle: "",
  comfortPriorities: {
    lowNoise: false,
    lightweight: false,
    ergonomic: false,
    portability: false,
    largeDisplay: false,
    compactSize: false,
  },
  sensitivity: {
    wristStrain: false,
    fingerFatigue: false,
    hearingSensitive: false,
    eyeStrain: false,
  },
  budgetMin: "",
  budgetMax: "",
  budgetCurrency: "USD",
  allowProfileForRecommendations: true,
  allowRecommendationHistory: true,
};

function profileToFormState(payload: ProfileApiPayload): ProfileFormState {
  const profile = payload.profile;

  return {
    ...emptyFormState,
    ageRange: profile?.ageRange ?? "",
    profession: profile?.profession ?? "",
    primaryUseCases: profile?.primaryUseCases?.join(", ") ?? "",
    heightCm: profile?.heightCm?.toString() ?? "",
    handLengthMm: profile?.handLengthMm?.toString() ?? "",
    palmWidthMm: profile?.palmWidthMm?.toString() ?? "",
    dominantHand: profile?.dominantHand ?? "",
    gripStyle: profile?.gripStyle ?? "",
    comfortPriorities: {
      ...emptyFormState.comfortPriorities,
      ...profile?.comfortPriorities,
    },
    sensitivity: {
      ...emptyFormState.sensitivity,
      ...profile?.sensitivity,
    },
    budgetMin: profile?.budget?.min.toString() ?? "",
    budgetMax: profile?.budget?.max.toString() ?? "",
    budgetCurrency: profile?.budget?.currency ?? "USD",
    allowProfileForRecommendations: profile?.privacy?.allowProfileForRecommendations ?? true,
    allowRecommendationHistory: profile?.privacy?.allowRecommendationHistory ?? true,
  };
}

function optionalNumber(value: string): number | string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : trimmed;
}

function splitUseCases(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildProfilePatch(form: ProfileFormState) {
  const budgetMin = optionalNumber(form.budgetMin);
  const budgetMax = optionalNumber(form.budgetMax);
  const budget =
    budgetMin !== undefined || budgetMax !== undefined
      ? {
          min: budgetMin ?? 0,
          max: budgetMax ?? budgetMin ?? 0,
          currency: form.budgetCurrency.trim().toUpperCase() || "USD",
        }
      : undefined;

  return {
    ageRange: form.ageRange || undefined,
    profession: form.profession.trim() || undefined,
    primaryUseCases: splitUseCases(form.primaryUseCases),
    heightCm: optionalNumber(form.heightCm),
    handLengthMm: optionalNumber(form.handLengthMm),
    palmWidthMm: optionalNumber(form.palmWidthMm),
    dominantHand: form.dominantHand || undefined,
    gripStyle: form.gripStyle || undefined,
    comfortPriorities: form.comfortPriorities,
    sensitivity: form.sensitivity,
    budget,
    privacy: {
      allowProfileForRecommendations: form.allowProfileForRecommendations,
      allowRecommendationHistory: form.allowRecommendationHistory,
    },
  };
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm font-semibold text-ink/75">
      <input
        checked={checked}
        className="size-4 accent-moss"
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function updateBooleanMap<T extends BooleanMap>(map: T, key: keyof T, value: boolean): T {
  return { ...map, [key]: value };
}

export function ProfileSettingsForm() {
  const [form, setForm] = useState<ProfileFormState>(emptyFormState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const selectedComfortCount = useMemo(
    () => Object.values(form.comfortPriorities).filter(Boolean).length,
    [form.comfortPriorities],
  );

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/profile", { cache: "no-store" });
        const payload = (await response.json()) as ProfileApiPayload & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error || "Could not load profile.");
        }

        if (active) {
          setForm(profileToFormState(payload));
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load profile.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildProfilePatch(form)),
      });
      const payload = (await response.json()) as ProfileApiPayload & {
        error?: string;
        fields?: Record<string, string>;
      };

      if (!response.ok) {
        const fieldErrors = payload.fields ? Object.values(payload.fields).join(" ") : "";
        throw new Error([payload.error, fieldErrors].filter(Boolean).join(" ") || "Could not save profile.");
      }

      setForm(profileToFormState(payload));
      setSuccess("Private profile saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <section className="rounded-2xl bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-moss">Private profile</p>
            <h1 className="mt-3 text-3xl font-semibold">Fit and preference settings.</h1>
            <p className="mt-3 max-w-2xl leading-7 text-ink/65">
              Measurements are optional, but they improve fit recommendations for mice, keyboards, chairs, displays, and
              portable setups.
            </p>
          </div>
          <button
            className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-moss disabled:cursor-not-allowed disabled:bg-ink/40"
            disabled={loading || saving}
            type="submit"
          >
            {saving ? "Saving..." : "Save profile"}
          </button>
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl bg-mist p-4 text-sm font-medium text-ink/65">Loading private profile...</div>
        ) : null}
        {success ? (
          <div className="mt-6 rounded-2xl border border-moss/20 bg-[#f3f8f4] p-4 text-sm font-semibold text-moss">
            {success}
          </div>
        ) : null}
        {error ? (
          <div className="mt-6 rounded-2xl border border-clay/20 bg-clay/10 p-4 text-sm font-semibold text-clay">
            {error}
          </div>
        ) : null}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold">Profile details</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <FieldLabel label="Age range">
              <select
                className="rounded-2xl border border-ink/10 bg-mist px-4 py-3 text-sm font-medium outline-none focus:border-moss"
                disabled={loading}
                value={form.ageRange}
                onChange={(event) => setForm((current) => ({ ...current, ageRange: event.target.value as AgeRange | "" }))}
              >
                <option value="">Not set</option>
                {ageRangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FieldLabel>

            <FieldLabel label="Profession">
              <input
                className="rounded-2xl border border-ink/10 bg-mist px-4 py-3 text-sm font-medium outline-none focus:border-moss"
                disabled={loading}
                maxLength={160}
                value={form.profession}
                onChange={(event) => setForm((current) => ({ ...current, profession: event.target.value }))}
              />
            </FieldLabel>

            <div className="md:col-span-2">
              <FieldLabel label="Primary use cases">
                <input
                  className="rounded-2xl border border-ink/10 bg-mist px-4 py-3 text-sm font-medium outline-none focus:border-moss"
                  disabled={loading}
                  placeholder="Coding, design, gaming, travel"
                  value={form.primaryUseCases}
                  onChange={(event) => setForm((current) => ({ ...current, primaryUseCases: event.target.value }))}
                />
              </FieldLabel>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Privacy</h2>
              <p className="mt-2 text-sm leading-6 text-ink/60">Choose how this private profile participates in scoring.</p>
            </div>
            <span className="rounded-full bg-mist px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">
              Private
            </span>
          </div>
          <div className="mt-5 grid gap-3">
            <Toggle
              checked={form.allowProfileForRecommendations}
              label="Use profile data for recommendations"
              onChange={(checked) => setForm((current) => ({ ...current, allowProfileForRecommendations: checked }))}
            />
            <Toggle
              checked={form.allowRecommendationHistory}
              label="Save recommendation history"
              onChange={(checked) => setForm((current) => ({ ...current, allowRecommendationHistory: checked }))}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold">Measurements</h2>
          <p className="mt-2 text-sm leading-6 text-ink/60">Leave any measurement blank if you are not sure.</p>
          <div className="mt-5 grid gap-4">
            <FieldLabel label="Height in cm">
              <input
                className="rounded-2xl border border-ink/10 bg-mist px-4 py-3 text-sm font-medium outline-none focus:border-moss"
                disabled={loading}
                inputMode="decimal"
                max="250"
                min="80"
                type="number"
                value={form.heightCm}
                onChange={(event) => setForm((current) => ({ ...current, heightCm: event.target.value }))}
              />
            </FieldLabel>
            <FieldLabel label="Hand length in mm">
              <input
                className="rounded-2xl border border-ink/10 bg-mist px-4 py-3 text-sm font-medium outline-none focus:border-moss"
                disabled={loading}
                inputMode="decimal"
                max="260"
                min="80"
                type="number"
                value={form.handLengthMm}
                onChange={(event) => setForm((current) => ({ ...current, handLengthMm: event.target.value }))}
              />
            </FieldLabel>
            <FieldLabel label="Palm width in mm">
              <input
                className="rounded-2xl border border-ink/10 bg-mist px-4 py-3 text-sm font-medium outline-none focus:border-moss"
                disabled={loading}
                inputMode="decimal"
                max="150"
                min="50"
                type="number"
                value={form.palmWidthMm}
                onChange={(event) => setForm((current) => ({ ...current, palmWidthMm: event.target.value }))}
              />
            </FieldLabel>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold">Hand fit</h2>
          <div className="mt-5 grid gap-4">
            <FieldLabel label="Dominant hand">
              <select
                className="rounded-2xl border border-ink/10 bg-mist px-4 py-3 text-sm font-medium outline-none focus:border-moss"
                disabled={loading}
                value={form.dominantHand}
                onChange={(event) =>
                  setForm((current) => ({ ...current, dominantHand: event.target.value as DominantHand | "" }))
                }
              >
                <option value="">Not set</option>
                {dominantHandOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Grip style">
              <select
                className="rounded-2xl border border-ink/10 bg-mist px-4 py-3 text-sm font-medium outline-none focus:border-moss"
                disabled={loading}
                value={form.gripStyle}
                onChange={(event) => setForm((current) => ({ ...current, gripStyle: event.target.value as GripStyle | "" }))}
              >
                <option value="">Not set</option>
                {gripStyleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FieldLabel>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold">Budget range</h2>
          <div className="mt-5 grid gap-4">
            <FieldLabel label="Minimum">
              <input
                className="rounded-2xl border border-ink/10 bg-mist px-4 py-3 text-sm font-medium outline-none focus:border-moss"
                disabled={loading}
                inputMode="decimal"
                min="0"
                type="number"
                value={form.budgetMin}
                onChange={(event) => setForm((current) => ({ ...current, budgetMin: event.target.value }))}
              />
            </FieldLabel>
            <FieldLabel label="Maximum">
              <input
                className="rounded-2xl border border-ink/10 bg-mist px-4 py-3 text-sm font-medium outline-none focus:border-moss"
                disabled={loading}
                inputMode="decimal"
                min="0"
                type="number"
                value={form.budgetMax}
                onChange={(event) => setForm((current) => ({ ...current, budgetMax: event.target.value }))}
              />
            </FieldLabel>
            <FieldLabel label="Currency">
              <input
                className="rounded-2xl border border-ink/10 bg-mist px-4 py-3 text-sm font-medium uppercase outline-none focus:border-moss"
                disabled={loading}
                maxLength={3}
                value={form.budgetCurrency}
                onChange={(event) => setForm((current) => ({ ...current, budgetCurrency: event.target.value }))}
              />
            </FieldLabel>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Comfort priorities</h2>
            <span className="rounded-full bg-mist px-3 py-2 text-xs font-semibold text-ink/55">
              {selectedComfortCount} selected
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {comfortOptions.map((option) => (
              <Toggle
                key={option.key}
                checked={form.comfortPriorities[option.key]}
                label={option.label}
                onChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    comfortPriorities: updateBooleanMap(current.comfortPriorities, option.key, checked),
                  }))
                }
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold">Sensitivity options</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {sensitivityOptions.map((option) => (
              <Toggle
                key={option.key}
                checked={form.sensitivity[option.key]}
                label={option.label}
                onChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    sensitivity: updateBooleanMap(current.sensitivity, option.key, checked),
                  }))
                }
              />
            ))}
          </div>
        </div>
      </section>
    </form>
  );
}
