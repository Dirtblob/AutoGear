import { describe, expect, it } from "vitest";
import { catalogDevices, validateDeviceCatalog } from "./deviceCatalog";
import { searchDevices } from "./deviceSearch";

describe("device search", () => {
  it("finds devices by alias and fuzzy model names", () => {
    const aliasResults = searchDevices(catalogDevices, { text: "MBA M1", category: "laptop", limit: 3 });
    const fuzzyResults = searchDevices(catalogDevices, { text: "mx master 3 s", category: "mouse", limit: 3 });

    expect(aliasResults[0]?.device.model).toBe("MacBook Air M1 8GB");
    expect(fuzzyResults[0]?.device.model).toBe("MX Master 3S");
  });

  it("keeps every precomputed trait rating in the 0-100 range", () => {
    const traitValues = catalogDevices.flatMap((device) => Object.values(device.traitRatings));

    expect(catalogDevices.length).toBeGreaterThanOrEqual(150);
    expect(traitValues.every((value) => value >= 0 && value <= 100)).toBe(true);
    expect(validateDeviceCatalog().filter((issue) => issue.severity === "error")).toEqual([]);
  });
});
