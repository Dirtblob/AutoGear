-- CreateTable
CREATE TABLE "TrainingExample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inputJson" TEXT NOT NULL,
    "targetOutputJson" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "qualityRating" INTEGER,
    "notes" TEXT
);

-- CreateIndex
CREATE INDEX "TrainingExample_createdAt_idx" ON "TrainingExample"("createdAt");

-- CreateIndex
CREATE INDEX "TrainingExample_source_createdAt_idx" ON "TrainingExample"("source", "createdAt");
