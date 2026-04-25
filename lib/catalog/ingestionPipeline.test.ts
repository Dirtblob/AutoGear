import { describe, expect, it } from "vitest";
import {
  catalogProductDedupeKey,
  deduplicateCatalogProductDetails,
  normalizeCatalogCategory,
  normalizeCatalogProductDetails,
  normalizeCatalogText,
} from "./ingestionPipeline";
import type { CatalogProductDetails } from "./providers/types";

function product(overrides: Partial<CatalogProductDetails> = {}): CatalogProductDetails {
  return {
    brand: "Dell",
    model: "S2722QC",
    displayName: "Dell S2722QC 27-inch 4K USB-C Monitor",
    category: "monitor",
    specs: { resolution: "4K UHD" },
    aliases: ["Dell 27 USB-C"],
    source: "manual",
    ...overrides,
  };
}

describe("catalog ingestion normalization", () => {
  it("normalizes text for provider matching", () => {
    expect(normalizeCatalogText("Dell S2722-QC & USB-C")).toBe("dell s2722 qc and usb c");
  });

  it("normalizes supported category spellings", () => {
    expect(normalizeCatalogCategory("Laptop Stand")).toBe("laptop_stand");
    expect(normalizeCatalogCategory("desk-lamp")).toBe("desk_lamp");
    expect(normalizeCatalogCategory("not a category")).toBeNull();
  });

  it("builds stable dedupe keys from brand model and category", () => {
    const first = product({ brand: " Dell ", model: "S2722-QC" });
    const second = product({ brand: "dell", model: "s2722qc" });

    expect(catalogProductDedupeKey(first)).toBe(catalogProductDedupeKey(second));
  });

  it("normalizes details without leaking empty aliases or duplicate images", () => {
    const normalized = normalizeCatalogProductDetails(
      product({
        aliases: ["Dell S2722QC 27-inch 4K USB-C Monitor", "  S2722QC  ", ""],
        images: ["https://example.com/a.jpg", "https://example.com/a.jpg", ""],
      }),
    );

    expect(normalized.aliases).toEqual(["S2722QC"]);
    expect(normalized.images).toEqual(["https://example.com/a.jpg"]);
  });
});

describe("catalog ingestion deduplication", () => {
  it("deduplicates by normalized brand model and category", () => {
    const products = deduplicateCatalogProductDetails([
      product({ specs: { resolution: "4K UHD", usbCWatts: 65 } }),
      product({
        brand: "dell",
        model: "S2722-QC",
        displayName: "Dell S2722QC Monitor",
        specs: { refreshRateHz: 60, usbCWatts: 65 },
        aliases: ["S2722QC"],
        source: "static",
      }),
    ]);

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      brand: "Dell",
      model: "S2722QC",
      category: "monitor",
      specs: {
        resolution: "4K UHD",
        refreshRateHz: 60,
        usbCWatts: 65,
      },
      aliases: ["Dell 27 USB-C", "S2722QC"],
    });
  });

  it("keeps same model names separate across categories", () => {
    const products = deduplicateCatalogProductDetails([
      product({ category: "monitor" }),
      product({ category: "webcam" }),
    ]);

    expect(products).toHaveLength(2);
  });
});
