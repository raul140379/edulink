/*
  Warnings:

  - You are about to drop the `CourseDelegate` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[delegateId]` on the table `Course` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "CourseDelegate" DROP CONSTRAINT "CourseDelegate_courseId_fkey";

-- DropForeignKey
ALTER TABLE "CourseDelegate" DROP CONSTRAINT "CourseDelegate_userId_fkey";

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "delegateId" INTEGER;

-- DropTable
DROP TABLE "CourseDelegate";

-- CreateIndex
CREATE UNIQUE INDEX "Course_delegateId_key" ON "Course"("delegateId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "Parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
