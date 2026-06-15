/*
  Warnings:

  - You are about to drop the column `supervisorId` on the `users` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_supervisorId_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "supervisorId",
ADD COLUMN     "agentId" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
