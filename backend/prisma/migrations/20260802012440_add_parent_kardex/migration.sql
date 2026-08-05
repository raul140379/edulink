/*
  Warnings:

  - A unique constraint covering the columns `[kardex,schoolId]` on the table `Parent` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Parent" ADD COLUMN     "kardex" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Parent_kardex_schoolId_key" ON "Parent"("kardex", "schoolId");
