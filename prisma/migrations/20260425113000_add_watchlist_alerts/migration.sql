CREATE TABLE "WatchlistAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userProfileId" TEXT NOT NULL,
    "savedProductId" TEXT NOT NULL,
    "productModelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "oldPriceCents" INTEGER,
    "newPriceCents" INTEGER NOT NULL,
    "thresholdCents" INTEGER,
    "scoreAtAlert" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "url" TEXT,
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchlistAlert_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WatchlistAlert_savedProductId_fkey" FOREIGN KEY ("savedProductId") REFERENCES "SavedProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "WatchlistAlert_userProfileId_seen_createdAt_idx" ON "WatchlistAlert"("userProfileId", "seen", "createdAt");
CREATE INDEX "WatchlistAlert_savedProductId_createdAt_idx" ON "WatchlistAlert"("savedProductId", "createdAt");
CREATE INDEX "WatchlistAlert_productModelId_createdAt_idx" ON "WatchlistAlert"("productModelId", "createdAt");
