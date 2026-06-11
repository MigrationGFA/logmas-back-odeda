-- CreateEnum
CREATE TYPE "Mode" AS ENUM ('fixed', 'variable');

-- AlterTable
ALTER TABLE "levy_configs" ADD COLUMN     "mode" "Mode" NOT NULL DEFAULT 'fixed';
