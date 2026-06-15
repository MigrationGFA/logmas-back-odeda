-- CreateTable
CREATE TABLE "_ContractorWards" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ContractorWards_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ContractorWards_B_index" ON "_ContractorWards"("B");

-- AddForeignKey
ALTER TABLE "_ContractorWards" ADD CONSTRAINT "_ContractorWards_A_fkey" FOREIGN KEY ("A") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContractorWards" ADD CONSTRAINT "_ContractorWards_B_fkey" FOREIGN KEY ("B") REFERENCES "wards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
