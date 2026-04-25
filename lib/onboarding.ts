import type { UserProblem } from "@/lib/recommendation/types";

export const onboardingSteps = [
  {
    title: "Basic profile",
    description: "Work, budget, and purchase style.",
  },
  {
    title: "Problems",
    description: "What is creating friction right now.",
  },
  {
    title: "Preferences",
    description: "How products should feel and behave.",
  },
  {
    title: "Room constraints",
    description: "Space, ports, and operating system fit.",
  },
  {
    title: "Review and save",
    description: "Sanity-check everything before we create the profile.",
  },
] as const;

export const ageRangeOptions = [
  "13-17",
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65+",
] as const;

export const spendingStyleOptions = [
  {
    value: "frugal",
    label: "Frugal",
    description: "Stretch every dollar and prioritize essentials.",
  },
  {
    value: "value",
    label: "Value",
    description: "Balanced picks with strong practical payoff.",
  },
  {
    value: "premium",
    label: "Premium",
    description: "Pay more when the upgrade meaningfully helps.",
  },
] as const;

export const problemOptions: ReadonlyArray<{
  value: UserProblem;
  label: string;
  description: string;
}> = [
  { value: "eye_strain", label: "Eye strain", description: "Screens, glare, or lighting are tiring." },
  { value: "neck_pain", label: "Neck pain", description: "Posture or screen height is causing discomfort." },
  { value: "wrist_pain", label: "Wrist pain", description: "Input devices or typing position hurt." },
  { value: "back_pain", label: "Back pain", description: "Seating and posture need support." },
  { value: "slow_computer", label: "Slow computer", description: "Performance is blocking work." },
  { value: "low_productivity", label: "Low productivity", description: "The setup creates drag every day." },
  { value: "poor_focus", label: "Poor focus", description: "Distractions or friction break concentration." },
  { value: "noise_sensitivity", label: "Noise sensitivity", description: "Sound and interruptions matter a lot." },
  { value: "clutter", label: "Clutter", description: "The space feels messy or hard to manage." },
  { value: "bad_lighting", label: "Bad lighting", description: "Task lighting is weak or inconsistent." },
  { value: "limited_mobility", label: "Limited mobility", description: "Accessibility and reach matter." },
  { value: "small_space", label: "Small space", description: "The setup needs a compact footprint." },
  { value: "budget_limited", label: "Budget limited", description: "Affordability is a key constraint." },
] as const;

export const preferenceOptions = [
  {
    value: "quiet products",
    label: "Quiet products",
    description: "Lower-noise gear is a better fit.",
  },
  {
    value: "minimalist design",
    label: "Minimalist design",
    description: "Simple visual design matters.",
  },
  {
    value: "portable",
    label: "Portable",
    description: "Easy to move or travel with.",
  },
  {
    value: "premium brands okay",
    label: "Premium brands okay",
    description: "Brand cachet is acceptable when justified.",
  },
  {
    value: "used/refurbished okay",
    label: "Used/refurbished okay",
    description: "Pre-owned deals are welcome.",
  },
  {
    value: "avoid subscriptions",
    label: "Avoid subscriptions",
    description: "One-time ownership is preferred.",
  },
] as const;

export const laptopPortOptions = [
  "USB-C",
  "Thunderbolt",
  "USB-A",
  "HDMI",
  "DisplayPort",
  "MagSafe",
  "3.5mm audio",
] as const;

export const operatingSystemOptions = [
  { value: "macos", label: "macOS" },
  { value: "windows", label: "Windows" },
  { value: "linux", label: "Linux" },
  { value: "chromeos", label: "ChromeOS" },
  { value: "other", label: "Other" },
] as const;

export type BudgetType = "monthly" | "one_time";
export type SpendingStyleValue = (typeof spendingStyleOptions)[number]["value"];
export type PreferenceValue = (typeof preferenceOptions)[number]["value"];
export type OperatingSystemValue = (typeof operatingSystemOptions)[number]["value"];

export interface OnboardingFormValues {
  profession: string;
  ageRange: string;
  budgetType: BudgetType;
  budgetAmount: string;
  spendingStyle: SpendingStyleValue;
  usedItemsOkay: boolean;
  problems: UserProblem[];
  preferences: PreferenceValue[];
  deskWidth: string;
  smallRoom: boolean;
  laptopPorts: string[];
  operatingSystem: OperatingSystemValue | "";
}

export type OnboardingFieldKey = keyof OnboardingFormValues;

export interface OnboardingActionResult {
  success: boolean;
  profileId?: string;
  errors?: Partial<Record<OnboardingFieldKey, string>>;
  error?: string;
}

export const defaultOnboardingValues: OnboardingFormValues = {
  profession: "",
  ageRange: "",
  budgetType: "one_time",
  budgetAmount: "",
  spendingStyle: "value",
  usedItemsOkay: true,
  problems: [],
  preferences: [],
  deskWidth: "",
  smallRoom: false,
  laptopPorts: [],
  operatingSystem: "",
};

export const demoOnboardingValues: OnboardingFormValues = {
  profession: "Computer science student",
  ageRange: "18-24",
  budgetType: "one_time",
  budgetAmount: "300",
  spendingStyle: "value",
  usedItemsOkay: true,
  problems: ["neck_pain", "eye_strain"],
  preferences: ["portable", "used/refurbished okay", "avoid subscriptions"],
  deskWidth: "32",
  smallRoom: true,
  laptopPorts: ["USB-C", "3.5mm audio"],
  operatingSystem: "macos",
};

export const stepFieldGroups: ReadonlyArray<ReadonlyArray<OnboardingFieldKey>> = [
  ["profession", "ageRange", "budgetAmount"],
  [],
  [],
  ["deskWidth", "operatingSystem"],
  [],
];

export function validateOnboardingValues(
  values: OnboardingFormValues,
): Partial<Record<OnboardingFieldKey, string>> {
  const errors: Partial<Record<OnboardingFieldKey, string>> = {};

  if (!values.profession.trim()) {
    errors.profession = "Add a profession so we can personalize recommendations.";
  }

  if (!values.ageRange) {
    errors.ageRange = "Choose an age range.";
  }

  const budgetAmount = Number(values.budgetAmount);
  if (!values.budgetAmount.trim() || Number.isNaN(budgetAmount) || budgetAmount <= 0) {
    errors.budgetAmount = "Enter a budget above $0.";
  }

  const deskWidth = Number(values.deskWidth);
  if (!values.deskWidth.trim() || Number.isNaN(deskWidth) || deskWidth < 18 || deskWidth > 120) {
    errors.deskWidth = "Enter desk width in inches, usually between 18 and 120.";
  }

  if (!values.operatingSystem) {
    errors.operatingSystem = "Choose the main operating system.";
  }

  return errors;
}

export function getProblemLabel(problem: UserProblem): string {
  return problemOptions.find((option) => option.value === problem)?.label ?? formatTokenLabel(problem);
}

export function getPreferenceLabel(preference: PreferenceValue): string {
  return preferenceOptions.find((option) => option.value === preference)?.label ?? preference;
}

export function getOperatingSystemLabel(operatingSystem: string): string {
  return operatingSystemOptions.find((option) => option.value === operatingSystem)?.label ?? operatingSystem;
}

export function formatBudgetTypeLabel(budgetType: BudgetType): string {
  return budgetType === "monthly" ? "Monthly budget" : "One-time budget";
}

export function buildRoomConstraints(values: OnboardingFormValues) {
  const deskWidthInches = Number(values.deskWidth);
  const roomConstraintTags = Array.from(
    new Set(
      [
        values.smallRoom ? "small_space" : null,
        deskWidthInches <= 36 ? "limited_desk_width" : null,
        values.preferences.includes("portable") ? "portable_setup" : null,
        values.preferences.includes("quiet products") || values.problems.includes("noise_sensitivity")
          ? "needs_quiet"
          : null,
        values.problems.includes("limited_mobility") ? "limited_mobility" : null,
      ].filter((tag): tag is string => Boolean(tag)),
    ),
  );

  return {
    deskWidthInches,
    smallRoom: values.smallRoom,
    laptopPorts: values.laptopPorts,
    operatingSystem: values.operatingSystem,
    budgetType: values.budgetType,
    roomLighting: "mixed" as const,
    sharesSpace: false,
    portableSetup: values.preferences.includes("portable"),
    roomConstraintTags,
  };
}

function formatTokenLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
