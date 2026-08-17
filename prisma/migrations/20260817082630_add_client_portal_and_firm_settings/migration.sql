-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "lastPortalLoginAt" TIMESTAMP(3),
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "portalEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ClientComment" ADD COLUMN     "viaPortal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "clientVisible" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "FirmSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "firmName" TEXT NOT NULL DEFAULT 'Architect Hub',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Client_email_idx" ON "Client"("email");
