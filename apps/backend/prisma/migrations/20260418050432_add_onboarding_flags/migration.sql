-- AlterTable
ALTER TABLE "Tenant" DROP COLUMN "loyverseApiKey",
ADD COLUMN     "hasInvitedUser" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasProduct" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasSale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3);


-- Example: Set hasProduct to true if the tenant already has products
UPDATE "Tenant" 
SET "hasProduct" = true 
WHERE id IN (SELECT DISTINCT "tenantId" FROM "Product");

-- Example: Set hasSale to true if the tenant already has sales
UPDATE "Tenant" 
SET "hasSale" = true 
WHERE id IN (SELECT DISTINCT "tenantId" FROM "Sale");

-- Example: Set onboardingCompletedAt to the current timestamp if the tenant has completed onboarding
UPDATE "Tenant" 
SET "onboardingCompletedAt" = NOW()
WHERE "hasInvitedUser" = true AND "hasProduct" = true AND "hasSale" = true;



ALTER TABLE "User" ADD COLUMN     "isFirstLogin" BOOLEAN NOT NULL DEFAULT true;


UPDATE "User" SET "isFirstLogin" = false;
