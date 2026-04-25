import { describe, expect, it } from "vitest";
import {
  normalizeChairSpecs,
  normalizeKeyboardSpecs,
  normalizeLaptopSpecs,
  normalizeMonitorSpecs,
  normalizeMouseSpecs,
} from "./specNormalizer";

describe("spec normalizer", () => {
  it("normalizes laptop RAM strings", () => {
    expect(normalizeLaptopSpecs("8 GB").ramGb).toBe(8);
    expect(normalizeLaptopSpecs("8GB").ramGb).toBe(8);
    expect(normalizeLaptopSpecs("8 gb unified memory").ramGb).toBe(8);
  });

  it("normalizes monitor resolution aliases", () => {
    expect(normalizeMonitorSpecs("2560 x 1440").resolutionClass).toBe("qhd");
    expect(normalizeMonitorSpecs("QHD").resolutionClass).toBe("qhd");
    expect(normalizeMonitorSpecs("1440p").resolutionClass).toBe("qhd");
    expect(normalizeMonitorSpecs("3840 x 2160").resolutionClass).toBe("4k");
    expect(normalizeMonitorSpecs("4K").resolutionClass).toBe("4k");
    expect(normalizeMonitorSpecs("UHD").resolutionClass).toBe("4k");
  });

  it("normalizes common port aliases", () => {
    expect(normalizeLaptopSpecs({ ports: ["USB-C", "Thunderbolt", "TB4"] }).ports).toEqual([
      "usb-c",
      "thunderbolt",
    ]);
  });

  it("extracts ergonomic mouse and support flags", () => {
    expect(normalizeMouseSpecs("vertical ergonomic mouse")).toMatchObject({
      ergonomic: true,
      vertical: true,
    });
    expect(normalizeKeyboardSpecs("loud clicky blue switch keyboard").loud).toBe(true);
    expect(normalizeChairSpecs("basic chair without lumbar support").lumbarSupport).toBe(false);
  });
});
