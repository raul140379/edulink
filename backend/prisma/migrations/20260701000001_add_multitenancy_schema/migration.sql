-- ============================================================
-- Multi-tenancy: District + School, schoolId/districtId scoping
-- Hand-written (expand -> backfill -> contract) because the
-- local dev DB already has real data (935 parents, 638 students, etc).
-- Pilot school: U.E. Naciones Unidas - Mañana (SIE 41980023),
-- district: Distrito Educativo El Torno. Both created with a
-- fixed id=1 since these are brand-new, currently-empty tables.
-- ============================================================

-- CreateEnum
CREATE TYPE "SchoolType" AS ENUM ('FISCAL', 'PRIVADA');

-- CreateEnum
CREATE TYPE "SchoolArea" AS ENUM ('URBANA', 'RURAL');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'DIRECTOR_DISTRITAL';

-- CreateTable
CREATE TABLE "District" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sieCode" TEXT NOT NULL,
    "tipo" "SchoolType" NOT NULL,
    "area" "SchoolArea" NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "districtId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_sieCode_key" ON "School"("sieCode");

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the pilot District + School (fixed id=1, tables are currently empty)
INSERT INTO "District" ("id", "name", "updatedAt") VALUES (1, 'Distrito Educativo El Torno', CURRENT_TIMESTAMP);
SELECT setval(pg_get_serial_sequence('"District"', 'id'), 1, true);

INSERT INTO "School" ("id", "name", "sieCode", "tipo", "area", "districtId", "updatedAt")
VALUES (1, 'Naciones Unidas - Mañana', '41980023', 'FISCAL', 'URBANA', 1, CURRENT_TIMESTAMP);
SELECT setval(pg_get_serial_sequence('"School"', 'id'), 1, true);

-- ============================================================
-- User + JuntaMember: nullable schoolId/districtId (dual scope)
-- ============================================================

-- AlterTable
ALTER TABLE "User" ADD COLUMN "schoolId" INTEGER,
ADD COLUMN "districtId" INTEGER;

UPDATE "User" SET "schoolId" = 1 WHERE "role" != 'SUPER_ADMIN';

ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "JuntaMember" ADD COLUMN "schoolId" INTEGER,
ADD COLUMN "districtId" INTEGER;

UPDATE "JuntaMember" SET "schoolId" = 1;

ALTER TABLE "JuntaMember" ADD CONSTRAINT "JuntaMember_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JuntaMember" ADD CONSTRAINT "JuntaMember_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- Required schoolId (Int NOT NULL) on every school-scoped model:
-- add nullable -> backfill to School 1 -> set NOT NULL -> add FK
-- ============================================================

ALTER TABLE "SchoolSchedule" ADD COLUMN "schoolId" INTEGER;
UPDATE "SchoolSchedule" SET "schoolId" = 1;
ALTER TABLE "SchoolSchedule" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "SchoolSchedule" ADD CONSTRAINT "SchoolSchedule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShiftDirector" ADD COLUMN "schoolId" INTEGER;
UPDATE "ShiftDirector" SET "schoolId" = 1;
ALTER TABLE "ShiftDirector" ALTER COLUMN "schoolId" SET NOT NULL;
DROP INDEX "ShiftDirector_shift_key";
CREATE UNIQUE INDEX "ShiftDirector_shift_schoolId_key" ON "ShiftDirector"("shift", "schoolId");
ALTER TABLE "ShiftDirector" ADD CONSTRAINT "ShiftDirector_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AcademicYear" ADD COLUMN "schoolId" INTEGER;
UPDATE "AcademicYear" SET "schoolId" = 1;
ALTER TABLE "AcademicYear" ALTER COLUMN "schoolId" SET NOT NULL;
DROP INDEX "AcademicYear_year_key";
CREATE UNIQUE INDEX "AcademicYear_year_schoolId_key" ON "AcademicYear"("year", "schoolId");
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Parent" ADD COLUMN "schoolId" INTEGER;
UPDATE "Parent" SET "schoolId" = 1;
ALTER TABLE "Parent" ALTER COLUMN "schoolId" SET NOT NULL;
DROP INDEX "Parent_ci_key";
DROP INDEX "Parent_email_key";
CREATE UNIQUE INDEX "Parent_ci_schoolId_key" ON "Parent"("ci", "schoolId");
CREATE UNIQUE INDEX "Parent_email_schoolId_key" ON "Parent"("email", "schoolId");
ALTER TABLE "Parent" ADD CONSTRAINT "Parent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Student" ADD COLUMN "schoolId" INTEGER;
UPDATE "Student" SET "schoolId" = 1;
ALTER TABLE "Student" ALTER COLUMN "schoolId" SET NOT NULL;
DROP INDEX "Student_ci_key";
DROP INDEX "Student_rude_key";
DROP INDEX "Student_email_key";
CREATE UNIQUE INDEX "Student_ci_schoolId_key" ON "Student"("ci", "schoolId");
CREATE UNIQUE INDEX "Student_rude_schoolId_key" ON "Student"("rude", "schoolId");
CREATE UNIQUE INDEX "Student_email_schoolId_key" ON "Student"("email", "schoolId");
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Teacher" ADD COLUMN "schoolId" INTEGER;
UPDATE "Teacher" SET "schoolId" = 1;
ALTER TABLE "Teacher" ALTER COLUMN "schoolId" SET NOT NULL;
DROP INDEX "Teacher_ci_key";
DROP INDEX "Teacher_email_key";
DROP INDEX "Teacher_attendanceCode_key";
CREATE UNIQUE INDEX "Teacher_ci_schoolId_key" ON "Teacher"("ci", "schoolId");
CREATE UNIQUE INDEX "Teacher_email_schoolId_key" ON "Teacher"("email", "schoolId");
CREATE UNIQUE INDEX "Teacher_attendanceCode_schoolId_key" ON "Teacher"("attendanceCode", "schoolId");
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Staff" ADD COLUMN "schoolId" INTEGER;
UPDATE "Staff" SET "schoolId" = 1;
ALTER TABLE "Staff" ALTER COLUMN "schoolId" SET NOT NULL;
DROP INDEX "Staff_ci_key";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Staff_attendanceCode_key') THEN
    ALTER TABLE "Staff" DROP CONSTRAINT "Staff_attendanceCode_key";
  ELSIF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Staff_attendanceCode_key') THEN
    DROP INDEX "Staff_attendanceCode_key";
  END IF;
END $$;
CREATE UNIQUE INDEX "Staff_ci_schoolId_key" ON "Staff"("ci", "schoolId");
CREATE UNIQUE INDEX "Staff_attendanceCode_schoolId_key" ON "Staff"("attendanceCode", "schoolId");
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Course" ADD COLUMN "schoolId" INTEGER;
UPDATE "Course" SET "schoolId" = 1;
ALTER TABLE "Course" ALTER COLUMN "schoolId" SET NOT NULL;
DROP INDEX "Course_level_grade_parallel_educationType_shift_key";
CREATE UNIQUE INDEX "Course_level_grade_parallel_educationType_shift_schoolId_key" ON "Course"("level", "grade", "parallel", "educationType", "shift", "schoolId");
ALTER TABLE "Course" ADD CONSTRAINT "Course_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Classroom" ADD COLUMN "schoolId" INTEGER;
UPDATE "Classroom" SET "schoolId" = 1;
ALTER TABLE "Classroom" ALTER COLUMN "schoolId" SET NOT NULL;
DROP INDEX "Classroom_name_key";
CREATE UNIQUE INDEX "Classroom_name_schoolId_key" ON "Classroom"("name", "schoolId");
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Subject" ADD COLUMN "schoolId" INTEGER;
UPDATE "Subject" SET "schoolId" = 1;
ALTER TABLE "Subject" ALTER COLUMN "schoolId" SET NOT NULL;
DROP INDEX "Subject_name_level_key";
CREATE UNIQUE INDEX "Subject_name_level_schoolId_key" ON "Subject"("name", "level", "schoolId");
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Charge" ADD COLUMN "schoolId" INTEGER;
UPDATE "Charge" SET "schoolId" = 1;
ALTER TABLE "Charge" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD COLUMN "schoolId" INTEGER;
UPDATE "Payment" SET "schoolId" = 1;
ALTER TABLE "Payment" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD COLUMN "schoolId" INTEGER;
UPDATE "Notification" SET "schoolId" = 1;
ALTER TABLE "Notification" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Meeting" ADD COLUMN "schoolId" INTEGER;
UPDATE "Meeting" SET "schoolId" = 1;
ALTER TABLE "Meeting" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Task" ADD COLUMN "schoolId" INTEGER;
UPDATE "Task" SET "schoolId" = 1;
ALTER TABLE "Task" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Task" ADD CONSTRAINT "Task_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Nota" ADD COLUMN "schoolId" INTEGER;
UPDATE "Nota" SET "schoolId" = 1;
ALTER TABLE "Nota" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Nota" ADD CONSTRAINT "Nota_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Schedule" ADD COLUMN "schoolId" INTEGER;
UPDATE "Schedule" SET "schoolId" = 1;
ALTER TABLE "Schedule" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SchedulePlan" ADD COLUMN "schoolId" INTEGER;
UPDATE "SchedulePlan" SET "schoolId" = 1;
ALTER TABLE "SchedulePlan" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "SchedulePlan" ADD CONSTRAINT "SchedulePlan_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GateRecord" ADD COLUMN "schoolId" INTEGER;
UPDATE "GateRecord" SET "schoolId" = 1;
ALTER TABLE "GateRecord" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "GateRecord" ADD CONSTRAINT "GateRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeacherAttendance" ADD COLUMN "schoolId" INTEGER;
UPDATE "TeacherAttendance" SET "schoolId" = 1;
ALTER TABLE "TeacherAttendance" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "TeacherAttendance" ADD CONSTRAINT "TeacherAttendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StudentAttendance" ADD COLUMN "schoolId" INTEGER;
UPDATE "StudentAttendance" SET "schoolId" = 1;
ALTER TABLE "StudentAttendance" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "StudentAttendance" ADD CONSTRAINT "StudentAttendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BiometricTemplate" ADD COLUMN "schoolId" INTEGER;
UPDATE "BiometricTemplate" SET "schoolId" = 1;
ALTER TABLE "BiometricTemplate" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "BiometricTemplate" ADD CONSTRAINT "BiometricTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
