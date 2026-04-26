import {
  CATEGORY_DEVICE_TRAITS,
  COMMON_DEVICE_TRAITS,
  type CatalogDevice,
  type DeviceSpecs,
  type DeviceTraitRatings,
  type NormalizedDeviceSpecs,
  type RawCatalogDevice,
} from "./deviceTypes";
import { buildErgonomicSpecs } from "./ergonomicSpecs";
import { clampTrait, getDeviceStrengths, getDeviceWeaknesses, normalizeTraitRatings } from "./deviceTraits";

const CURRENT_YEAR = 2026;

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
  if (["true", "yes", "y", "wireless", "included"].includes(normalized)) return true;
  if (["false", "no", "n", "wired", "none"].includes(normalized)) return false;
  return undefined;
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/[,/]/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function parseGb(value: unknown): number | undefined {
  const direct = parseNumber(value);
  if (typeof value === "number") return direct;

  const text = rawText(value).toLowerCase();
  const tbMatch = text.match(/\b(\d+(?:\.\d+)?)\s*tb\b/);
  if (tbMatch) return Number(tbMatch[1]) * 1024;

  const gbMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(?:gb|g)\b/);
  return gbMatch ? Number(gbMatch[1]) : direct;
}

function parseWeightPounds(value: unknown): number | undefined {
  const direct = parseNumber(value);
  if (typeof value === "number") return direct;

  const text = rawText(value).toLowerCase();
  const kgMatch = text.match(/\b(\d+(?:\.\d+)?)\s*kg\b/);
  if (kgMatch) return Number((Number(kgMatch[1]) * 2.20462).toFixed(1));

  return direct;
}

function parseResolution(value: unknown): { widthPixels?: number; heightPixels?: number; resolution?: string } {
  const text = rawText(value).toLowerCase();
  const dimensions = text.match(/\b(\d{3,5})\s*[x×]\s*(\d{3,5})\b/);
  if (dimensions) {
    return {
      widthPixels: Number(dimensions[1]),
      heightPixels: Number(dimensions[2]),
      resolution: `${dimensions[1]}x${dimensions[2]}`,
    };
  }

  if (/\b5k\b/.test(text)) return { widthPixels: 5120, heightPixels: 2880, resolution: "5120x2880" };
  if (/\b4k|uhd\b/.test(text)) return { widthPixels: 3840, heightPixels: 2160, resolution: "3840x2160" };
  if (/\bqhd|1440p|2k\b/.test(text)) return { widthPixels: 2560, heightPixels: 1440, resolution: "2560x1440" };
  if (/\b1080p|fhd|full hd\b/.test(text)) return { widthPixels: 1920, heightPixels: 1080, resolution: "1920x1080" };
  return {};
}

function scoreFromYear(releaseYear?: number): number {
  if (!releaseYear) return 50;
  const age = CURRENT_YEAR - releaseYear;
  if (age <= 0) return 94;
  if (age === 1) return 88;
  if (age === 2) return 78;
  if (age <= 4) return 62;
  if (age <= 7) return 42;
  return 24;
}

function chipTier(chip: string): number {
  const normalized = chip.toLowerCase();

  if (/m5 max|rtx 5090|ultra 9|ryzen ai 9 hx|core ultra 9/.test(normalized)) return 96;
  if (/m5 pro|m4 max|rtx 5080|rtx 4090|ryzen 9|core i9|ultra 7/.test(normalized)) return 90;
  if (/m5|m4 pro|m3 max|rtx 5070|rtx 4080|core ultra|ryzen ai 7|snapdragon x elite/.test(normalized)) return 84;
  if (/m4|m3 pro|m2 max|rtx 4070|ryzen 7|core i7|apple a19|apple a18/.test(normalized)) return 78;
  if (/m3|m2 pro|m1 max|rtx 4060|ryzen 5|core i5|apple a17/.test(normalized)) return 70;
  if (/m2|m1 pro|rtx 4050|snapdragon x plus/.test(normalized)) return 62;
  if (/m1|intel|iris|uhd|chromebook|celeron|pentium/.test(normalized)) return normalized.includes("celeron") ? 25 : 52;
  return 50;
}

function gpuTier(specs: DeviceSpecs): number {
  const text = rawText(specs).toLowerCase();
  if (/rtx 5090|m5 max/.test(text)) return 98;
  if (/rtx 5080|rtx 4090|m4 max|m5 pro/.test(text)) return 92;
  if (/rtx 5070|rtx 4080|m3 max|m4 pro/.test(text)) return 86;
  if (/rtx 4070|m3 pro|radeon 780m|arc/.test(text)) return 76;
  if (/rtx 4060|rtx 4050|m[2345]\b/.test(text)) return 64;
  if (/m1|integrated|iris|uhd|snapdragon/.test(text)) return 42;
  return 45;
}

function priceValueScore(priceCents: number, performance = 50): number {
  const price = Math.max(priceCents / 100, 1);
  const value = performance * 0.9 + Math.max(0, 100 - price / 18);
  return clampTrait(value / 1.55);
}

function normalizeCommon(device: RawCatalogDevice): NormalizedDeviceSpecs {
  const specs = device.specs;
  const text = rawText(specs).toLowerCase();

  return {
    releaseYear: device.releaseYear,
    priceCents: device.estimatedPriceCents,
    weightPounds: parseWeightPounds(specs.weightPounds ?? specs.weight ?? specs.weightLb),
    widthInches: parseNumber(specs.widthInches ?? specs.width),
    depthInches: parseNumber(specs.depthInches ?? specs.depth),
    heightInches: parseNumber(specs.heightInches ?? specs.height),
    ports: parseStringArray(specs.ports),
    wireless: parseBoolean(specs.wireless) ?? /\bbluetooth|wireless|2\.4ghz|wi-fi|wifi\b/.test(text),
    quiet:
      parseBoolean(specs.quiet) ??
      /\bquiet|silent|low noise|low-noise|scissor|membrane|anc\b/.test(text),
    loud: /\bclicky|blue switch|loud|buckling spring\b/.test(text),
    portable:
      parseBoolean(specs.portable) ??
      parseBoolean(specs.foldable) ??
      /\bportable|foldable|travel|compact\b/.test(text),
  };
}

function normalizeLaptop(device: RawCatalogDevice): NormalizedDeviceSpecs {
  const specs = device.specs;
  const chip = String(specs.chip ?? specs.cpu ?? specs.processor ?? "");
  const text = rawText(specs).toLowerCase();

  return {
    ...normalizeCommon(device),
    chip,
    cpuClass: chip,
    gpuClass: String(specs.gpu ?? specs.graphics ?? ""),
    ramGb: parseGb(specs.ramGb ?? specs.memoryGb ?? specs.memory ?? specs.ram),
    storageGb: parseGb(specs.storageGb ?? specs.ssdGb ?? specs.storage ?? specs.ssd),
    screenSizeInches: parseNumber(specs.screenSizeInches ?? specs.screenSize ?? specs.displaySize),
    batteryHours: parseNumber(specs.batteryHours ?? specs.batteryLife),
    os: specs.os,
    fanless: parseBoolean(specs.fanless) ?? text.includes("fanless"),
    repairable: parseBoolean(specs.repairable) ?? text.includes("framework"),
    externalDisplayCount: parseNumber(specs.externalDisplayCount ?? specs.externalDisplays),
    aiTops: parseNumber(specs.aiTops ?? specs.npuTops),
  };
}

function normalizeMonitor(device: RawCatalogDevice): NormalizedDeviceSpecs {
  const specs = device.specs;
  const sizeInches = parseNumber(specs.sizeInches ?? specs.screenSize ?? specs.size);
  const resolution = parseResolution(specs.resolution ?? specs.displayResolution ?? device.displayName);
  const widthPixels = resolution.widthPixels;
  const heightPixels = resolution.heightPixels;
  const ppi =
    sizeInches && widthPixels && heightPixels
      ? Math.round(Math.sqrt(widthPixels ** 2 + heightPixels ** 2) / sizeInches)
      : undefined;

  return {
    ...normalizeCommon(device),
    sizeInches,
    ...resolution,
    ppi,
    refreshRateHz: parseNumber(specs.refreshRateHz ?? specs.refreshRate ?? specs.hz),
    panelType: specs.panelType,
    aspectRatio: specs.aspectRatio,
    usbC: parseBoolean(specs.usbC) ?? rawText(specs).toLowerCase().includes("usb-c"),
    usbCWatts: parseNumber(specs.usbCWatts ?? specs.powerDeliveryWatts),
    curved: parseBoolean(specs.curved),
    vesaMount: parseBoolean(specs.vesaMount) ?? true,
    colorCoverage: parseNumber(specs.colorCoverage ?? specs.dciP3 ?? specs.srgb),
  };
}

function normalizeKeyboard(device: RawCatalogDevice): NormalizedDeviceSpecs {
  const specs = device.specs;
  const text = rawText(specs).toLowerCase();

  return {
    ...normalizeCommon(device),
    layout: specs.layout,
    switchType: specs.switchType,
    lowProfile: parseBoolean(specs.lowProfile) ?? (text.includes("low profile") || text.includes("low-profile")),
    split: parseBoolean(specs.split) ?? /\bsplit|ergodox|moonlander|kinesis|glove80\b/.test(text),
    tenting: parseBoolean(specs.tenting) ?? /\btenting|tented\b/.test(text),
    mechanical: parseBoolean(specs.mechanical) ?? text.includes("mechanical"),
    noiseLevel: specs.noiseLevel,
    hotSwappable: parseBoolean(specs.hotSwappable),
  };
}

function normalizeMouse(device: RawCatalogDevice): NormalizedDeviceSpecs {
  const specs = device.specs;
  const text = rawText(specs).toLowerCase();

  return {
    ...normalizeCommon(device),
    ergonomic: parseBoolean(specs.ergonomic) ?? /\bergo|ergonomic|vertical|trackball\b/.test(text),
    vertical: parseBoolean(specs.vertical) ?? text.includes("vertical"),
    trackball: parseBoolean(specs.trackball) ?? text.includes("trackball"),
    buttons: parseNumber(specs.buttons ?? specs.customizableButtons),
    dpi: parseNumber(specs.dpi),
    gaming: parseBoolean(specs.gaming) ?? /\bgaming|razer|lightspeed|viper|g pro\b/.test(text),
    noiseLevel: specs.noiseLevel,
  };
}

function normalizeChair(device: RawCatalogDevice): NormalizedDeviceSpecs {
  const specs = device.specs;
  const text = rawText(specs).toLowerCase();

  return {
    ...normalizeCommon(device),
    lumbarSupport: parseBoolean(specs.lumbarSupport ?? specs.adjustableLumbar) ?? text.includes("lumbar"),
    adjustable: parseBoolean(specs.adjustable) ?? /\badjustable|4d|seat depth|tilt|height\b/.test(text),
    mesh: parseBoolean(specs.mesh) ?? text.includes("mesh"),
    usedMarketCommon: parseBoolean(specs.usedMarketCommon),
    weightCapacityPounds: parseNumber(specs.weightCapacityPounds),
  };
}

function normalizeAudio(device: RawCatalogDevice): NormalizedDeviceSpecs {
  const specs = device.specs;
  const text = rawText(specs).toLowerCase();

  return {
    ...normalizeCommon(device),
    activeNoiseCanceling: parseBoolean(specs.activeNoiseCanceling ?? specs.anc) ?? /\banc|noise cancel/.test(text),
    noiseIsolation: parseBoolean(specs.noiseIsolation) ?? /\bin-ear|closed back|closed-back|earbud\b/.test(text),
    batteryHours: parseNumber(specs.batteryHours ?? specs.batteryLife),
    micQuality: specs.micQuality,
    boomMic: parseBoolean(specs.boomMic) ?? text.includes("boom"),
    openBack: parseBoolean(specs.openBack) ?? (text.includes("open back") || text.includes("open-back")),
  };
}

function normalizeCameraMic(device: RawCatalogDevice): NormalizedDeviceSpecs {
  const specs = device.specs;
  const resolution = parseResolution(specs.resolution ?? device.displayName);

  return {
    ...normalizeCommon(device),
    ...resolution,
    frameRateFps: parseNumber(specs.frameRateFps ?? specs.frameRate),
    autofocus: parseBoolean(specs.autofocus),
    lowLight: parseBoolean(specs.lowLight),
    sensor: specs.sensor,
    microphone: specs.microphone,
    connection: specs.connection,
    xlr: parseBoolean(specs.xlr),
    usb: parseBoolean(specs.usb) ?? rawText(specs).toLowerCase().includes("usb"),
  };
}

function normalizeLighting(device: RawCatalogDevice): NormalizedDeviceSpecs {
  const specs = device.specs;
  const text = rawText(specs).toLowerCase();

  return {
    ...normalizeCommon(device),
    dimmable: parseBoolean(specs.dimmable) ?? text.includes("dimmable"),
    colorTemperatureControl:
      parseBoolean(specs.colorTemperatureControl) ?? /adjustable|2700|6500|temperature|warm|cool/.test(text),
    glareReduction: parseBoolean(specs.glareReduction) ?? /glare|screenbar|monitor light/.test(text),
    monitorMounted: parseBoolean(specs.monitorMounted) ?? /screenbar|monitor/.test(text),
    brightnessLux: parseNumber(specs.brightnessLux ?? specs.brightness),
  };
}

export function normalizeDeviceSpecs(device: RawCatalogDevice): NormalizedDeviceSpecs {
  if (device.normalizedSpecs) return device.normalizedSpecs;

  switch (device.category) {
    case "laptop":
    case "tablet":
    case "phone":
      return normalizeLaptop(device);
    case "monitor":
      return normalizeMonitor(device);
    case "keyboard":
      return normalizeKeyboard(device);
    case "mouse":
      return normalizeMouse(device);
    case "chair":
      return normalizeChair(device);
    case "headphones":
    case "earbuds":
      return normalizeAudio(device);
    case "webcam":
    case "microphone":
      return normalizeCameraMic(device);
    case "desk_lamp":
      return normalizeLighting(device);
    default:
      return normalizeCommon(device);
  }
}

function commonTraitRatings(device: RawCatalogDevice, normalized: NormalizedDeviceSpecs): DeviceTraitRatings {
  const text = rawText(device.specs).toLowerCase();
  const releaseScore = scoreFromYear(device.releaseYear);
  const weight = Number(normalized.weightPounds ?? 4);
  const width = Number(normalized.widthInches ?? 12);
  const depth = Number(normalized.depthInches ?? 8);
  const footprint = width * depth;
  const quiet = normalized.quiet === true;
  const loud = normalized.loud === true;
  const portable = normalized.portable === true;
  const buildQuality =
    /herman miller|steelcase|apple|framework|caldigit|shure|rode|benq|dell ultrasharp|thinkpad|logitech mx/.test(
      `${device.brand} ${device.model}`.toLowerCase(),
    )
      ? 86
      : /generic|budget|basic/.test(`${device.brand} ${device.model}`.toLowerCase())
        ? 42
        : 68;

  return {
    speed: releaseScore,
    comfort: /ergo|comfort|lumbar|quiet|cushion|soft/.test(text) ? 72 : 50,
    ergonomics: /ergo|vertical|split|lumbar|adjustable|stand|arm|height/.test(text) ? 78 : 42,
    portability: portable ? 82 : clampTrait(78 - weight * 8),
    sizeEfficiency: clampTrait(90 - footprint / 3),
    spaceCost: clampTrait(footprint / 4 + (device.category === "chair" ? 55 : 0)),
    noise: loud ? 78 : quiet ? 12 : 38,
    productivity: clampTrait(releaseScore * 0.45 + buildQuality * 0.35 + 12),
    accessibility: /accessibility|left hand|left-hand|assistive|caption|large print|vertical|ergonomic/.test(text) ? 82 : 48,
    compatibility: /usb-c|thunderbolt|bluetooth|wireless|hdmi|mac|windows|universal|vesa/.test(text) ? 78 : 56,
    buildQuality,
    durability: clampTrait(buildQuality * 0.9 + (device.typicalUsedPriceCents ? 8 : 0)),
    repairability: /framework|repairable|modular|replaceable|standard/.test(text) ? 90 : device.category === "laptop" ? 36 : 48,
    powerEfficiency: /apple m|arm|led|usb-c|energy/.test(text) ? 78 : 52,
    value: priceValueScore(device.estimatedPriceCents, releaseScore),
    futureProofing: clampTrait(releaseScore * 0.75 + (rawText(normalized.ports).includes("Thunderbolt") ? 12 : 0)),
    setupSimplicity: /plug|simple|wireless|bluetooth|usb|class compliant/.test(text) ? 82 : 62,
    confidence: clampTrait((device.traitConfidence ?? 0.78) * 100),
  };
}

function laptopTraits(device: RawCatalogDevice, specs: NormalizedDeviceSpecs): DeviceTraitRatings {
  const chip = String(specs.chip ?? "");
  const cpu = chipTier(chip);
  const gpu = Math.max(gpuTier(device.specs), cpu - 18);
  const ram = Number(specs.ramGb ?? 8);
  const storage = Number(specs.storageGb ?? 256);
  const battery = Number(specs.batteryHours ?? 10);
  const weight = Number(specs.weightPounds ?? 3.5);
  const screen = Number(specs.screenSizeInches ?? 14);
  const aiTops = Number(specs.aiTops ?? 0);
  const externalDisplays = Number(specs.externalDisplayCount ?? (chip.toLowerCase().includes("m1") ? 1 : 2));
  const fanless = specs.fanless === true;

  return {
    speed: clampTrait(cpu * 0.72 + gpu * 0.18 + scoreFromYear(device.releaseYear) * 0.1),
    cpuSpeed: cpu,
    gpuSpeed: gpu,
    ramHeadroom: clampTrait(ram <= 8 ? 26 : ram <= 16 ? 66 : ram <= 24 ? 84 : 95),
    storageHeadroom: clampTrait(storage <= 256 ? 38 : storage <= 512 ? 66 : storage <= 1024 ? 82 : 94),
    batteryLife: clampTrait(battery * 5.5),
    portability: clampTrait(105 - weight * 17 + (screen <= 14 ? 10 : -8)),
    thermalSustainability: clampTrait(cpu - (fanless && cpu > 70 ? 18 : 0) + (gpu > 85 ? 6 : 0)),
    displayQuality: clampTrait(55 + screen * 1.4 + (/oled|mini-led|liquid retina|retina/i.test(rawText(device.specs)) ? 18 : 0)),
    externalDisplaySupport: clampTrait(35 + externalDisplays * 22 + (rawText(device.specs).toLowerCase().includes("thunderbolt") ? 16 : 0)),
    aiLocalCapability: clampTrait(aiTops ? 45 + aiTops * 0.7 : cpu + ram * 0.9 - 22),
    codingSuitability: clampTrait(cpu * 0.42 + Math.min(ram, 36) * 1.45 + Math.min(storage, 2048) / 48),
    creativeWorkSuitability: clampTrait(gpu * 0.45 + cpu * 0.25 + Math.min(ram, 64) + (/oled|mini-led|retina/i.test(rawText(device.specs)) ? 8 : 0)),
    gamingSuitability: clampTrait(gpu * 0.74 + (rawText(device.specs).toLowerCase().includes("rtx") ? 18 : 0)),
  };
}

function monitorTraits(device: RawCatalogDevice, specs: NormalizedDeviceSpecs): DeviceTraitRatings {
  const size = Number(specs.sizeInches ?? 24);
  const ppi = Number(specs.ppi ?? 92);
  const widthPixels = Number(specs.widthPixels ?? 1920);
  const heightPixels = Number(specs.heightPixels ?? 1080);
  const refresh = Number(specs.refreshRateHz ?? 60);
  const ultrawide = size >= 34 || String(specs.aspectRatio ?? "").includes("21:9") || widthPixels / heightPixels > 2;
  const usbC = specs.usbC === true;
  const color = Number(specs.colorCoverage ?? (/proart|studio|ultrasharp|benq/i.test(device.displayName) ? 95 : 80));

  return {
    screenWorkspace: clampTrait(size * 1.65 + widthPixels / 90 + (ultrawide ? 16 : 0)),
    textClarity: clampTrait(ppi * 0.72 + (heightPixels >= 2160 ? 15 : 0)),
    colorQuality: clampTrait(color * 0.8 + (/ips|oled|mini-led/i.test(rawText(device.specs)) ? 16 : 0)),
    refreshSmoothness: clampTrait(refresh / 2.4 + (refresh >= 120 ? 30 : 0)),
    eyeComfort: clampTrait(ppi * 0.42 + (heightPixels >= 1440 ? 20 : 0) + (/flicker|low blue|comfort/i.test(rawText(device.specs)) ? 18 : 0)),
    deskSpaceFit: clampTrait(105 - size * 1.7 - (ultrawide ? 18 : 0)),
    portConvenience: clampTrait(usbC ? 82 + Number(specs.usbCWatts ?? 0) / 8 : 46),
    macCompatibility: clampTrait((ppi >= 160 ? 82 : ppi >= 135 ? 70 : 48) + (usbC ? 12 : 0)),
    gamingSuitability: clampTrait(refresh / 2 + (/oled|odyssey|gaming/i.test(device.displayName) ? 24 : 0)),
    codingSuitability: clampTrait(ppi * 0.4 + Math.min(38, size) * 1.1 + (heightPixels >= 1440 ? 20 : 0)),
    creativeWorkSuitability: clampTrait(color * 0.62 + ppi * 0.22 + (/proart|studio|benq|ultrasharp/i.test(device.displayName) ? 14 : 0)),
  };
}

function keyboardTraits(device: RawCatalogDevice, specs: NormalizedDeviceSpecs): DeviceTraitRatings {
  const text = rawText(device.specs).toLowerCase();
  const quiet = specs.quiet === true || specs.noiseLevel === "quiet";
  const loud = specs.loud === true || specs.noiseLevel === "loud" || /blue|clicky/.test(text);
  const split = specs.split === true;
  const lowProfile = specs.lowProfile === true;
  const mechanical = specs.mechanical === true;

  return {
    typingComfort: clampTrait(54 + (mechanical ? 12 : 4) + (lowProfile ? 8 : 0) + (split ? 10 : 0)),
    noiseQuietness: loud ? 22 : quiet ? 90 : lowProfile ? 72 : 54,
    ergonomicSupport: clampTrait(split ? 92 : /wave|alice|ergo|kinesis|moonlander|glove80/i.test(device.displayName) ? 82 : lowProfile ? 56 : 42),
    layoutEfficiency: clampTrait(/full|numpad/i.test(String(specs.layout)) ? 72 : /75|80|tkl/i.test(String(specs.layout)) ? 82 : 68),
    buildQuality: clampTrait(/keychron q|logitech mx|apple|zsa|kinesis|wooting|nuphy/i.test(device.displayName) ? 84 : 60),
    portability: clampTrait(/mini|air|low profile|75|compact/i.test(device.displayName) ? 78 : 42),
    gamingResponsiveness: clampTrait(/he|magnetic|wooting|gaming|rapid trigger/i.test(text) ? 92 : mechanical ? 72 : 42),
  };
}

function mouseTraits(device: RawCatalogDevice, specs: NormalizedDeviceSpecs): DeviceTraitRatings {
  const vertical = specs.vertical === true;
  const trackball = specs.trackball === true;
  const ergonomic = specs.ergonomic === true || vertical || trackball;
  const buttons = Number(specs.buttons ?? 3);
  const gaming = specs.gaming === true;
  const quiet = specs.quiet === true || specs.noiseLevel === "quiet";

  return {
    wristComfort: clampTrait(vertical ? 94 : trackball ? 86 : ergonomic ? 76 : 42),
    ergonomicSupport: clampTrait(vertical || trackball ? 90 : ergonomic ? 74 : 34),
    portability: clampTrait(/anywhere|mobile|mini|orochi/i.test(device.displayName) ? 84 : 56),
    precision: clampTrait(gaming ? 92 : /mx master|trackball|anywhere|magic trackpad/i.test(device.displayName.toLowerCase()) ? 82 : 58),
    quietness: quiet ? 88 : 52,
    productivityButtons: clampTrait(buttons * 10 + (/mx master|basilisk|g502|master/i.test(device.displayName.toLowerCase()) ? 28 : 0)),
    gamingResponsiveness: clampTrait(gaming ? 94 : 44),
  };
}

function chairTraits(device: RawCatalogDevice, specs: NormalizedDeviceSpecs): DeviceTraitRatings {
  const lumbar = specs.lumbarSupport === true;
  const adjustable = specs.adjustable === true;
  const premium = /aeron|embody|leap|gesture|fern|steelcase|herman miller|haworth/i.test(device.displayName);

  return {
    backSupport: clampTrait((lumbar ? 72 : 38) + (adjustable ? 14 : 0) + (premium ? 10 : 0)),
    lumbarSupport: lumbar ? 88 : 28,
    adjustability: clampTrait(adjustable ? 82 : /fixed|basic|markus/i.test(device.displayName.toLowerCase()) ? 42 : 58),
    longSessionComfort: clampTrait((premium ? 86 : 58) + (lumbar ? 8 : 0) + (adjustable ? 8 : 0)),
    sizeFit: clampTrait(Number(specs.weightCapacityPounds ?? 275) >= 300 ? 78 : 62),
    usedMarketValue: clampTrait(specs.usedMarketCommon === true ? 86 : premium ? 74 : 48),
  };
}

function audioTraits(device: RawCatalogDevice, specs: NormalizedDeviceSpecs): DeviceTraitRatings {
  const anc = specs.activeNoiseCanceling === true;
  const isolated = specs.noiseIsolation === true || anc;
  const battery = Number(specs.batteryHours ?? (device.category === "earbuds" ? 6 : 20));
  const boomMic = specs.boomMic === true;

  return {
    noiseIsolation: clampTrait(isolated ? 78 : specs.openBack === true ? 18 : 46),
    activeNoiseCanceling: anc ? 88 : 8,
    comfort: clampTrait(device.category === "earbuds" ? 62 : /bose|sony|airpods max|quietcomfort/i.test(device.displayName) ? 82 : 64),
    micQuality: clampTrait(boomMic ? 88 : /airpods pro|bose|sony|jabra|poly/i.test(device.displayName) ? 72 : 48),
    batteryLife: clampTrait(device.category === "earbuds" ? battery * 8 : battery * 3),
    portability: clampTrait(device.category === "earbuds" ? 94 : /fold|compact/i.test(rawText(device.specs).toLowerCase()) ? 70 : 52),
    focusSupport: clampTrait((anc ? 50 : 8) + (isolated ? 22 : 0) + (/sony|bose|airpods pro|soundcore/i.test(device.displayName.toLowerCase()) ? 16 : 0)),
  };
}

function cameraMicTraits(device: RawCatalogDevice, specs: NormalizedDeviceSpecs): DeviceTraitRatings {
  const width = Number(specs.widthPixels ?? 1920);
  const fps = Number(specs.frameRateFps ?? 30);
  const isMic = device.category === "microphone";

  return {
    callQuality: clampTrait(isMic ? (/shure|rode|yeti|wave/i.test(device.displayName) ? 88 : 68) : width / 55 + fps * 0.35),
    lowLightPerformance: clampTrait(specs.lowLight === true ? 86 : /brio|insta360|link|tiny|k4|4k/i.test(device.displayName) ? 74 : 46),
    setupSimplicity: clampTrait(specs.usb === true || !isMic ? 82 : 48),
    compatibility: clampTrait(specs.usb === true || rawText(device.specs).toLowerCase().includes("usb") ? 82 : 58),
    professionalism: clampTrait(/shure|rode|elgato|insta360|brio|facecam|yeti/i.test(device.displayName) ? 84 : 56),
  };
}

function lightingTraits(device: RawCatalogDevice, specs: NormalizedDeviceSpecs): DeviceTraitRatings {
  return {
    eyeComfort: clampTrait((specs.dimmable ? 24 : 0) + (specs.colorTemperatureControl ? 28 : 0) + 34),
    deskCoverage: clampTrait(Number(specs.brightnessLux ?? 450) / 8 + (specs.monitorMounted ? 8 : 0)),
    colorTemperatureControl: specs.colorTemperatureControl ? 88 : 28,
    glareReduction: specs.glareReduction ? 88 : 42,
    spaceEfficiency: clampTrait(specs.monitorMounted ? 94 : 64),
  };
}

function genericCategoryTraits(device: RawCatalogDevice, specs: NormalizedDeviceSpecs): DeviceTraitRatings {
  const text = rawText(device.specs).toLowerCase();

  return {
    portConvenience: /dock|hub|thunderbolt|usb-c|ports/.test(text) ? 86 : 54,
    powerDelivery: clampTrait(Number(specs.powerDeliveryWatts ?? device.specs.powerDeliveryWatts ?? 0) + 28),
    deskSpaceFit: /arm|stand|compact|foldable/.test(text) ? 82 : 54,
    adjustability: /adjustable|height|tilt|arm|sit-stand/.test(text) ? 82 : 42,
    stability: /aluminum|steel|heavy|premium/.test(text) ? 78 : 54,
    storageHeadroom: clampTrait(parseGb(device.specs.capacity ?? device.specs.storage) ? Math.min(100, Number(parseGb(device.specs.capacity ?? device.specs.storage)) / 40) : 50),
    coverage: clampTrait(/wifi 7|wi-fi 7|mesh|6e/.test(text) ? 88 : /wifi 6|wi-fi 6/.test(text) ? 74 : 52),
    soundQuality: clampTrait(/homepod|sonos|echo studio/.test(device.displayName.toLowerCase()) ? 82 : 56),
    privacy: clampTrait(/privacy|local|mute/.test(text) ? 76 : 44),
    reliability: clampTrait(/logitech|caldigit|ergotron|anker|plugable|brother|epson/i.test(device.displayName) ? 78 : 58),
    spaceEfficiency: /compact|mini|portable|monitor mounted/.test(text) ? 82 : 54,
  };
}

export function precomputeTraitRatings(device: RawCatalogDevice): {
  normalizedSpecs: NormalizedDeviceSpecs;
  traitRatings: DeviceTraitRatings;
  traitConfidence: number;
} {
  const normalizedSpecs = normalizeDeviceSpecs(device);
  const common = commonTraitRatings(device, normalizedSpecs);
  let categoryTraits: DeviceTraitRatings = {};

  switch (device.category) {
    case "laptop":
    case "tablet":
    case "phone":
      categoryTraits = laptopTraits(device, normalizedSpecs);
      break;
    case "monitor":
      categoryTraits = monitorTraits(device, normalizedSpecs);
      break;
    case "keyboard":
      categoryTraits = keyboardTraits(device, normalizedSpecs);
      break;
    case "mouse":
      categoryTraits = mouseTraits(device, normalizedSpecs);
      break;
    case "chair":
      categoryTraits = chairTraits(device, normalizedSpecs);
      break;
    case "headphones":
    case "earbuds":
      categoryTraits = audioTraits(device, normalizedSpecs);
      break;
    case "webcam":
    case "microphone":
      categoryTraits = cameraMicTraits(device, normalizedSpecs);
      break;
    case "desk_lamp":
      categoryTraits = lightingTraits(device, normalizedSpecs);
      break;
    default:
      categoryTraits = genericCategoryTraits(device, normalizedSpecs);
      break;
  }

  const categoryTraitNames = CATEGORY_DEVICE_TRAITS[device.category] ?? [];
  const seededRatings = device.traitRatings ?? {};
  const ratingDefaults = Object.fromEntries(
    [...COMMON_DEVICE_TRAITS, ...categoryTraitNames].map((trait) => [trait, 50]),
  );
  const traitRatings = normalizeTraitRatings({
    ...ratingDefaults,
    ...common,
    ...categoryTraits,
    ...seededRatings,
  });
  const sourceConfidence = device.sourceUrls?.length ? 0.82 : 0.72;
  const specConfidence = Object.keys(device.specs).length >= 4 ? 0.08 : 0;
  const traitConfidence = Math.max(0, Math.min(1, device.traitConfidence ?? sourceConfidence + specConfidence));

  traitRatings.confidence = clampTrait(traitConfidence * 100);

  return {
    normalizedSpecs,
    traitRatings,
    traitConfidence,
  };
}

export function enrichCatalogDevice(rawDevice: RawCatalogDevice): CatalogDevice {
  const computed = precomputeTraitRatings(rawDevice);
  const aliases = Array.from(
    new Set([
      rawDevice.displayName,
      `${rawDevice.brand} ${rawDevice.model}`,
      rawDevice.model,
      ...(rawDevice.aliases ?? []),
    ]),
  );
  const deviceForStrengths = {
    traitRatings: computed.traitRatings,
  };

  return {
    ...rawDevice,
    aliases,
    lifecycleStatus: rawDevice.lifecycleStatus ?? "unknown",
    ergonomicSpecs: rawDevice.ergonomicSpecs ?? buildErgonomicSpecs(rawDevice),
    normalizedSpecs: computed.normalizedSpecs,
    traitRatings: computed.traitRatings,
    traitConfidence: computed.traitConfidence,
    sourceUrls: rawDevice.sourceUrls ?? [],
    lastVerifiedAt: rawDevice.lastVerifiedAt ?? "2026-04-25",
    searchQueries:
      rawDevice.searchQueries ??
      [`${rawDevice.brand} ${rawDevice.model}`, rawDevice.displayName, ...aliases].slice(0, 6),
    strengths: getDeviceStrengths(deviceForStrengths),
    weaknesses: getDeviceWeaknesses(deviceForStrengths),
  };
}
