-- AttendanceBlock.subjectId (5-sep-2026): investigado con datos reales
-- antes de asumir — hoy nunca cambia la materia dentro de un bloque, pero
-- no está garantizado por el modelo. Nullable: el bloque "sin período"
-- (corrección DIRECTOR/SECRETARY sin ningún período real detrás) no tiene
-- materia — forzar una sería un dato falso.

-- AlterTable
ALTER TABLE "AttendanceBlock" ADD COLUMN "subjectId" INTEGER;

-- AddForeignKey
ALTER TABLE "AttendanceBlock" ADD CONSTRAINT "AttendanceBlock_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: Licencia de estudiante (Opción A — nunca escribe
-- StudentAttendance, se consulta en lectura, ver comentario del modelo en
-- schema.prisma). Alcance de esta versión: solo alta.
CREATE TABLE "StudentLicense" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdById" INTEGER NOT NULL,
    "schoolId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentLicense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentLicense_studentId_idx" ON "StudentLicense"("studentId");

-- CreateIndex
CREATE INDEX "StudentLicense_schoolId_idx" ON "StudentLicense"("schoolId");

-- CreateIndex
CREATE INDEX "StudentLicense_startDate_endDate_idx" ON "StudentLicense"("startDate", "endDate");

-- AddForeignKey
ALTER TABLE "StudentLicense" ADD CONSTRAINT "StudentLicense_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLicense" ADD CONSTRAINT "StudentLicense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLicense" ADD CONSTRAINT "StudentLicense_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
