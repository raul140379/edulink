/*
  Warnings:

  - A unique constraint covering the columns `[attendanceCode,schoolId]` on the table `Parent` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Parent" ADD COLUMN     "attendanceCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Parent_attendanceCode_schoolId_key" ON "Parent"("attendanceCode", "schoolId");
