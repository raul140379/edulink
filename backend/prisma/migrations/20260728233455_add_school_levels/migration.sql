-- AlterTable
ALTER TABLE "School" ADD COLUMN     "levels" "AcademicLevel"[] DEFAULT ARRAY[]::"AcademicLevel"[],
ADD COLUMN     "offersBTH" BOOLEAN NOT NULL DEFAULT false;
