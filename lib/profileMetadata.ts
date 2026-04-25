import type { RecommendationInput } from "./recommendation/types";

type KnownDeviceType = NonNullable<RecommendationInput["deviceType"]>;

const validDeviceTypes = new Set<KnownDeviceType>(["desktop", "laptop", "tablet", "unknown"]);

function parseJsonRecord(value: string | null): Record<string, unknown> {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export interface ProfileMetadata {
  rawConstraints: Record<string, unknown>;
  demoScenarioId: string | null;
  ports: string[];
  deviceType: KnownDeviceType;
}

export function parseProfileMetadata(roomConstraints: string | null): ProfileMetadata {
  const rawConstraints = parseJsonRecord(roomConstraints);
  const explicitDeviceType =
    typeof rawConstraints.deviceType === "string" && validDeviceTypes.has(rawConstraints.deviceType as KnownDeviceType)
      ? (rawConstraints.deviceType as KnownDeviceType)
      : null;
  const operatingSystem =
    typeof rawConstraints.operatingSystem === "string" ? rawConstraints.operatingSystem.trim().toLowerCase() : "";
  const ports = normalizeStringArray(rawConstraints.laptopPorts ?? rawConstraints.ports);
  const deviceType =
    explicitDeviceType ??
    (operatingSystem === "macos" || operatingSystem === "windows" || operatingSystem === "linux" || operatingSystem === "chromeos"
      ? "laptop"
      : rawConstraints.portableSetup === true
        ? "laptop"
        : "unknown");

  return {
    rawConstraints,
    demoScenarioId: typeof rawConstraints.demoScenarioId === "string" ? rawConstraints.demoScenarioId : null,
    ports,
    deviceType,
  };
}
