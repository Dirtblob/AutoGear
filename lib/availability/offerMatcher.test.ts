import { describe, expect, it } from "vitest";
import { scoreOfferConfidence } from "./offerMatcher";
import type { AvailabilityProductModel } from "./types";

function productModel(overrides: Partial<AvailabilityProductModel> = {}): AvailabilityProductModel {
  return {
    id: "headphones-sony-wh1000xm4",
    brand: "Sony",
    model: "WH-1000XM4",
    displayName: "Sony WH-1000XM4 Noise-Canceling Headphones",
    category: "headphones",
    allowUsed: true,
    ...overrides,
  };
}

describe("scoreOfferConfidence", () => {
  it("rewards an exact model match in the title", () => {
    const confidence = scoreOfferConfidence(productModel(), {
      title: "Sony WH-1000XM4 Noise-Canceling Headphones",
      brand: "Sony",
      category: "headphones",
      condition: "new",
    });

    expect(confidence).toBe(95);
  });

  it("rejects a wrong model variant even when the brand matches", () => {
    const confidence = scoreOfferConfidence(productModel(), {
      title: "Sony WH-1000XM5 Noise-Canceling Headphones",
      brand: "Sony",
      category: "headphones",
      condition: "new",
    });

    expect(confidence).toBeLessThan(60);
  });
});
