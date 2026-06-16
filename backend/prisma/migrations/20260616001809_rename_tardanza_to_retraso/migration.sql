/*
  Warnings:

  - The values [TARDANZA] on the enum `AttendanceStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AttendanceStatus_new" AS ENUM ('PRESENTE', 'AUSENTE', 'RETRASO', 'LICENCIA');
ALTER TABLE "TeacherAttendance" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "TeacherAttendance" ALTER COLUMN "status" TYPE "AttendanceStatus_new" USING ("status"::text::"AttendanceStatus_new");
ALTER TYPE "AttendanceStatus" RENAME TO "AttendanceStatus_old";
ALTER TYPE "AttendanceStatus_new" RENAME TO "AttendanceStatus";
DROP TYPE "AttendanceStatus_old";
ALTER TABLE "TeacherAttendance" ALTER COLUMN "status" SET DEFAULT 'PRESENTE';
COMMIT;
