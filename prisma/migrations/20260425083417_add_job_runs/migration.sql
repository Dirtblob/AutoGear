-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "productsEligible" INTEGER NOT NULL,
    "productsChecked" INTEGER NOT NULL,
    "productsSkippedDueToQuota" INTEGER NOT NULL,
    "apiCallsUsed" INTEGER NOT NULL,
    "remainingMonthlyCalls" INTEGER NOT NULL,
    "remainingDailyCalls" INTEGER NOT NULL,
    "remainingMinuteCalls" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "JobRun_jobName_createdAt_idx" ON "JobRun"("jobName", "createdAt");
