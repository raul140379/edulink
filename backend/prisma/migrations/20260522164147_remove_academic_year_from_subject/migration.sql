/*
  Warnings:

  - You are about to drop the column `academicYearId` on the `Subject` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name,level]` on the table `Subject` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Subject" DROP CONSTRAINT "Subject_academicYearId_fkey";

-- DropIndex
DROP INDEX "Subject_name_level_academicYearId_key";

-- AlterTable
ALTER TABLE "Subject" DROP COLUMN "academicYearId";

-- CreateIndex
CREATE UNIQUE INDEX "Subject_name_level_key" ON "Subject"("name", "level");
