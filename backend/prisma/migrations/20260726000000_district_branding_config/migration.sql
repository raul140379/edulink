-- ============================================================
-- Configuración de marca por distrito (para poder reutilizar el
-- sistema con un distrito educativo distinto sin tocar código):
-- District gana location/logoUrl/emailDomain, todos opcionales.
-- SchoolType gana CONVENIO (dependencia real confirmada junto a
-- FISCAL y PRIVADA en los datos oficiales del Ministerio).
-- ============================================================

-- AlterEnum
ALTER TYPE "SchoolType" ADD VALUE 'CONVENIO';

-- AlterTable
ALTER TABLE "District" ADD COLUMN "location" TEXT,
                        ADD COLUMN "logoUrl" TEXT,
                        ADD COLUMN "emailDomain" TEXT;
