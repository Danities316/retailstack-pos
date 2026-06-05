-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "InventoryLog" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "status" TEXT;

-- CreateTable
CREATE TABLE "SyncChange" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "operation" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncChange_tenantId_entityType_timestamp_idx" ON "SyncChange"("tenantId", "entityType", "timestamp");

-- CreateIndex
CREATE INDEX "SyncChange_tenantId_entityType_entityId_version_idx" ON "SyncChange"("tenantId", "entityType", "entityId", "version");

-- AddForeignKey
ALTER TABLE "SyncChange" ADD CONSTRAINT "SyncChange_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
