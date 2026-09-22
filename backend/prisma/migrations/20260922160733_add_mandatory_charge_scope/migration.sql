-- CreateEnum
CREATE TYPE "MandatoryChargeScope" AS ENUM ('TODOS', 'GRADO', 'CURSO');

-- AlterTable
ALTER TABLE "MandatoryCharge" ADD COLUMN     "scope" "MandatoryChargeScope" NOT NULL DEFAULT 'TODOS',
ADD COLUMN     "scopeCourseId" INTEGER,
ADD COLUMN     "scopeGrade" "Grade",
ADD COLUMN     "scopeLevel" "AcademicLevel";

-- AddForeignKey
ALTER TABLE "MandatoryCharge" ADD CONSTRAINT "MandatoryCharge_scopeCourseId_fkey" FOREIGN KEY ("scopeCourseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
