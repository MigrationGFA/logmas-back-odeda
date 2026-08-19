/*
  Warnings:

  - A unique constraint covering the columns `[passwordResetToken]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "notifyByEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyByInApp" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyBySms" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "passwordResetRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordResetToken" TEXT,
ADD COLUMN     "passwordResetTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_passwordResetToken_key" ON "users"("passwordResetToken");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_suspendedById_fkey" FOREIGN KEY ("suspendedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
