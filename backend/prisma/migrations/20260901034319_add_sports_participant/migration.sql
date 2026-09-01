-- CreateTable
CREATE TABLE "SportsParticipant" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "discipline" TEXT NOT NULL,
    "modality" TEXT,
    "academicYearId" INTEGER NOT NULL,
    "schoolId" INTEGER NOT NULL,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SportsParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SportsParticipant_schoolId_idx" ON "SportsParticipant"("schoolId");

-- CreateIndex
CREATE INDEX "SportsParticipant_academicYearId_idx" ON "SportsParticipant"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "SportsParticipant_studentId_discipline_academicYearId_key" ON "SportsParticipant"("studentId", "discipline", "academicYearId");

-- AddForeignKey
ALTER TABLE "SportsParticipant" ADD CONSTRAINT "SportsParticipant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SportsParticipant" ADD CONSTRAINT "SportsParticipant_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SportsParticipant" ADD CONSTRAINT "SportsParticipant_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SportsParticipant" ADD CONSTRAINT "SportsParticipant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
