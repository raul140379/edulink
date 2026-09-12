-- CreateEnum
CREATE TYPE "WithdrawalReason" AS ENUM ('TRASLADO', 'RETIRO_VOLUNTARIO', 'OTRO');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "withdrawalNote" TEXT,
ADD COLUMN     "withdrawalReason" "WithdrawalReason",
ADD COLUMN     "withdrawnAt" TIMESTAMP(3);
