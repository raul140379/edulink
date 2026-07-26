-- ============================================================
-- Junta de Padres y Gobierno Estudiantil a nivel Núcleo y Distrito.
-- Todo aditivo/nullable, sin backfill necesario: los roles nuevos no
-- son usados por nadie todavía y los valores existentes no cambian.
-- ============================================================

-- AlterEnum: 4 roles nuevos (Junta/Gobierno de Núcleo y de Distrito)
ALTER TYPE "Role" ADD VALUE 'JUNTA_NUCLEO';
ALTER TYPE "Role" ADD VALUE 'JUNTA_DISTRITO';
ALTER TYPE "Role" ADD VALUE 'GOBIERNO_NUCLEO';
ALTER TYPE "Role" ADD VALUE 'GOBIERNO_DISTRITO';

-- AlterTable: JuntaMember gana nucleoId (ya tenía schoolId?/districtId?)
ALTER TABLE "JuntaMember" ADD COLUMN "nucleoId" INTEGER;
ALTER TABLE "JuntaMember" ADD CONSTRAINT "JuntaMember_nucleoId_fkey"
  FOREIGN KEY ("nucleoId") REFERENCES "Nucleo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: User gana nucleoId (tercera dimensión de tenant-scoping)
ALTER TABLE "User" ADD COLUMN "nucleoId" INTEGER;
ALTER TABLE "User" ADD CONSTRAINT "User_nucleoId_fkey"
  FOREIGN KEY ("nucleoId") REFERENCES "Nucleo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Comunicado gana schoolId/nucleoId para acotar el alcance de un comunicado
-- por debajo del distrito (districtId sigue obligatorio, sin cambios).
ALTER TABLE "Comunicado" ADD COLUMN "schoolId" INTEGER;
ALTER TABLE "Comunicado" ADD COLUMN "nucleoId" INTEGER;
ALTER TABLE "Comunicado" ADD CONSTRAINT "Comunicado_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Comunicado" ADD CONSTRAINT "Comunicado_nucleoId_fkey"
  FOREIGN KEY ("nucleoId") REFERENCES "Nucleo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: GobiernoMember — junta directiva del Gobierno Estudiantil
-- (Presidente/Vicepresidente/...) en sus 3 niveles, análoga a JuntaMember.
CREATE TABLE "GobiernoMember" (
    "id" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "ci" TEXT,
    "phone" TEXT,
    "cargo" "JuntaRole" NOT NULL DEFAULT 'VOCAL',
    "academicYear" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "schoolId" INTEGER,
    "nucleoId" INTEGER,
    "districtId" INTEGER,

    CONSTRAINT "GobiernoMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GobiernoMember_ci_key" ON "GobiernoMember"("ci");
CREATE UNIQUE INDEX "GobiernoMember_userId_key" ON "GobiernoMember"("userId");

ALTER TABLE "GobiernoMember" ADD CONSTRAINT "GobiernoMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GobiernoMember" ADD CONSTRAINT "GobiernoMember_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GobiernoMember" ADD CONSTRAINT "GobiernoMember_nucleoId_fkey"
  FOREIGN KEY ("nucleoId") REFERENCES "Nucleo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GobiernoMember" ADD CONSTRAINT "GobiernoMember_districtId_fkey"
  FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;
