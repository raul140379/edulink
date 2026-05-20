-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MASCULINO', 'FEMENINO');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "gender" "Gender" NOT NULL DEFAULT 'MASCULINO';
