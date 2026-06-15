-- AlterTable
ALTER TABLE "users" ADD COLUMN     "commissionRate" DOUBLE PRECISION DEFAULT 0.0;

-- CreateTable
CREATE TABLE "_UserPermittedLevies" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UserPermittedLevies_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_UserPermittedLevies_B_index" ON "_UserPermittedLevies"("B");

-- AddForeignKey
ALTER TABLE "_UserPermittedLevies" ADD CONSTRAINT "_UserPermittedLevies_A_fkey" FOREIGN KEY ("A") REFERENCES "levy_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserPermittedLevies" ADD CONSTRAINT "_UserPermittedLevies_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
