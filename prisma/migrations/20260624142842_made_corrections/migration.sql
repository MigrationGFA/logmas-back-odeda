-- DropForeignKey
ALTER TABLE "permits" DROP CONSTRAINT "permits_configId_fkey";

-- AlterTable
ALTER TABLE "permits" ALTER COLUMN "configId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "permits" ADD CONSTRAINT "permits_configId_fkey" FOREIGN KEY ("configId") REFERENCES "permit_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
