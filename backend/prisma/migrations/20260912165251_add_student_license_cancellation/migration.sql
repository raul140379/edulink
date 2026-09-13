-- AlterTable
ALTER TABLE "StudentLicense" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" INTEGER,
ADD COLUMN     "cancelledNote" TEXT;

-- AddForeignKey
ALTER TABLE "StudentLicense" ADD CONSTRAINT "StudentLicense_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
