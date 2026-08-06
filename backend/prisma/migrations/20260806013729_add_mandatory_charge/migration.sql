-- AlterTable
ALTER TABLE "Charge" ADD COLUMN     "mandatoryChargeId" INTEGER;

-- CreateTable
CREATE TABLE "MandatoryCharge" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "ChargeType" NOT NULL,
    "dueDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "academicYearId" INTEGER NOT NULL,
    "schoolId" INTEGER NOT NULL,

    CONSTRAINT "MandatoryCharge_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_mandatoryChargeId_fkey" FOREIGN KEY ("mandatoryChargeId") REFERENCES "MandatoryCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandatoryCharge" ADD CONSTRAINT "MandatoryCharge_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandatoryCharge" ADD CONSTRAINT "MandatoryCharge_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
