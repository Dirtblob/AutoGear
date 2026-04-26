import type { DeviceErgonomicSpecs } from "../devices/deviceTypes";
import type { PrivateRecommendationProfile, Product, UserProfile } from "./types";

export interface ErgonomicFitResult {
  fitScore: number;
  profileFieldsUsed: string[];
  missingDeviceSpecs: string[];
  reasons: string[];
}

const neutralFitScore = 68;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizedText(values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ").toLowerCase();
}

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function addField(fields: Set<string>, condition: boolean, field: string): void {
  if (condition) fields.add(field);
}

function addMissing(missing: Set<string>, specs: DeviceErgonomicSpecs | undefined, path: string): void {
  if (specs) missing.add(`device_catalog.ergonomicSpecs.${path}`);
  else missing.add("device_catalog.ergonomicSpecs");
}

function scoreRangeFit(input: {
  value: number | undefined;
  min: number | undefined;
  max: number | undefined;
  lowLabel: string;
  highLabel: string;
  missingMinPath: string;
  missingMaxPath: string;
  specs: DeviceErgonomicSpecs | undefined;
  missing: Set<string>;
  reasons: string[];
}): number {
  if (input.value === undefined) return 0;
  if (input.min === undefined) input.missing.add(`device_catalog.ergonomicSpecs.${input.missingMinPath}`);
  if (input.max === undefined) input.missing.add(`device_catalog.ergonomicSpecs.${input.missingMaxPath}`);
  if (input.min === undefined || input.max === undefined) return 0;

  if (input.value < input.min) {
    input.reasons.push(input.lowLabel);
    return -Math.min(24, 8 + (input.min - input.value) / 3);
  }

  if (input.value > input.max) {
    input.reasons.push(input.highLabel);
    return -Math.min(24, 8 + (input.value - input.max) / 3);
  }

  return 10;
}

function buildUseCaseText(profile: UserProfile, privateProfile?: PrivateRecommendationProfile | null): string {
  return normalizedText([
    privateProfile?.profession,
    profile.profession,
    ...(privateProfile?.primaryUseCases ?? []),
  ]);
}

function scoreMouseFit(
  product: Product,
  privateProfile: PrivateRecommendationProfile,
  fields: Set<string>,
  missing: Set<string>,
  reasons: string[],
): number {
  const specs = product.ergonomicSpecs;
  const mouse = specs?.mouse;
  let score = neutralFitScore;

  addField(fields, privateProfile.handLengthMm !== undefined, "user_private_profiles.handLengthMm");
  addField(fields, privateProfile.palmWidthMm !== undefined, "user_private_profiles.palmWidthMm");
  addField(fields, Boolean(privateProfile.gripStyle && privateProfile.gripStyle !== "unknown"), "user_private_profiles.gripStyle");
  addField(fields, privateProfile.dominantHand !== undefined, "user_private_profiles.dominantHand");

  if (!mouse) {
    addMissing(missing, specs, "mouse");
    return score;
  }

  score += scoreRangeFit({
    value: privateProfile.handLengthMm,
    min: mouse.recommendedHandLengthMinMm,
    max: mouse.recommendedHandLengthMaxMm,
    lowLabel: "Hand-length fit is weak because this mouse is likely too long.",
    highLabel: "Hand-length fit is weak because this mouse is likely too short.",
    missingMinPath: "mouse.recommendedHandLengthMinMm",
    missingMaxPath: "mouse.recommendedHandLengthMaxMm",
    specs,
    missing,
    reasons,
  });
  score += scoreRangeFit({
    value: privateProfile.palmWidthMm,
    min: mouse.recommendedPalmWidthMinMm,
    max: mouse.recommendedPalmWidthMaxMm,
    lowLabel: "Palm-width fit is weak because this mouse is likely too wide.",
    highLabel: "Palm-width fit is weak because this mouse is likely too narrow.",
    missingMinPath: "mouse.recommendedPalmWidthMinMm",
    missingMaxPath: "mouse.recommendedPalmWidthMaxMm",
    specs,
    missing,
    reasons,
  });

  if (privateProfile.gripStyle && privateProfile.gripStyle !== "unknown") {
    if (mouse.recommendedGripStyles?.length) {
      const gripStyles = mouse.recommendedGripStyles.map((style) => style.toLowerCase());
      if (gripStyles.includes(privateProfile.gripStyle)) {
        score += 10;
        reasons.push("Recommended grip style matches the private profile.");
      } else {
        score -= 8;
        reasons.push("Recommended grip style does not match the private profile.");
      }
    } else {
      missing.add("device_catalog.ergonomicSpecs.mouse.recommendedGripStyles");
    }
  }

  const weightGrams = mouse.weightGrams ?? specs.weightGrams;
  if (privateProfile.comfortPriorities.lightweight) {
    fields.add("user_private_profiles.comfortPriorities.lightweight");
    if (weightGrams === undefined) missing.add("device_catalog.ergonomicSpecs.mouse.weightGrams");
    else if (weightGrams <= 90) score += 8;
    else if (weightGrams <= 110) score += 4;
    else if (weightGrams >= 160) score -= 18;
    else if (weightGrams >= 130) score -= 12;
  }

  if (privateProfile.sensitivity.wristStrain) {
    fields.add("user_private_profiles.sensitivity.wristStrain");
    if (weightGrams === undefined) missing.add("device_catalog.ergonomicSpecs.mouse.weightGrams");
    else if (weightGrams >= 140) score -= 16;
    else if (weightGrams >= 120) score -= 8;
  }

  const handedness = String(product.normalizedSpecs?.handedness ?? product.normalizedSpecs?.handOrientation ?? "").toLowerCase();
  if (privateProfile.dominantHand === "left" && handedness.includes("right")) {
    score -= 22;
    reasons.push("Dominant-hand fit is weak because the model appears right-hand oriented.");
  } else if (privateProfile.dominantHand === "left" && handedness.includes("ambidextrous")) {
    score += 6;
  }

  return score;
}

function scoreKeyboardFit(
  product: Product,
  profile: UserProfile,
  privateProfile: PrivateRecommendationProfile | null | undefined,
  fields: Set<string>,
  missing: Set<string>,
  reasons: string[],
): number {
  const specs = product.ergonomicSpecs;
  const keyboard = specs?.keyboard;
  const text = buildUseCaseText(profile, privateProfile);
  const codesALot = hasAny(text, ["code", "coding", "developer", "software", "programming", "computer science", "cs student"]);
  let score = neutralFitScore;

  if (privateProfile?.profession) fields.add("user_private_profiles.profession");
  else fields.add("user_profiles.profession");
  addField(fields, Boolean(privateProfile?.primaryUseCases.length), "user_private_profiles.primaryUseCases");

  if (!keyboard) {
    addMissing(missing, specs, "keyboard");
    return codesALot ? score + 4 : score;
  }

  const wantsLowNoise = privateProfile?.comfortPriorities.lowNoise === true || privateProfile?.sensitivity.hearingSensitive === true;
  const wantsErgonomic = privateProfile?.sensitivity.wristStrain === true || privateProfile?.sensitivity.fingerFatigue === true;
  const wantsCompact = privateProfile?.comfortPriorities.compactSize === true;

  if (codesALot) {
    score += 8;
    if (keyboard.ergonomicLayout) score += 6;
    if (keyboard.actuationForceG !== undefined && keyboard.actuationForceG <= 55) score += 5;
    if (keyboard.soundLevel === "quiet" || keyboard.soundLevel === "silent") score += 4;
  }

  if (privateProfile?.comfortPriorities.lowNoise) fields.add("user_private_profiles.comfortPriorities.lowNoise");
  if (privateProfile?.sensitivity.hearingSensitive) fields.add("user_private_profiles.sensitivity.hearingSensitive");
  if (wantsLowNoise) {
    if (!keyboard.soundLevel) missing.add("device_catalog.ergonomicSpecs.keyboard.soundLevel");
    else if (keyboard.soundLevel === "loud") {
      score -= 24;
      reasons.push("Keyboard fit is penalized because loud switches conflict with low-noise or hearing sensitivity settings.");
    } else if (keyboard.soundLevel === "quiet" || keyboard.soundLevel === "silent") {
      score += 10;
    }
  }

  if (privateProfile?.sensitivity.wristStrain) fields.add("user_private_profiles.sensitivity.wristStrain");
  if (privateProfile?.sensitivity.fingerFatigue) fields.add("user_private_profiles.sensitivity.fingerFatigue");
  if (wantsErgonomic) {
    if (keyboard.ergonomicLayout === undefined) missing.add("device_catalog.ergonomicSpecs.keyboard.ergonomicLayout");
    else if (keyboard.ergonomicLayout) score += 14;
    else score -= 10;

    if (keyboard.actuationForceG === undefined) missing.add("device_catalog.ergonomicSpecs.keyboard.actuationForceG");
    else if (keyboard.actuationForceG > 65) score -= 8;
  }

  if (privateProfile?.comfortPriorities.compactSize) fields.add("user_private_profiles.comfortPriorities.compactSize");
  if (wantsCompact) {
    if (keyboard.widthMm === undefined) missing.add("device_catalog.ergonomicSpecs.keyboard.widthMm");
    else if (keyboard.widthMm <= 360) score += 8;
    else if (keyboard.widthMm >= 430) score -= 10;
  } else if (codesALot && keyboard.layout && /full|100|numpad/i.test(keyboard.layout)) {
    score += 3;
  }

  return score;
}

function scoreHeadphonesFit(
  product: Product,
  privateProfile: PrivateRecommendationProfile,
  fields: Set<string>,
  missing: Set<string>,
  reasons: string[],
): number {
  const specs = product.ergonomicSpecs;
  const headphones = specs?.headphones;
  let score = neutralFitScore;

  if (!headphones) {
    addMissing(missing, specs, "headphones");
    return score;
  }

  if (privateProfile.comfortPriorities.ergonomic) {
    fields.add("user_private_profiles.comfortPriorities.ergonomic");
    if (!headphones.clampForceLevel) missing.add("device_catalog.ergonomicSpecs.headphones.clampForceLevel");
    else if (headphones.clampForceLevel === "high") score -= 16;
    else if (headphones.clampForceLevel === "low") score += 6;
  }

  if (privateProfile.comfortPriorities.lightweight) {
    fields.add("user_private_profiles.comfortPriorities.lightweight");
    const weightGrams = headphones.weightGrams ?? specs.weightGrams;
    if (weightGrams === undefined) missing.add("device_catalog.ergonomicSpecs.headphones.weightGrams");
    else if (weightGrams <= 260) score += 8;
    else if (weightGrams >= 360) score -= 14;
  }

  if (privateProfile.comfortPriorities.lowNoise) {
    fields.add("user_private_profiles.comfortPriorities.lowNoise");
    fields.add("user_private_profiles.sensitivity.hearingSensitive");
    if (!headphones.noiseIsolationLevel) missing.add("device_catalog.ergonomicSpecs.headphones.noiseIsolationLevel");
    else if (!privateProfile.sensitivity.hearingSensitive) {
      score += headphones.noiseIsolationLevel === "high" ? 10 : headphones.noiseIsolationLevel === "medium" ? 6 : -4;
    } else {
      reasons.push("Hearing sensitivity is not treated as a request for maximum isolation; isolation is only boosted when low-noise preference is present without hearing sensitivity.");
    }
  }

  return score;
}

function scoreMonitorFit(
  product: Product,
  profile: UserProfile,
  privateProfile: PrivateRecommendationProfile | null | undefined,
  fields: Set<string>,
  missing: Set<string>,
): number {
  const specs = product.ergonomicSpecs;
  const monitor = specs?.monitor;
  const text = buildUseCaseText(profile, privateProfile);
  const productivity = hasAny(text, ["code", "coding", "developer", "software", "productivity", "spreadsheet", "design", "manager", "student"]);
  const gaming = hasAny(text, ["game", "gaming", "esports"]);
  let score = neutralFitScore;

  if (privateProfile?.profession) fields.add("user_private_profiles.profession");
  else fields.add("user_profiles.profession");
  addField(fields, Boolean(privateProfile?.primaryUseCases.length), "user_private_profiles.primaryUseCases");

  if (!monitor) {
    addMissing(missing, specs, "monitor");
    return score;
  }

  if (privateProfile?.comfortPriorities.largeDisplay) {
    fields.add("user_private_profiles.comfortPriorities.largeDisplay");
    if (monitor.screenSizeInches === undefined) missing.add("device_catalog.ergonomicSpecs.monitor.screenSizeInches");
    else if (productivity && monitor.screenSizeInches >= 27) score += 12;
    else if (monitor.screenSizeInches < 24) score -= 8;
  }

  if (gaming) {
    if (monitor.refreshRateHz === undefined) missing.add("device_catalog.ergonomicSpecs.monitor.refreshRateHz");
    else if (monitor.refreshRateHz >= 120) score += 12;
    else if (monitor.refreshRateHz < 75) score -= 8;
  }

  if (privateProfile?.comfortPriorities.ergonomic) {
    fields.add("user_private_profiles.comfortPriorities.ergonomic");
    if (monitor.standHeightAdjustable === undefined) missing.add("device_catalog.ergonomicSpecs.monitor.standHeightAdjustable");
    if (monitor.vesaMount === undefined) missing.add("device_catalog.ergonomicSpecs.monitor.vesaMount");
    if (monitor.standHeightAdjustable || monitor.vesaMount) score += 10;
    else score -= 8;
  }

  return score;
}

export function scoreErgonomicFit(input: {
  product: Product;
  profile: UserProfile;
  privateProfile?: PrivateRecommendationProfile | null;
}): ErgonomicFitResult {
  const fields = new Set<string>();
  const missing = new Set<string>();
  const reasons: string[] = [];
  let score = neutralFitScore;

  if (input.product.category === "keyboard" || input.product.category === "monitor") {
    score = input.product.category === "keyboard"
      ? scoreKeyboardFit(input.product, input.profile, input.privateProfile, fields, missing, reasons)
      : scoreMonitorFit(input.product, input.profile, input.privateProfile, fields, missing);
  } else if (input.privateProfile) {
    if (input.product.category === "mouse") {
      score = scoreMouseFit(input.product, input.privateProfile, fields, missing, reasons);
    } else if (input.product.category === "headphones") {
      score = scoreHeadphonesFit(input.product, input.privateProfile, fields, missing, reasons);
    }
  } else if (["mouse", "headphones"].includes(input.product.category)) {
    if (!input.product.ergonomicSpecs) missing.add("device_catalog.ergonomicSpecs");
    if (input.product.category === "mouse" && input.profile.problems.includes("wrist_pain")) {
      score += input.product.solves.includes("wrist_pain") ? 8 : 4;
    }
  }

  return {
    fitScore: clampScore(score),
    profileFieldsUsed: Array.from(fields).sort(),
    missingDeviceSpecs: Array.from(missing).sort(),
    reasons: Array.from(new Set(reasons)).slice(0, 3),
  };
}
