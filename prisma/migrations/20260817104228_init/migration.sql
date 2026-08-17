-- CreateEnum
CREATE TYPE "ProjectLifecycleEventType" AS ENUM ('ARCHIVED', 'RESTORED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedById" TEXT,
ADD COLUMN     "restoredAt" TIMESTAMP(3),
ADD COLUMN     "restoredById" TEXT;

-- CreateTable
CREATE TABLE "ProjectLifecycleEvent" (
    "id" TEXT NOT NULL,
    "type" "ProjectLifecycleEventType" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,

    CONSTRAINT "ProjectLifecycleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectLifecycleEvent_projectId_idx" ON "ProjectLifecycleEvent"("projectId");

-- CreateIndex
CREATE INDEX "ProjectLifecycleEvent_performedById_idx" ON "ProjectLifecycleEvent"("performedById");

-- CreateIndex
CREATE INDEX "ProjectLifecycleEvent_type_idx" ON "ProjectLifecycleEvent"("type");

-- CreateIndex
CREATE INDEX "ProjectLifecycleEvent_createdAt_idx" ON "ProjectLifecycleEvent"("createdAt");

-- CreateIndex
CREATE INDEX "Project_supervisorId_idx" ON "Project"("supervisorId");

-- CreateIndex
CREATE INDEX "Project_archivedById_idx" ON "Project"("archivedById");

-- CreateIndex
CREATE INDEX "Project_restoredById_idx" ON "Project"("restoredById");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_restoredById_fkey" FOREIGN KEY ("restoredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLifecycleEvent" ADD CONSTRAINT "ProjectLifecycleEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLifecycleEvent" ADD CONSTRAINT "ProjectLifecycleEvent_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
