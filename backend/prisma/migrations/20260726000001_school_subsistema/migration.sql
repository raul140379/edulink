-- ============================================================
-- Subsistema del Sistema Educativo Plurinacional al que pertenece
-- cada unidad educativa (Regular / Alternativa y Especial / Superior
-- de Formación Profesional). Por defecto REGULAR, ya que es el único
-- subsistema que EduLink modela en detalle hoy — no rompe datos
-- existentes (todos los colegios actuales son de Educación Regular).
-- ============================================================

-- CreateEnum
CREATE TYPE "Subsistema" AS ENUM ('REGULAR', 'ALTERNATIVA_ESPECIAL', 'SUPERIOR_FORMACION_PROFESIONAL');

-- AlterTable
ALTER TABLE "School" ADD COLUMN "subsistema" "Subsistema" NOT NULL DEFAULT 'REGULAR';
