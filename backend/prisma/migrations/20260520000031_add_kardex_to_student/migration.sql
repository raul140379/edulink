/*
  Warnings:

  - A unique constraint covering the columns `[kardex]` on the table `Student` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "kardex" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Student_kardex_key" ON "Student"("kardex");
