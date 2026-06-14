-- CreateEnum
CREATE TYPE "RevenueCategoryType" AS ENUM ('LEVY', 'PERMIT');

-- AlterTable
ALTER TABLE "revenue_categories" ADD COLUMN     "type" "RevenueCategoryType" NOT NULL DEFAULT 'LEVY';
