-- AlterTable
ALTER TABLE "School" ADD COLUMN     "shifts" "Shift"[] DEFAULT ARRAY[]::"Shift"[];
