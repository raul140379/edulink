-- CreateTable
CREATE TABLE "StudentLateArrival" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "arrivalTime" TEXT NOT NULL,
    "minutesLate" INTEGER NOT NULL,
    "enteredClass" BOOLEAN NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "gateRecordId" INTEGER,
    "registeredById" INTEGER NOT NULL,
    "schoolId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentLateArrival_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentLateArrival_studentId_idx" ON "StudentLateArrival"("studentId");

-- CreateIndex
CREATE INDEX "StudentLateArrival_courseId_idx" ON "StudentLateArrival"("courseId");

-- CreateIndex
CREATE INDEX "StudentLateArrival_schoolId_idx" ON "StudentLateArrival"("schoolId");

-- CreateIndex
CREATE INDEX "StudentLateArrival_date_idx" ON "StudentLateArrival"("date");

-- AddForeignKey
ALTER TABLE "StudentLateArrival" ADD CONSTRAINT "StudentLateArrival_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLateArrival" ADD CONSTRAINT "StudentLateArrival_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLateArrival" ADD CONSTRAINT "StudentLateArrival_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLateArrival" ADD CONSTRAINT "StudentLateArrival_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
