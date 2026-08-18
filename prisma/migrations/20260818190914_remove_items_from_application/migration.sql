/*
  Warnings:

  - You are about to drop the column `address` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `cacNumber` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `fullName` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `nin` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `ward` on the `applications` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "applications" DROP COLUMN "address",
DROP COLUMN "cacNumber",
DROP COLUMN "email",
DROP COLUMN "fullName",
DROP COLUMN "nin",
DROP COLUMN "phone",
DROP COLUMN "ward";
