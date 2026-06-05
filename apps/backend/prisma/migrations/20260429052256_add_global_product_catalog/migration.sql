-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "globalCatalogId" TEXT;

-- CreateTable
CREATE TABLE "GlobalProductCatalog" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "productName" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "contributedByTenantId" TEXT,

    CONSTRAINT "GlobalProductCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GlobalProductCatalog_barcode_key" ON "GlobalProductCatalog"("barcode");

-- CreateIndex
CREATE INDEX "GlobalProductCatalog_barcode_idx" ON "GlobalProductCatalog"("barcode");

-- CreateIndex
CREATE INDEX "GlobalProductCatalog_productName_idx" ON "GlobalProductCatalog"("productName");

-- CreateIndex
CREATE INDEX "GlobalProductCatalog_contributedByTenantId_idx" ON "GlobalProductCatalog"("contributedByTenantId");

-- CreateIndex
CREATE INDEX "Product_globalCatalogId_idx" ON "Product"("globalCatalogId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_globalCatalogId_fkey" FOREIGN KEY ("globalCatalogId") REFERENCES "GlobalProductCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalProductCatalog" ADD CONSTRAINT "GlobalProductCatalog_contributedByTenantId_fkey" FOREIGN KEY ("contributedByTenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
