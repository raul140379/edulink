-- CreateTable
CREATE TABLE "SchedulePlan" (
    "id" SERIAL NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "courseId" INTEGER NOT NULL,
    "academicYearId" INTEGER NOT NULL,
    "teacherSubjectCourseId" INTEGER NOT NULL,
    "classroomId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulePlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchedulePlan_courseId_academicYearId_dayOfWeek_period_key" ON "SchedulePlan"("courseId", "academicYearId", "dayOfWeek", "period");

-- AddForeignKey
ALTER TABLE "SchedulePlan" ADD CONSTRAINT "SchedulePlan_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulePlan" ADD CONSTRAINT "SchedulePlan_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulePlan" ADD CONSTRAINT "SchedulePlan_teacherSubjectCourseId_fkey" FOREIGN KEY ("teacherSubjectCourseId") REFERENCES "TeacherSubjectCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulePlan" ADD CONSTRAINT "SchedulePlan_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
