/*
  Warnings:

  - You are about to drop the column `channel` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `failReason` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `sentAt` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `subject` on the `notifications` table. All the data in the column will be lost.
  - Added the required column `templateKey` to the `notifications` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "channel",
DROP COLUMN "failReason",
DROP COLUMN "sentAt",
DROP COLUMN "status",
DROP COLUMN "subject",
ADD COLUMN     "emailFailReason" TEXT,
ADD COLUMN     "emailSentAt" TIMESTAMP(3),
ADD COLUMN     "emailStatus" "NotificationStatus",
ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "smsFailReason" TEXT,
ADD COLUMN     "smsSentAt" TIMESTAMP(3),
ADD COLUMN     "smsStatus" "NotificationStatus",
ADD COLUMN     "templateKey" TEXT NOT NULL,
ADD COLUMN     "title" TEXT;
