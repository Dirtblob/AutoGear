import { describe, expect, it } from "vitest";
import { catalogProducts } from "../../data/seeds/productCatalog";
import { searchCatalogProducts } from "./modelSearch";

describe("searchCatalogProducts", () => {
  it("ranks exact brand and model matches highest", () => {
    const results = searchCatalogProducts(catalogProducts, {
      text: "Logitech MX Master 3S",
      category: "mouse",
      limit: 3,
    });

    expect(results[0]?.product.id).toBe("catalog-mouse-logitech-mx-master-3s");
  });

  it("tolerates punctuation and case differences", () => {
    const results = searchCatalogProducts(catalogProducts, {
      text: "dell s2722-qc",
      category: "monitor",
      limit: 3,
    });

    expect(results[0]?.product.id).toBe("catalog-monitor-dell-s2722qc");
  });

  it("matches aliases within a selected category", () => {
    const results = searchCatalogProducts(catalogProducts, {
      text: "MBA M1",
      category: "laptop",
      limit: 3,
    });

    expect(results[0]?.product.id).toBe("catalog-laptop-apple-macbook-air-m1");
  });
});
