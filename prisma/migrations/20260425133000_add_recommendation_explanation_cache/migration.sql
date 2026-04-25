CREATE TABLE "RecommendationExplanationCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recommendationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "outputJson" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "RecommendationExplanationCache_recommendationId_productId_inputHash_key" ON "RecommendationExplanationCache"("recommendationId", "productId", "inputHash");

CREATE INDEX "RecommendationExplanationCache_productId_updatedAt_idx" ON "RecommendationExplanationCache"("productId", "updatedAt");

CREATE INDEX "RecommendationExplanationCache_source_updatedAt_idx" ON "RecommendationExplanationCache"("source", "updatedAt");
