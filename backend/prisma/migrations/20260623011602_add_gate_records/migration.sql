-- CreateEnum
CREATE TYPE "GateRecordType" AS ENUM ('MAESTRO', 'VISITANTE');

-- CreateEnum
CREATE TYPE "GateAction" AS ENUM ('ENTRADA', 'SALIDA');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'PORTERO';

-- CreateTable
CREATE TABLE "GateRecord" (
    "id" SERIAL NOT NULL,
    "type" "GateRecordType" NOT NULL,
    "action" "GateAction" NOT NULL,
    "teacherId" INTEGER,
    "visitorName" TEXT,
    "visitorCI" TEXT,
    "reason" TEXT,
    "destination" TEXT,
    "registeredById" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GateRecord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GateRecord" ADD CONSTRAINT "GateRecord_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
