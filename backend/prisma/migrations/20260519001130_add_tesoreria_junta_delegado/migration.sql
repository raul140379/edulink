/*
  Warnings:

  - The values [ACTIVIDAD_EXTRA,MENSUALIDAD] on the enum `ChargeType` will be removed. If these variants are still used in the database, this will fail.
  - The `method` column on the `Payment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `academicYearId` to the `Charge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Charge` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ChargeTarget" AS ENUM ('TUTOR', 'ESTUDIANTE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'DEPOSITO_BANCARIO', 'QR', 'TRANSFERENCIA', 'OTRO');

-- CreateEnum
CREATE TYPE "JuntaRole" AS ENUM ('PRESIDENTE', 'VICEPRESIDENTE', 'SECRETARIA', 'TESORERO', 'VOCAL');

-- AlterEnum
BEGIN;
CREATE TYPE "ChargeType_new" AS ENUM ('CUOTA_INICIAL', 'DEUDA_ANTERIOR', 'MULTA_ASAMBLEA', 'MINGA', 'MULTA_REUNION', 'ACTIVIDAD', 'MATERIAL_ESCOLAR', 'OTRO');
ALTER TABLE "Charge" ALTER COLUMN "type" TYPE "ChargeType_new" USING ("type"::text::"ChargeType_new");
ALTER TYPE "ChargeType" RENAME TO "ChargeType_old";
ALTER TYPE "ChargeType_new" RENAME TO "ChargeType";
DROP TYPE "ChargeType_old";
COMMIT;

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'JUNTA_ESCOLAR';

-- AlterTable
ALTER TABLE "Charge" ADD COLUMN     "academicYearId" INTEGER NOT NULL,
ADD COLUMN     "studentId" INTEGER,
ADD COLUMN     "target" "ChargeTarget" NOT NULL DEFAULT 'TUTOR',
ADD COLUMN     "tolerance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "toleranceNote" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "note" TEXT,
ADD COLUMN     "receivedById" INTEGER,
DROP COLUMN "method",
ADD COLUMN     "method" "PaymentMethod" NOT NULL DEFAULT 'EFECTIVO';

-- CreateTable
CREATE TABLE "JuntaMember" (
    "id" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "ci" TEXT,
    "phone" TEXT,
    "juntaRole" "JuntaRole" NOT NULL DEFAULT 'VOCAL',
    "academicYear" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "JuntaMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseDelegate" (
    "id" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "ci" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,

    CONSTRAINT "CourseDelegate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseTutor" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseTutor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JuntaMember_ci_key" ON "JuntaMember"("ci");

-- CreateIndex
CREATE UNIQUE INDEX "JuntaMember_userId_key" ON "JuntaMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseDelegate_ci_key" ON "CourseDelegate"("ci");

-- CreateIndex
CREATE UNIQUE INDEX "CourseDelegate_userId_key" ON "CourseDelegate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseDelegate_courseId_key" ON "CourseDelegate"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseTutor_courseId_key" ON "CourseTutor"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseTutor_teacherId_key" ON "CourseTutor"("teacherId");

-- AddForeignKey
ALTER TABLE "JuntaMember" ADD CONSTRAINT "JuntaMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseDelegate" ADD CONSTRAINT "CourseDelegate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseDelegate" ADD CONSTRAINT "CourseDelegate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseTutor" ADD CONSTRAINT "CourseTutor_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseTutor" ADD CONSTRAINT "CourseTutor_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
