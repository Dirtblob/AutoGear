-- CreateTable
CREATE TABLE "ApiUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PriceRefreshPolicy" (
    "provider" TEXT NOT NULL PRIMARY KEY,
    "monthlyHardLimit" INTEGER NOT NULL DEFAULT 950,
    "dailySoftLimit" INTEGER NOT NULL DEFAULT 30,
    "minuteHardLimit" INTEGER NOT NULL DEFAULT 8,
    "reserveMonthlyCalls" INTEGER NOT NULL DEFAULT 50,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RecentlyViewedProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userProfileId" TEXT NOT NULL,
    "productModelId" TEXT NOT NULL,
    "viewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecentlyViewedProduct_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ApiUsage_provider_updatedAt_idx" ON "ApiUsage"("provider", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiUsage_provider_periodType_periodKey_key" ON "ApiUsage"("provider", "periodType", "periodKey");

-- CreateIndex
CREATE INDEX "RecentlyViewedProduct_userProfileId_viewedAt_idx" ON "RecentlyViewedProduct"("userProfileId", "viewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecentlyViewedProduct_userProfileId_productModelId_key" ON "RecentlyViewedProduct"("userProfileId", "productModelId");
