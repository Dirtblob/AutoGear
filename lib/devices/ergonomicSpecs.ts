import type {
  DeviceClampForceLevel,
  DeviceDimensionsMm,
  DeviceErgonomicSpecs,
  DeviceNoiseIsolationLevel,
  DeviceSoundLevel,
  RawCatalogDevice,
} from "./deviceTypes";

const INCH_TO_MM = 25.4;
const POUND_TO_GRAMS = 453.59237;

function rawText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(rawText).join(" ");
  if (!value || typeof value !== "object") return "";
  return Object.entries(value as Record<string, unknown>)
    .map(([key, entry]) => `${key} ${rawText(entry) || String(entry)}`)
    .join(" ");
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const match = value.replace(",", "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "y", "included", "adjustable"].includes(normalized)) return true;
  if (["false", "no", "n", "none", "fixed"].includes(normalized)) return false;
  return undefined;
}

function parseStringArray(value: unknown): string[] | undefined {
  const items = Array.isArray(value)
    ? value.map(String)
    : typeof value === "string"
      ? value.split(/[,/]/)
      : [];
  const normalized = items.map((item) => item.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

function roundMm(value: number): number {
  return Math.round(value);
}

function gramsFromPounds(value: unknown): number | undefined {
  const pounds = parseNumber(value);
  return pounds === undefined ? undefined : Math.round(pounds * POUND_TO_GRAMS);
}

function mmFromInches(value: unknown): number | undefined {
  const inches = parseNumber(value);
  return inches === undefined ? undefined : roundMm(inches * INCH_TO_MM);
}

function compactObject<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === undefined || entry === null) return false;
      if (Array.isArray(entry)) return entry.length > 0;
      if (typeof entry === "object") return Object.keys(entry).length > 0;
      return true;
    }),
  ) as Partial<T>;
}

function dimensionsFromSpecs(specs: Record<string, unknown>): DeviceDimensionsMm | undefined {
  const dimensions = compactObject({
    length: mmFromInches(specs.lengthInches ?? specs.length ?? specs.depthInches ?? specs.depth),
    width: mmFromInches(specs.widthInches ?? specs.width),
    height: mmFromInches(specs.heightInches ?? specs.height),
  });

  return Object.keys(dimensions).length > 0 ? dimensions : undefined;
}

function soundLevelFromSpecs(value: unknown): DeviceSoundLevel | undefined {
  if (value === "silent" || value === "quiet" || value === "normal" || value === "loud") return value;
  const text = rawText(value).toLowerCase();
  if (/\bsilent\b/.test(text)) return "silent";
  if (/\bquiet\b/.test(text)) return "quiet";
  if (/\bloud|clicky\b/.test(text)) return "loud";
  if (/\bnormal|mechanical|membrane|scissor\b/.test(text)) return "normal";
  return undefined;
}

function levelValue<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function noiseIsolationLevel(specs: Record<string, unknown>): DeviceNoiseIsolationLevel | undefined {
  const explicit = levelValue(specs.noiseIsolationLevel, ["low", "medium", "high"] as const);
  if (explicit) return explicit;
  if (parseBoolean(specs.activeNoiseCanceling) === true) return "high";
  if (parseBoolean(specs.noiseIsolation) === true) return "medium";
  if (parseBoolean(specs.noiseIsolation) === false) return "low";
  return undefined;
}

function ergonomicKeyboardLayout(specs: Record<string, unknown>): boolean | undefined {
  const explicit = parseBoolean(specs.ergonomic);
  if (explicit !== undefined) return explicit;
  const text = rawText([specs.layout, specs.split, specs.tenting]).toLowerCase();
  if (/\bsplit|ergo|ergonomic|wave|alice|tenting\b/.test(text)) return true;
  return undefined;
}

function hasFitData(specs: DeviceErgonomicSpecs): boolean {
  return Object.keys(specs).some((key) => key !== "category");
}

export function buildErgonomicSpecs(input: Pick<RawCatalogDevice, "category" | "specs">): DeviceErgonomicSpecs | undefined {
  const specs = input.specs as Record<string, unknown>;
  const category = input.category;
  const dimensionsMm = dimensionsFromSpecs(specs);
  const weightGrams = gramsFromPounds(specs.weightPounds ?? specs.weightLb ?? specs.weight);
  const base: DeviceErgonomicSpecs = compactObject({
    category,
    weightGrams,
    dimensionsMm,
  }) as DeviceErgonomicSpecs;

  if (category === "mouse") {
    const mouse = compactObject({
      lengthMm: mmFromInches(specs.lengthInches ?? specs.length ?? specs.depthInches ?? specs.depth),
      widthMm: mmFromInches(specs.widthInches ?? specs.width),
      heightMm: mmFromInches(specs.heightInches ?? specs.height),
      weightGrams,
      recommendedGripStyles: parseStringArray(specs.recommendedGripStyles ?? specs.gripStyles),
      recommendedHandLengthMinMm: parseNumber(specs.recommendedHandLengthMinMm),
      recommendedHandLengthMaxMm: parseNumber(specs.recommendedHandLengthMaxMm),
      recommendedPalmWidthMinMm: parseNumber(specs.recommendedPalmWidthMinMm),
      recommendedPalmWidthMaxMm: parseNumber(specs.recommendedPalmWidthMaxMm),
    });
    if (Object.keys(mouse).length > 0) base.mouse = mouse;
  }

  if (category === "keyboard") {
    const keyboard = compactObject({
      layout: typeof specs.layout === "string" ? specs.layout : undefined,
      widthMm: mmFromInches(specs.widthInches ?? specs.width),
      depthMm: mmFromInches(specs.depthInches ?? specs.depth),
      heightMm: mmFromInches(specs.heightInches ?? specs.height),
      switchType: typeof specs.switchType === "string" ? specs.switchType : undefined,
      actuationForceG: parseNumber(specs.actuationForceG),
      soundLevel: soundLevelFromSpecs(specs.soundLevel ?? specs.noiseLevel),
      ergonomicLayout: ergonomicKeyboardLayout(specs),
    });
    if (Object.keys(keyboard).length > 0) base.keyboard = keyboard;
  }

  if (category === "headphones" || category === "earbuds") {
    const headphones = compactObject({
      weightGrams,
      clampForceLevel: levelValue<DeviceClampForceLevel>(specs.clampForceLevel, ["low", "medium", "high"] as const),
      earCupInnerHeightMm: parseNumber(specs.earCupInnerHeightMm),
      earCupInnerWidthMm: parseNumber(specs.earCupInnerWidthMm),
      noiseIsolationLevel: noiseIsolationLevel(specs),
    });
    if (Object.keys(headphones).length > 0) base.headphones = headphones;
  }

  if (category === "monitor") {
    const monitor = compactObject({
      screenSizeInches: parseNumber(specs.screenSizeInches ?? specs.sizeInches),
      resolution: typeof specs.resolution === "string" ? specs.resolution : undefined,
      refreshRateHz: parseNumber(specs.refreshRateHz ?? specs.refreshRate),
      curvatureR: parseNumber(specs.curvatureR),
      standHeightAdjustable: parseBoolean(specs.standHeightAdjustable ?? specs.heightAdjustable),
      vesaMount: parseBoolean(specs.vesaMount),
    });
    if (Object.keys(monitor).length > 0) base.monitor = monitor;
  }

  if (category === "laptop") {
    const laptop = compactObject({
      screenSizeInches: parseNumber(specs.screenSizeInches ?? specs.sizeInches),
      weightGrams,
      keyboardLayout: typeof specs.keyboardLayout === "string" ? specs.keyboardLayout : undefined,
      batteryLifeHours: parseNumber(specs.batteryLifeHours ?? specs.batteryHours),
    });
    if (Object.keys(laptop).length > 0) base.laptop = laptop;
  }

  return hasFitData(base) ? base : undefined;
}

export function ergonomicSpecsFromUnknown(
  value: unknown,
  fallback: Pick<RawCatalogDevice, "category" | "specs">,
): DeviceErgonomicSpecs | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return buildErgonomicSpecs(fallback);

  const input = value as Record<string, unknown>;
  if (input.category !== fallback.category) return buildErgonomicSpecs(fallback);

  return input as unknown as DeviceErgonomicSpecs;
}
