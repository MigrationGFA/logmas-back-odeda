-- CreateTable
CREATE TABLE "_InvoiceAssignedOfficer" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_InvoiceAssignedOfficer_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_InvoiceAssignedOfficer_B_index" ON "_InvoiceAssignedOfficer"("B");

-- AddForeignKey
ALTER TABLE "_InvoiceAssignedOfficer" ADD CONSTRAINT "_InvoiceAssignedOfficer_A_fkey" FOREIGN KEY ("A") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InvoiceAssignedOfficer" ADD CONSTRAINT "_InvoiceAssignedOfficer_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
