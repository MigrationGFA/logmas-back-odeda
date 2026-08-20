-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emergencyContact" TEXT,
ADD COLUMN     "identificationNumber" TEXT,
ADD COLUMN     "identificationType" TEXT,
ADD COLUMN     "ownerRepresentative" TEXT,
ADD COLUMN     "passportPhoto" TEXT,
ALTER COLUMN "dateOfBirth" SET DATA TYPE TEXT;
