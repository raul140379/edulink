-- ============================================================
-- Nucleo (Distrito -> Nucleo -> Colegio) + Comunicado (contenido
-- publico administrable por el Director Distrital / Super Admin).
-- Los 8 nucleos reales del Distrito Educativo El Torno se siembran
-- aqui con id fijo (districtId = 1, ya creado en la migracion previa).
-- ============================================================

-- CreateEnum
CREATE TYPE "ComunicadoType" AS ENUM ('COMUNICADO', 'CONVOCATORIA', 'AVISO');

-- CreateTable
CREATE TABLE "Nucleo" (
    "id"         SERIAL NOT NULL,
    "name"       TEXT NOT NULL,
    "location"   TEXT,
    "districtId" INTEGER NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Nucleo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Nucleo_name_districtId_key" ON "Nucleo"("name", "districtId");

-- AddForeignKey
ALTER TABLE "Nucleo" ADD CONSTRAINT "Nucleo_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "School" ADD COLUMN "nucleoId" INTEGER;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_nucleoId_fkey" FOREIGN KEY ("nucleoId") REFERENCES "Nucleo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Comunicado" (
    "id"          SERIAL NOT NULL,
    "title"       TEXT NOT NULL,
    "body"        TEXT NOT NULL,
    "type"        "ComunicadoType" NOT NULL DEFAULT 'COMUNICADO',
    "imageUrl"    TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId"    INTEGER NOT NULL,
    "districtId"  INTEGER NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comunicado_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Comunicado" ADD CONSTRAINT "Comunicado_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comunicado" ADD CONSTRAINT "Comunicado_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the 8 real nucleos of Distrito Educativo El Torno (fixed ids, table is new/empty)
INSERT INTO "Nucleo" ("id", "name", "location", "districtId", "updatedAt") VALUES
    (1, '19 de Junio',              'Área central de El Torno', 1, CURRENT_TIMESTAMP),
    (2, 'Andrés Contreras',         'Limoncito',                 1, CURRENT_TIMESTAMP),
    (3, 'José Colosias Piñeiro',    'La Angostura',              1, CURRENT_TIMESTAMP),
    (4, 'Eduardo Fiorilo',          'Santa Rita',                1, CURRENT_TIMESTAMP),
    (5, 'Primavera',                'San Luís',                  1, CURRENT_TIMESTAMP),
    (6, '2 de Agosto',              'Cañada Strongest',          1, CURRENT_TIMESTAMP),
    (7, 'Piray',                    'Jorochito',                 1, CURRENT_TIMESTAMP),
    (8, 'Santo Domingo',            'La Forestal',               1, CURRENT_TIMESTAMP);

SELECT setval(pg_get_serial_sequence('"Nucleo"', 'id'), 8, true);
