/*
  Warnings:

  - You are about to drop the `Refund` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Transaction` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[phoneNumber]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Refund" DROP CONSTRAINT "Refund_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_saleId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_tenantId_fkey";

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "productImage" SET DEFAULT 'string';

-- DropTable
DROP TABLE "Refund";

-- DropTable
DROP TABLE "Transaction";

-- DropEnum
DROP TYPE "RefundStatus";

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");
