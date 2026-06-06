/*
  Warnings:

  - A unique constraint covering the columns `[delegateUserId]` on the table `Parent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tutorUserId]` on the table `Teacher` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Parent" ADD COLUMN     "delegateUserId" INTEGER;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "tutorUserId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Parent_delegateUserId_key" ON "Parent"("delegateUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_tutorUserId_key" ON "Teacher"("tutorUserId");

-- AddForeignKey
ALTER TABLE "Parent" ADD CONSTRAINT "Parent_delegateUserId_fkey" FOREIGN KEY ("delegateUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_tutorUserId_fkey" FOREIGN KEY ("tutorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
