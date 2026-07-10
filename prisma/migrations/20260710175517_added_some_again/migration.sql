-- DropForeignKey
ALTER TABLE "businesses" DROP CONSTRAINT "businesses_wardId_fkey";

-- AlterTable
ALTER TABLE "businesses" ALTER COLUMN "wardId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
