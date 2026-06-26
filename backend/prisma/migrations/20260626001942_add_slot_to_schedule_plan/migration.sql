/*
  Warnings:

  - A unique constraint covering the columns `[courseId,academicYearId,dayOfWeek,period,slot]` on the table `SchedulePlan` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "SchedulePlan_courseId_academicYearId_dayOfWeek_period_key";

-- AlterTable
ALTER TABLE "SchedulePlan" ADD COLUMN     "slot" TEXT NOT NULL DEFAULT 'TEMP';

-- CreateIndex
CREATE UNIQUE INDEX "SchedulePlan_courseId_academicYearId_dayOfWeek_period_slot_key" ON "SchedulePlan"("courseId", "academicYearId", "dayOfWeek", "period", "slot");
