-- DropForeignKey
ALTER TABLE "complaints" DROP CONSTRAINT "complaints_wardId_fkey";

-- AlterTable
ALTER TABLE "complaints" ALTER COLUMN "wardId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
