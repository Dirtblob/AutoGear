import { describe, expect, it } from "vitest";
import {
  buildHackathonDemoPriorityList,
  buildHackathonDemoRecommendationInput,
} from "./demoMode";
import { buildRecommendationRejections } from "./rejections";

describe("buildRecommendationRejections", () => {
  it("explains why tempting products were deprioritized", () => {
    const input = buildHackathonDemoRecommendationInput();
    const priorityList = buildHackathonDemoPriorityList(input);
    const rejections = buildRecommendationRejections(input, {
      recommendedCategoryIds: new Set(priorityList.slice(0, 4).map((item) => item.category)),
      recommendedProductIds: new Set(
        priorityList
          .slice(0, 4)
          .flatMap((item) => (item.recommendation ? [item.recommendation.product.id] : [])),
      ),
      maxItems: 4,
    });

    const laptop = rejections.find((item) => item.item === "New laptop");
    const studioDisplay = rejections.find((item) => item.item === "Apple Studio Display");
    const mechanicalKeyboard = rejections.find((item) => item.item === "Mechanical keyboard");

    expect(laptop?.reason).toContain("screen space and ergonomics");
    expect(laptop?.wouldRecommendIf).toContain("build times");

    expect(studioDisplay?.reason).toContain("$300 budget");
    expect(studioDisplay?.wouldRecommendIf).toContain("$1000");

    expect(mechanicalKeyboard?.reason).toContain("quiet products");
    expect(mechanicalKeyboard?.wouldRecommendIf).toContain("quiet switches");
  });
});
