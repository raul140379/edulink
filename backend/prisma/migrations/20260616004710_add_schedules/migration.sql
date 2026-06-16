-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "entryTime" TEXT,
ADD COLUMN     "exitTime" TEXT,
ADD COLUMN     "toleranceMin" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "SchoolSchedule" (
    "id" SERIAL NOT NULL,
    "shift" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entryTime" TEXT NOT NULL,
    "exitTime" TEXT NOT NULL,
    "toleranceMin" INTEGER NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolSchedule_pkey" PRIMARY KEY ("id")
);
