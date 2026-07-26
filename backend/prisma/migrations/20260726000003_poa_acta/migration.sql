-- ============================================================
-- Acta de aprobación del POA de la Junta Escolar — sustento legal exigido por
-- el Director Distrital para cobrar a los padres. Puramente informativo, no
-- bloquea la creación de cobros.
-- ============================================================

CREATE TABLE "PoaActa" (
    "id" SERIAL NOT NULL,
    "schoolId" INTEGER NOT NULL,
    "academicYear" INTEGER NOT NULL,
    "actaFileUrl" TEXT NOT NULL,
    "assemblyDate" TIMESTAMP(3) NOT NULL,
    "montoGlobal" DOUBLE PRECISION NOT NULL,
    "montoIndividual" DOUBLE PRECISION,
    "items" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" INTEGER NOT NULL,

    CONSTRAINT "PoaActa_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PoaActa_schoolId_academicYear_key" ON "PoaActa"("schoolId", "academicYear");

ALTER TABLE "PoaActa" ADD CONSTRAINT "PoaActa_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PoaActa" ADD CONSTRAINT "PoaActa_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
