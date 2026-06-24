-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isWalkIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "walkInRegisteredById" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_walkInRegisteredById_fkey" FOREIGN KEY ("walkInRegisteredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
