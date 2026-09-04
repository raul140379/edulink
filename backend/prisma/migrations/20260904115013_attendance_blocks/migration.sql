-- Rediseño completo por bloques de períodos (5-sep-2026, diseño aprobado
-- 4-sep). Tabla nueva AttendanceBlock (aditiva) + StudentAttendance.blockId
-- (nullable, NULL = histórico previo a este cambio, incluidos los registros
-- del fix urgente de teacherId del 4-sep — el pasado nunca se reconstruye).
-- La clave única de StudentAttendance pasa de [studentId, courseId, date,
-- teacherId] a [studentId, blockId]. Ensanchar/reemplazar así nunca puede
-- violar datos existentes (blockId entra NULL para todo lo ya guardado, y
-- Postgres no considera colisión entre NULLs en un índice único).

-- CreateTable
CREATE TABLE "AttendanceBlock" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "periodStart" INTEGER NOT NULL,
    "periodEnd" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "academicYearId" INTEGER NOT NULL,
    "schoolId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceBlock_courseId_date_periodStart_key" ON "AttendanceBlock"("courseId", "date", "periodStart");

-- CreateIndex
CREATE INDEX "AttendanceBlock_teacherId_idx" ON "AttendanceBlock"("teacherId");

-- CreateIndex
CREATE INDEX "AttendanceBlock_schoolId_idx" ON "AttendanceBlock"("schoolId");

-- AddForeignKey
ALTER TABLE "AttendanceBlock" ADD CONSTRAINT "AttendanceBlock_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceBlock" ADD CONSTRAINT "AttendanceBlock_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceBlock" ADD CONSTRAINT "AttendanceBlock_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceBlock" ADD CONSTRAINT "AttendanceBlock_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: agregar blockId a StudentAttendance
ALTER TABLE "StudentAttendance" ADD COLUMN "blockId" INTEGER;

-- DropIndex: la clave única del fix urgente de anoche (teacherId) ya no aplica
DROP INDEX "StudentAttendance_studentId_courseId_date_teacherId_key";

-- CreateIndex: nueva clave única por bloque
CREATE UNIQUE INDEX "StudentAttendance_studentId_blockId_key" ON "StudentAttendance"("studentId", "blockId");

-- CreateIndex
CREATE INDEX "StudentAttendance_blockId_idx" ON "StudentAttendance"("blockId");

-- AddForeignKey
ALTER TABLE "StudentAttendance" ADD CONSTRAINT "StudentAttendance_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "AttendanceBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
