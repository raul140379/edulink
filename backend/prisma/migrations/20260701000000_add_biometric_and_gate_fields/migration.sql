-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "GateRecordType" ADD VALUE 'ADMINISTRATIVO';
ALTER TYPE "GateRecordType" ADD VALUE 'ESTUDIANTE';

-- AlterEnum
ALTER TYPE "StaffRole" ADD VALUE 'PSICOLOGO';

-- AlterTable
ALTER TABLE "GateRecord" ADD COLUMN     "method" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "staffId" INTEGER,
ADD COLUMN     "studentId" INTEGER;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "attendanceCode" TEXT;

-- CreateTable
CREATE TABLE "BiometricTemplate" (
    "id" SERIAL NOT NULL,
    "template" TEXT NOT NULL,
    "deviceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teacherId" INTEGER,
    "staffId" INTEGER,

    CONSTRAINT "BiometricTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Staff_attendanceCode_key" ON "Staff"("attendanceCode");

-- AddForeignKey
ALTER TABLE "GateRecord" ADD CONSTRAINT "GateRecord_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "GateRecord" ADD CONSTRAINT "GateRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "BiometricTemplate" ADD CONSTRAINT "BiometricTemplate_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "BiometricTemplate" ADD CONSTRAINT "BiometricTemplate_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
