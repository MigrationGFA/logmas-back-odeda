/*
  Warnings:

  - You are about to drop the column `permitType` on the `permits` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[businessName]` on the table `businesses` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `businesses` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `category` to the `complaints` table without a default value. This is not possible if the table is not empty.
  - Added the required column `configId` to the `permits` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "complaints" ADD COLUMN     "category" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "permits" DROP COLUMN "permitType",
ADD COLUMN     "configId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "permit_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "baseAmount" DECIMAL(12,2) NOT NULL,
    "category" "RevenueCategory" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permit_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permit_configs_code_key" ON "permit_configs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_businessName_key" ON "businesses"("businessName");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_email_key" ON "businesses"("email");

-- AddForeignKey
ALTER TABLE "permits" ADD CONSTRAINT "permits_configId_fkey" FOREIGN KEY ("configId") REFERENCES "permit_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
