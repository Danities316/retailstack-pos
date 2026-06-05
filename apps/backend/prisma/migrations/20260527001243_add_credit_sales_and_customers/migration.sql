/*
  Warnings:

  - You are about to drop the `EmailTemplate` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'CARD', 'OTHER', 'CREDIT');

-- DropForeignKey
ALTER TABLE "EmailTemplate" DROP CONSTRAINT "EmailTemplate_tenantId_fkey";

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "saleNote" TEXT;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "vatEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vatRate" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
ALTER COLUMN "currency" SET DEFAULT 'NGN';

-- DropTable
DROP TABLE "EmailTemplate";

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "totalOwed" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditSale" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "amountPaid" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "balance" DECIMAL(65,30) NOT NULL,
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "providerRefundId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_tenantId_idx" ON "Customer"("tenantId");

-- CreateIndex
CREATE INDEX "Customer_tenantId_name_idx" ON "Customer"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CreditSale_saleId_key" ON "CreditSale"("saleId");

-- CreateIndex
CREATE INDEX "CreditSale_tenantId_idx" ON "CreditSale"("tenantId");

-- CreateIndex
CREATE INDEX "CreditSale_customerId_idx" ON "CreditSale"("customerId");

-- CreateIndex
CREATE INDEX "CreditSale_tenantId_settled_idx" ON "CreditSale"("tenantId", "settled");

-- CreateIndex
CREATE INDEX "Sale_userId_idx" ON "Sale"("userId");

-- CreateIndex
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");

-- CreateIndex
CREATE INDEX "Sale_tenantId_createdAt_idx" ON "Sale"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditSale" ADD CONSTRAINT "CreditSale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditSale" ADD CONSTRAINT "CreditSale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditSale" ADD CONSTRAINT "CreditSale_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
