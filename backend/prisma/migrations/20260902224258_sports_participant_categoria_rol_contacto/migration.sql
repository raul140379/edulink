-- CreateEnum
CREATE TYPE "SportsCategory" AS ENUM ('SUB14', 'SUB19');

-- CreateEnum
CREATE TYPE "SportsRole" AS ENUM ('JUGADOR', 'ENTRENADOR', 'DELEGADO');

-- AlterTable: agrega las columnas nuevas. `categoria` entra NULLABLE primero
-- a propósito porque ya hay filas reales cargadas (18 en local al momento de
-- esta migración) — se completa con un backfill explícito antes de forzar
-- NOT NULL, en vez de un default silencioso.
ALTER TABLE "SportsParticipant" ADD COLUMN     "categoria" "SportsCategory";
ALTER TABLE "SportsParticipant" ADD COLUMN     "rolFuncion" "SportsRole";
ALTER TABLE "SportsParticipant" ADD COLUMN     "contactPhone" TEXT;

-- Backfill: los registros ya cargados (los 3 de prueba del 1-sep + los 16
-- reales de Fútbol del 2-sep) quedan como SUB19, confirmado con Raul.
UPDATE "SportsParticipant" SET "categoria" = 'SUB19' WHERE "categoria" IS NULL;

-- Ahora sí, obligatoria.
ALTER TABLE "SportsParticipant" ALTER COLUMN "categoria" SET NOT NULL;

-- DropIndex: la unique vieja no incluía categoria.
DROP INDEX "SportsParticipant_studentId_discipline_academicYearId_key";

-- CreateIndex: la nueva sí — permite que el mismo estudiante+disciplina
-- exista bajo Sub14 Y Sub19 a la vez (edades superpuestas, caso real),
-- solo bloquea el duplicado exacto dentro de la MISMA categoría.
CREATE UNIQUE INDEX "SportsParticipant_studentId_discipline_categoria_academicYe_key" ON "SportsParticipant"("studentId", "discipline", "categoria", "academicYearId");
