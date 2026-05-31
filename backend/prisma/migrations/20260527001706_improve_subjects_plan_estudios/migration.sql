-- CreateEnum
CREATE TYPE "CampoSaber" AS ENUM ('VIDA_TIERRA_TERRITORIO', 'COMUNIDAD_SOCIEDAD', 'COSMOS_PENSAMIENTO', 'CIENCIA_TECNOLOGIA_PRODUCCION');

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "campo" "CampoSaber",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "SubjectGradeConfig" (
    "id" SERIAL NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "grade" "Grade" NOT NULL,
    "hoursPerWeek" INTEGER NOT NULL,
    "educationType" "EducationType" NOT NULL DEFAULT 'REGULAR',

    CONSTRAINT "SubjectGradeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubjectGradeConfig_subjectId_grade_educationType_key" ON "SubjectGradeConfig"("subjectId", "grade", "educationType");

-- AddForeignKey
ALTER TABLE "SubjectGradeConfig" ADD CONSTRAINT "SubjectGradeConfig_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
