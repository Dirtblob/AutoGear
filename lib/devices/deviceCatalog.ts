import type { CatalogProduct } from "@/lib/catalog/catalogTypes";
import { rawDeviceSeedData } from "@/data/seeds/deviceSeedData";
import type { CatalogDevice, DeviceValidationIssue, RawCatalogDevice } from "./deviceTypes";
import { deviceToInventorySpecs } from "./deviceInventorySpecs";
import { enrichCatalogDevice, precomputeTraitRatings } from "./traitPrecompute";

function dedupeDevices(devices: CatalogDevice[]): CatalogDevice[] {
  const seen = new Map<string, CatalogDevice>();

  for (const device of devices) {
    const key = `${device.category}:${device.brand.toLowerCase()}:${device.model.toLowerCase()}`;
    if (!seen.has(key)) seen.set(key, device);
  }

  return [...seen.values()];
}

export const catalogDevices: CatalogDevice[] = dedupeDevices(rawDeviceSeedData.map(enrichCatalogDevice));

export function findDeviceById(id: string | null | undefined): CatalogDevice | undefined {
  if (!id) return undefined;
  return catalogDevices.find((device) => device.id === id);
}

export function recomputeDeviceTraits(device: RawCatalogDevice | CatalogDevice): CatalogDevice {
  const computed = precomputeTraitRatings(device);
  return {
    ...enrichCatalogDevice({
      ...device,
      normalizedSpecs: computed.normalizedSpecs,
      traitRatings: computed.traitRatings,
      traitConfidence: computed.traitConfidence,
    }),
  };
}

export function deviceToCatalogProduct(device: CatalogDevice): CatalogProduct {
  return {
    id: device.id,
    category: device.category as CatalogProduct["category"],
    brand: device.brand,
    model: device.model,
    displayName: device.displayName,
    aliases: device.aliases,
    releaseYear: device.releaseYear,
    specs: deviceToInventorySpecs(device) as CatalogProduct["specs"],
    source: "manual",
    sourceUrl: device.sourceUrls[0],
    confidence: device.traitConfidence,
    updatedAt: device.lastVerifiedAt,
  };
}

export function validateDeviceCatalog(devices: CatalogDevice[] = catalogDevices): DeviceValidationIssue[] {
  const issues: DeviceValidationIssue[] = [];
  const duplicateKeys = new Map<string, string>();

  for (const device of devices) {
    const requiredFields = [device.id, device.category, device.brand, device.model, device.displayName];
    if (requiredFields.some((field) => !String(field ?? "").trim())) {
      issues.push({ id: device.id || "unknown", severity: "error", message: "Missing id/category/brand/model/displayName." });
    }

    if (!device.normalizedSpecs || Object.keys(device.normalizedSpecs).length === 0) {
      issues.push({ id: device.id, severity: "error", message: "Missing normalized specs." });
    }

    if (!device.traitRatings || Object.keys(device.traitRatings).length === 0) {
      issues.push({ id: device.id, severity: "error", message: "Missing trait ratings." });
    }

    for (const [trait, value] of Object.entries(device.traitRatings ?? {})) {
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        issues.push({ id: device.id, severity: "error", message: `Trait ${trait} is outside 0-100.` });
      }
    }

    const aliases = new Set(device.aliases.map((alias) => alias.toLowerCase()));
    if (!aliases.has(device.model.toLowerCase()) || !aliases.has(device.displayName.toLowerCase())) {
      issues.push({ id: device.id, severity: "warning", message: "Aliases should include common model and display names." });
    }

    const duplicateKey = `${device.category}:${device.brand.toLowerCase()}:${device.model.toLowerCase()}`;
    const firstDuplicate = duplicateKeys.get(duplicateKey);
    if (firstDuplicate) {
      issues.push({
        id: device.id,
        severity: "error",
        message: `Duplicate brand+model+category with ${firstDuplicate}.`,
      });
    } else {
      duplicateKeys.set(duplicateKey, device.id);
    }
  }

  return issues;
}

export function deviceCatalogJson(devices: CatalogDevice[] = catalogDevices): string {
  return JSON.stringify(devices, null, 2);
}
