import type { CatalogDevice } from "./deviceTypes";
import { summarizeDeviceSpecs } from "./deviceTraits";

export function deviceToInventorySpecs(device: CatalogDevice): Record<string, unknown> {
  return {
    ...device.specs,
    catalogDeviceId: device.id,
    ergonomicSpecs: device.ergonomicSpecs,
    normalizedSpecs: device.normalizedSpecs,
    traitRatings: device.traitRatings,
    traitConfidence: device.traitConfidence,
    releaseYear: device.releaseYear,
    lifecycleStatus: device.lifecycleStatus,
    shortSpecs: summarizeDeviceSpecs(device),
  };
}
