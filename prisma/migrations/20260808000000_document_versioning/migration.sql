-- 1. New enum for document categorization
CREATE TYPE "DocumentCategory" AS ENUM ('DRAWING', 'BOQ', 'CONTRACT', 'SITE_REPORT', 'PRESENTATION', 'OTHER');

-- 2. New columns on Document
ALTER TABLE "Document"
  ADD COLUMN "category" "DocumentCategory" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "isLatest" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "parentId" TEXT;

-- 3. uploadedById was a bare string with no FK — add the constraint now that
--    every existing row's uploadedById should already reference a real user.
--    If any orphaned rows exist (uploader was since deleted), this will fail
--    loudly rather than silently corrupting data — check before deploying:
--    SELECT id FROM "Document" d WHERE NOT EXISTS
--      (SELECT 1 FROM "User" u WHERE u.id = d."uploadedById");
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Document" ADD CONSTRAINT "Document_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Document_projectId_isLatest_idx" ON "Document"("projectId", "isLatest");
CREATE INDEX "Document_parentId_idx" ON "Document"("parentId");
