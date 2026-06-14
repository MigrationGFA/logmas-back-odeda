/*
  Warnings:

  - A unique constraint covering the columns `[assignedWardId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "assignedWardId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_assignedWardId_key" ON "users"("assignedWardId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_assignedWardId_fkey" FOREIGN KEY ("assignedWardId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
