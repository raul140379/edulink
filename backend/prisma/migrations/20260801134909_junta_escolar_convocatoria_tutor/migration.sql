-- CreateEnum
CREATE TYPE "ConvocatoriaKind" AS ENUM ('ORDINARIA', 'EMERGENCIA', 'ACTIVIDAD');

-- CreateEnum
CREATE TYPE "ConvocatoriaAudience" AS ENUM ('DELEGADOS', 'DIRECTORIO', 'TODOS_LOS_PADRES');

-- AlterTable
ALTER TABLE "JuntaMember" ADD COLUMN     "parentId" INTEGER;

-- CreateTable
CREATE TABLE "Convocatoria" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "ConvocatoriaKind" NOT NULL DEFAULT 'ORDINARIA',
    "audience" "ConvocatoriaAudience" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "multaAmount" DOUBLE PRECISION,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER NOT NULL,
    "schoolId" INTEGER NOT NULL,

    CONSTRAINT "Convocatoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConvocatoriaAttendance" (
    "id" SERIAL NOT NULL,
    "convocatoriaId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT false,
    "charged" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConvocatoriaAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConvocatoriaAttendance_convocatoriaId_userId_key" ON "ConvocatoriaAttendance"("convocatoriaId", "userId");

-- AddForeignKey
ALTER TABLE "JuntaMember" ADD CONSTRAINT "JuntaMember_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convocatoria" ADD CONSTRAINT "Convocatoria_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convocatoria" ADD CONSTRAINT "Convocatoria_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConvocatoriaAttendance" ADD CONSTRAINT "ConvocatoriaAttendance_convocatoriaId_fkey" FOREIGN KEY ("convocatoriaId") REFERENCES "Convocatoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConvocatoriaAttendance" ADD CONSTRAINT "ConvocatoriaAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
