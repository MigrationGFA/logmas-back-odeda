/*
  Warnings:

  - You are about to drop the column `category` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `levy_configs` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `permit_configs` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `permits` table. All the data in the column will be lost.
  - Added the required column `categoryId` to the `invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `categoryId` to the `levy_configs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `categoryId` to the `permit_configs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `categoryId` to the `permits` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "category",
ADD COLUMN     "categoryId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "levy_configs" DROP COLUMN "category",
ADD COLUMN     "categoryId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "permit_configs" DROP COLUMN "category",
ADD COLUMN     "categoryId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "permits" DROP COLUMN "category",
ADD COLUMN     "categoryId" TEXT NOT NULL;

-- DropEnum
DROP TYPE "RevenueCategory";

-- CreateTable
CREATE TABLE "revenue_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "revenue_categories_name_key" ON "revenue_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "revenue_categories_slug_key" ON "revenue_categories"("slug");

-- AddForeignKey
ALTER TABLE "permit_configs" ADD CONSTRAINT "permit_configs_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "revenue_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits" ADD CONSTRAINT "permits_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "revenue_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "levy_configs" ADD CONSTRAINT "levy_configs_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "revenue_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "revenue_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
