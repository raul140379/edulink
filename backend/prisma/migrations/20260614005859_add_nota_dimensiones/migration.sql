/*
  Warnings:

  - You are about to drop the column `value` on the `Nota` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "NotaDimension" AS ENUM ('SABER', 'HACER');

-- AlterTable
ALTER TABLE "Nota" DROP COLUMN "value",
ADD COLUMN     "autoEvaluacion" DOUBLE PRECISION,
ADD COLUMN     "cerrado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hacer" DOUBLE PRECISION,
ADD COLUMN     "saber" DOUBLE PRECISION,
ADD COLUMN     "ser" DOUBLE PRECISION,
ADD COLUMN     "total" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "NotaItem" (
    "id" SERIAL NOT NULL,
    "dimension" "NotaDimension" NOT NULL,
    "titulo" TEXT NOT NULL,
    "puntaje" DOUBLE PRECISION NOT NULL,
    "maxPuntaje" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notaId" INTEGER NOT NULL,
    "taskId" INTEGER,

    CONSTRAINT "NotaItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "NotaItem" ADD CONSTRAINT "NotaItem_notaId_fkey" FOREIGN KEY ("notaId") REFERENCES "Nota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaItem" ADD CONSTRAINT "NotaItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
