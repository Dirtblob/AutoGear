import { describe, expect, it } from "vitest";
import { summarizeCatalogHealth } from "./dashboard";

describe("summarizeCatalogHealth", () => {
  it("counts products missing specs or search queries", () => {
    const summary = summarizeCatalogHealth([
      {
        id: "1",
        category: "monitor",
        brand: "Acme",
        model: "A1",
        displayName: "Acme A1",
        priceBand: "budget",
        estimatedPriceCents: 10000,
        features: { sizeInches: 27 },
        bestFor: [],
        badFor: [],
        solvesProblems: [],
        constraints: {},
        scoringTags: {
          productivity: 1,
          ergonomics: 1,
          portability: 1,
          value: 1,
          comfort: 1,
          accessibility: 1,
          focus: 1,
          performance: 1,
        },
        searchQueries: ["Acme A1"],
        name: "Acme A1",
        priceUsd: 100,
        shortDescription: "",
        strengths: [],
        solves: [],
        aspirational: false,
        scoreHints: {
          comfort: 1,
          productivity: 1,
          accessibility: 1,
          value: 1,
        },
      },
      {
        id: "2",
        category: "monitor",
        brand: "Acme",
        model: "A2",
        displayName: "Acme A2",
        priceBand: "budget",
        estimatedPriceCents: 12000,
        features: {},
        bestFor: [],
        badFor: [],
        solvesProblems: [],
        constraints: {},
        scoringTags: {
          productivity: 1,
          ergonomics: 1,
          portability: 1,
          value: 1,
          comfort: 1,
          accessibility: 1,
          focus: 1,
          performance: 1,
        },
        searchQueries: [],
        name: "Acme A2",
        priceUsd: 120,
        shortDescription: "",
        strengths: [],
        solves: [],
        aspirational: false,
        scoreHints: {
          comfort: 1,
          productivity: 1,
          accessibility: 1,
          value: 1,
        },
      },
    ]);

    expect(summary).toEqual({
      productCount: 2,
      missingSpecsCount: 1,
      missingSearchQueriesCount: 1,
    });
  });
});
