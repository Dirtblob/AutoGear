-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT,
    "ageRange" TEXT,
    "profession" TEXT NOT NULL,
    "budgetCents" INTEGER NOT NULL,
    "spendingStyle" TEXT NOT NULL,
    "usedItemsOkay" BOOLEAN NOT NULL DEFAULT true,
    "accessibilityNeeds" TEXT NOT NULL,
    "preferences" TEXT NOT NULL,
    "problems" TEXT NOT NULL,
    "roomConstraints" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userProfileId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "exactModel" TEXT,
    "catalogProductId" TEXT,
    "specsJson" TEXT,
    "condition" TEXT NOT NULL,
    "ageYears" INTEGER,
    "notes" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryItem_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userProfileId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "productModelId" TEXT,
    "score" INTEGER NOT NULL,
    "priority" TEXT NOT NULL,
    "problemSolved" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Recommendation_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userProfileId" TEXT NOT NULL,
    "productModelId" TEXT NOT NULL,
    "targetPriceCents" INTEGER,
    "notifyThreshold" INTEGER NOT NULL DEFAULT 80,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedProduct_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AvailabilitySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productModelId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Availability check',
    "available" BOOLEAN NOT NULL,
    "priceCents" INTEGER,
    "url" TEXT,
    "condition" TEXT,
    "confidence" REAL,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "InventoryItem_catalogProductId_idx" ON "InventoryItem"("catalogProductId");

-- CreateIndex
CREATE INDEX "AvailabilitySnapshot_productModelId_checkedAt_idx" ON "AvailabilitySnapshot"("productModelId", "checkedAt");

-- CreateIndex
CREATE INDEX "AvailabilitySnapshot_provider_checkedAt_idx" ON "AvailabilitySnapshot"("provider", "checkedAt");
