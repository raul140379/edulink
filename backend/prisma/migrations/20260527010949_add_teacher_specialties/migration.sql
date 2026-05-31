-- CreateTable
CREATE TABLE "TeacherSpecialty" (
    "id" SERIAL NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,

    CONSTRAINT "TeacherSpecialty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherSpecialty_teacherId_subjectId_key" ON "TeacherSpecialty"("teacherId", "subjectId");

-- AddForeignKey
ALTER TABLE "TeacherSpecialty" ADD CONSTRAINT "TeacherSpecialty_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSpecialty" ADD CONSTRAINT "TeacherSpecialty_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
