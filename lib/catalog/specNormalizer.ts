import type { CatalogSpecs } from "./catalogTypes";

export type NormalizedPort =
  | "usb-a"
  | "usb-c"
  | "thunderbolt"
  | "hdmi"
  | "displayport"
  | "magsafe"
  | "ethernet"
  | "audio";

export type ResolutionClass = "below_1080p" | "1080p" | "qhd" | "4k" | "5k";

export interface NormalizedLaptopSpecs {
  ramGb?: number;
  storageGb?: number;
  ports: NormalizedPort[];
}

export interface NormalizedMonitorSpecs {
  resolutionClass?: ResolutionClass;
  widthPixels?: number;
  heightPixels?: number;
  refreshRateHz?: number;
  sizeInches?: number;
  ports: NormalizedPort[];
}

export interface NormalizedMouseSpecs {
  ergonomic?: boolean;
  vertical?: boolean;
  trackball?: boolean;
  wireless?: boolean;
}

export interface NormalizedKeyboardSpecs {
  ergonomic?: boolean;
  split?: boolean;
  lowProfile?: boolean;
  quiet?: boolean;
  loud?: boolean;
  wireless?: boolean;
  switchType?: string;
}

export interface NormalizedChairSpecs {
  lumbarSupport?: boolean;
  ergonomic?: boolean;
  adjustable?: boolean;
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
  if (["true", "yes", "y", "wireless"].includes(normalized)) return true;
  if (["false", "no", "n", "wired"].includes(normalized)) return false;
  return undefined;
}

function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/[,/]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function rawRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function rawText(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.map(rawText).join(" ");
  if (!raw || typeof raw !== "object") return "";

  return Object.entries(raw as Record<string, unknown>)
    .map(([key, value]) => `${key} ${Array.isArray(value) ? value.join(" ") : String(value)}`)
    .join(" ");
}

function normalizeBoolean(raw: unknown, positive: RegExp, negative?: RegExp): boolean | undefined {
  const parsed = parseBoolean(raw);
  if (parsed !== undefined) return parsed;

  const text = rawText(raw).toLowerCase();
  if (negative?.test(text)) return false;
  if (positive.test(text)) return true;
  return undefined;
}

function pickRawValue(rawSpecs: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (rawSpecs[key] !== undefined && rawSpecs[key] !== null) return rawSpecs[key];
  }

  return undefined;
}

function parseGbValue(raw: unknown, labelPattern: RegExp): number | undefined {
  const direct = parseNumber(raw);
  if (typeof raw === "number") return direct;

  const text = rawText(raw).toLowerCase();
  const labelFirst = text.match(new RegExp(`${labelPattern.source}[^\\d]{0,24}(\\d+(?:\\.\\d+)?)\\s*(?:gb|g)\\b`));
  if (labelFirst) return Number(labelFirst[1]);

  const valueFirst = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:gb|g)\\b[^.]{0,32}${labelPattern.source}`));
  if (valueFirst) return Number(valueFirst[1]);

  return undefined;
}

function parseLaptopRamGb(raw: unknown): number | undefined {
  const specs = rawRecord(raw);
  const explicit = pickRawValue(specs, ["ramGb", "ramGB", "memoryGb", "memoryGB", "ram", "memory", "unifiedMemory"]);
  const parsedExplicit = parseGbValue(explicit, /\b(?:ram|memory|unified memory|unified)\b/);
  if (parsedExplicit !== undefined) return parsedExplicit;

  const text = rawText(raw).toLowerCase();
  const matched = text.match(/\b(\d+(?:\.\d+)?)\s*(?:gb|g)\s*(?:unified\s*)?(?:ram|memory)\b/);
  if (matched) return Number(matched[1]);

  const plausibleGbValues = Array.from(text.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:gb|g)\b/g))
    .map((match) => Number(match[1]))
    .filter((value) => value > 0 && value <= 128);

  return plausibleGbValues.length > 0 ? Math.min(...plausibleGbValues) : undefined;
}

function parseStorageGb(raw: unknown): number | undefined {
  const specs = rawRecord(raw);
  const explicit = pickRawValue(specs, ["storageGb", "storageGB", "ssdGb", "ssdGB", "storage", "ssd"]);
  const parsedExplicit = parseGbValue(explicit, /\b(?:storage|ssd|drive|disk)\b/);
  if (parsedExplicit !== undefined) return parsedExplicit;

  const text = rawText(raw).toLowerCase();
  const tbMatch = text.match(/\b(\d+(?:\.\d+)?)\s*tb\b[^.]{0,24}(?:storage|ssd|drive|disk)?/);
  if (tbMatch) return Number(tbMatch[1]) * 1024;

  const gbMatch = text.match(/\b(\d+(?:\.\d+)?)\s*gb\b[^.]{0,24}(?:storage|ssd|drive|disk)\b/);
  return gbMatch ? Number(gbMatch[1]) : undefined;
}

function normalizePorts(raw: unknown): NormalizedPort[] {
  const text = rawText(raw).toLowerCase();
  const ports = new Set<NormalizedPort>();

  if (/\b(?:usb[-\s]?c|type[-\s]?c)\b/.test(text)) ports.add("usb-c");
  if (/\b(?:thunderbolt|tb3|tb4|tb\s?3|tb\s?4)\b/.test(text)) ports.add("thunderbolt");
  if (/\busb[-\s]?a\b/.test(text) || /\busb 3\b/.test(text)) ports.add("usb-a");
  if (/\bhdmi\b/.test(text)) ports.add("hdmi");
  if (/\b(?:displayport|display port|dp)\b/.test(text)) ports.add("displayport");
  if (/\bmagsafe\b/.test(text)) ports.add("magsafe");
  if (/\b(?:ethernet|rj45|rj-45)\b/.test(text)) ports.add("ethernet");
  if (/\b(?:3\.5mm|headphone|audio)\b/.test(text)) ports.add("audio");

  return [...ports];
}

function parseResolution(raw: unknown): Pick<NormalizedMonitorSpecs, "resolutionClass" | "widthPixels" | "heightPixels"> {
  const text = rawText(raw).toLowerCase();
  const dimensions = text.match(/\b(\d{3,5})\s*[x×]\s*(\d{3,5})\b/);
  const widthPixels = dimensions ? Number(dimensions[1]) : undefined;
  const heightPixels = dimensions ? Number(dimensions[2]) : undefined;

  if (widthPixels !== undefined && heightPixels !== undefined) {
    const longEdge = Math.max(widthPixels, heightPixels);
    const shortEdge = Math.min(widthPixels, heightPixels);

    if (longEdge >= 5120 || shortEdge >= 2880) return { resolutionClass: "5k", widthPixels, heightPixels };
    if (longEdge >= 3840 || shortEdge >= 2160) return { resolutionClass: "4k", widthPixels, heightPixels };
    if (longEdge >= 2560 || shortEdge >= 1440) return { resolutionClass: "qhd", widthPixels, heightPixels };
    if (longEdge >= 1920 || shortEdge >= 1080) return { resolutionClass: "1080p", widthPixels, heightPixels };
    return { resolutionClass: "below_1080p", widthPixels, heightPixels };
  }

  if (/\b(?:5k|2880p)\b/.test(text)) return { resolutionClass: "5k" };
  if (/\b(?:4k|uhd|2160p)\b/.test(text)) return { resolutionClass: "4k" };
  if (/\b(?:qhd|wqhd|1440p|2k)\b/.test(text)) return { resolutionClass: "qhd" };
  if (/\b(?:fhd|full hd|1080p)\b/.test(text)) return { resolutionClass: "1080p" };
  if (/\b(?:720p|768p|hd)\b/.test(text)) return { resolutionClass: "below_1080p" };

  return {};
}

function normalizeRawSpecs(rawSpecs: Record<string, unknown>): CatalogSpecs["raw"] {
  return Object.fromEntries(
    Object.entries(rawSpecs)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [
        key,
        Array.isArray(value) ? value.map(String) : typeof value === "object" ? JSON.stringify(value) : value,
      ]),
  ) as CatalogSpecs["raw"];
}

export function normalizeSpecs(rawSpecs: Record<string, unknown> = {}): CatalogSpecs {
  const widthInches = parseNumber(rawSpecs.widthInches ?? rawSpecs.width ?? rawSpecs.width_in);
  const heightInches = parseNumber(rawSpecs.heightInches ?? rawSpecs.height ?? rawSpecs.height_in);
  const depthInches = parseNumber(rawSpecs.depthInches ?? rawSpecs.depth ?? rawSpecs.depth_in);
  const weightPounds = parseNumber(rawSpecs.weightPounds ?? rawSpecs.weight ?? rawSpecs.weight_lb);
  const refreshRateHz = parseNumber(rawSpecs.refreshRateHz ?? rawSpecs.refreshRate ?? rawSpecs.hz);
  const wireless = parseBoolean(rawSpecs.wireless);
  const tags = new Set<string>([
    ...parseStringList(rawSpecs.tags),
    ...parseStringList(rawSpecs.accessibilityTags),
    ...parseStringList(rawSpecs.bestFor),
  ]);

  if (wireless === true) tags.add("wireless");
  if (rawSpecs.portable === true || rawSpecs.foldable === true) tags.add("portable");
  if (rawSpecs.quietKeys === true || rawSpecs.noiseLevel === "quiet") tags.add("quiet");

  return {
    dimensions: { widthInches, heightInches, depthInches, weightPounds },
    resolution: typeof rawSpecs.resolution === "string" ? rawSpecs.resolution : undefined,
    refreshRateHz,
    panelType: typeof rawSpecs.panelType === "string" ? rawSpecs.panelType : undefined,
    switchType: typeof rawSpecs.switchType === "string" ? rawSpecs.switchType : undefined,
    wireless,
    noiseLevel:
      rawSpecs.noiseLevel === "quiet" || rawSpecs.noiseLevel === "normal" || rawSpecs.noiseLevel === "loud"
        ? rawSpecs.noiseLevel
        : undefined,
    ports: parseStringList(rawSpecs.ports ?? rawSpecs.requiredPorts),
    tags: [...tags].map((tag) => tag.toLowerCase()),
    raw: normalizeRawSpecs(rawSpecs),
  };
}

export function normalizePriceCents(value: unknown): number | undefined {
  const parsed = parseNumber(value);
  if (parsed === undefined) return undefined;
  return Math.round(parsed > 10_000 ? parsed : parsed * 100);
}

export function normalizeLaptopSpecs(raw: unknown = {}): NormalizedLaptopSpecs {
  return {
    ramGb: parseLaptopRamGb(raw),
    storageGb: parseStorageGb(raw),
    ports: normalizePorts(raw),
  };
}

export function normalizeMonitorSpecs(raw: unknown = {}): NormalizedMonitorSpecs {
  const specs = rawRecord(raw);

  return {
    ...parseResolution(pickRawValue(specs, ["resolution", "displayResolution"]) ?? raw),
    refreshRateHz: parseNumber(pickRawValue(specs, ["refreshRateHz", "refreshRate", "hz"])),
    sizeInches: parseNumber(pickRawValue(specs, ["sizeInches", "screenSize", "size"])),
    ports: normalizePorts(pickRawValue(specs, ["ports", "requiredPorts"]) ?? raw),
  };
}

export function normalizeMouseSpecs(raw: unknown = {}): NormalizedMouseSpecs {
  const text = rawText(raw).toLowerCase();
  const vertical = normalizeBoolean(raw, /\bvertical\b/);
  const trackball = normalizeBoolean(raw, /\btrackball\b/);
  const ergonomic = normalizeBoolean(raw, /\b(?:ergo|ergonomic|vertical|trackball|reduced pronation)\b/);

  return {
    ergonomic,
    vertical,
    trackball,
    wireless: normalizeBoolean(raw, /\b(?:wireless|bluetooth|2\.4ghz)\b/, /\bwired\b/),
    ...(text.includes("vertical ergonomic mouse") ? { ergonomic: true, vertical: true } : {}),
  };
}

export function normalizeKeyboardSpecs(raw: unknown = {}): NormalizedKeyboardSpecs {
  const specs = rawRecord(raw);
  const switchType = pickRawValue(specs, ["switchType", "switches", "keySwitches"]);
  const switchText = typeof switchType === "string" ? switchType.toLowerCase() : undefined;
  const text = rawText(raw).toLowerCase();
  const quiet = normalizeBoolean(raw, /\b(?:quiet|silent|low noise|low-noise|quietkeys|quiet keys|red switch|red switches)\b/);
  const loud = normalizeBoolean(
    raw,
    /\b(?:loud|clicky|blue switch|blue switches|buckling spring)\b/,
    /\b(?:quiet|silent|low noise|low-noise)\b/,
  );

  return {
    ergonomic: normalizeBoolean(raw, /\b(?:ergo|ergonomic|split|tenting|tented|alice)\b/),
    split: normalizeBoolean(raw, /\b(?:split|alice)\b/),
    lowProfile: normalizeBoolean(raw, /\b(?:low profile|low-profile)\b/),
    quiet,
    loud,
    wireless: normalizeBoolean(raw, /\b(?:wireless|bluetooth|2\.4ghz)\b/, /\bwired\b/),
    switchType: switchText ?? (text.includes("mechanical") ? "mechanical" : undefined),
  };
}

export function normalizeChairSpecs(raw: unknown = {}): NormalizedChairSpecs {
  const noLumbarPattern = /\b(?:no|without|lacks?|missing)\s+(?:adjustable\s+)?lumbar\b|\blumbar\s+(?:support\s+)?(?:missing|absent)\b/;

  return {
    lumbarSupport: normalizeBoolean(raw, /\b(?:lumbar|lower back support|adjustable lumbar)\b/, noLumbarPattern),
    ergonomic: normalizeBoolean(raw, /\b(?:ergo|ergonomic|task chair|office chair|mesh chair|adjustable)\b/),
    adjustable: normalizeBoolean(raw, /\b(?:adjustable|height adjustment|arm adjustment|seat depth|tilt)\b/),
  };
}
