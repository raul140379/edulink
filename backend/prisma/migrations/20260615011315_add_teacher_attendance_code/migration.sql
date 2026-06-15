/*
  Warnings:

  - A unique constraint covering the columns `[attendanceCode]` on the table `Teacher` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "attendanceCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_attendanceCode_key" ON "Teacher"("attendanceCode");
