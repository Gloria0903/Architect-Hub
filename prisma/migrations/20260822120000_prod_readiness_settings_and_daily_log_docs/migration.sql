-- Org structure: add the "Senior Architect" role called for in the Phase 1
-- proposal (creates/reassigns projects, firm-wide oversight) â€” distinct
-- from ADMIN (full access) and ARCHITECT (assigned-projects only).
ALTER TYPE "Role" ADD VALUE 'SENIOR_ARCHITECT';

-- Firm profile: replace hardcoded settings-page values with real, editable columns
ALTER TABLE "FirmSettings" ADD COLUMN "country"  TEXT NOT NULL DEFAULT 'Kenya';
ALTER TABLE "FirmSettings" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'KES';
ALTER TABLE "FirmSettings" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Africa/Nairobi';
ALTER TABLE "FirmSettings" ADD COLUMN "requireMfa" BOOLEAN NOT NULL DEFAULT false;

-- Per-user notification preferences (replaces the non-functional settings toggles)
ALTER TABLE "User" ADD COLUMN "notifyLogReminder"   BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "notifyProjectDelay"  BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "notifyClientComment" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "notifyWeeklySummary" BOOLEAN NOT NULL DEFAULT true;

-- Link documents to the daily log entry they were attached during (nullable â€”
-- documents uploaded outside the daily-log flow, e.g. contracts, are unaffected)
ALTER TABLE "Document" ADD COLUMN "dailyLogId" TEXT;

CREATE INDEX "Document_dailyLogId_idx" ON "Document"("dailyLogId");

ALTER TABLE "Document" ADD CONSTRAINT "Document_dailyLogId_fkey"
  FOREIGN KEY ("dailyLogId") REFERENCES "DailyLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
