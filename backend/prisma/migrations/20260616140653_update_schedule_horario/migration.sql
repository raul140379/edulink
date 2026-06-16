/*
  Warnings:

  - You are about to drop the column `entryTime` on the `SchoolSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `toleranceMin` on the `SchoolSchedule` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[courseId,academicYearId,dayOfWeek,period]` on the table `Schedule` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `academicYearId` to the `Schedule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `period` to the `Schedule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `SchoolSchedule` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Schedule_courseId_dayOfWeek_startTime_key";

-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN     "academicYearId" INTEGER NOT NULL,
ADD COLUMN     "period" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "SchoolSchedule" DROP COLUMN "entryTime",
DROP COLUMN "toleranceMin",
ADD COLUMN     "breakAfter" TEXT NOT NULL DEFAULT '2,4',
ADD COLUMN     "breakDuration" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "isWinter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "periodDuration" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "periods" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "startTime" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_courseId_academicYearId_dayOfWeek_period_key" ON "Schedule"("courseId", "academicYearId", "dayOfWeek", "period");

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
