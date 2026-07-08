-- DropForeignKey
ALTER TABLE "state_of_origin_applications" DROP CONSTRAINT "state_of_origin_applications_wardId_fkey";

-- AlterTable
ALTER TABLE "state_of_origin_applications" ADD COLUMN     "assignedCouncillorId" TEXT,
ALTER COLUMN "wardId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "state_of_origin_applications" ADD CONSTRAINT "state_of_origin_applications_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "state_of_origin_applications" ADD CONSTRAINT "state_of_origin_applications_assignedCouncillorId_fkey" FOREIGN KEY ("assignedCouncillorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
