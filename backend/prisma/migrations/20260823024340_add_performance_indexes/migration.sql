-- CreateIndex
CREATE INDEX "Charge_schoolId_idx" ON "Charge"("schoolId");

-- CreateIndex
CREATE INDEX "Charge_parentId_idx" ON "Charge"("parentId");

-- CreateIndex
CREATE INDEX "Charge_academicYearId_idx" ON "Charge"("academicYearId");

-- CreateIndex
CREATE INDEX "Charge_studentId_idx" ON "Charge"("studentId");

-- CreateIndex
CREATE INDEX "Nota_studentId_idx" ON "Nota"("studentId");

-- CreateIndex
CREATE INDEX "Nota_schoolId_idx" ON "Nota"("schoolId");

-- CreateIndex
CREATE INDEX "Notification_parentId_idx" ON "Notification"("parentId");

-- CreateIndex
CREATE INDEX "Notification_schoolId_idx" ON "Notification"("schoolId");

-- CreateIndex
CREATE INDEX "Parent_schoolId_idx" ON "Parent"("schoolId");

-- CreateIndex
CREATE INDEX "ParentStudent_studentId_idx" ON "ParentStudent"("studentId");

-- CreateIndex
CREATE INDEX "Payment_parentId_idx" ON "Payment"("parentId");

-- CreateIndex
CREATE INDEX "Payment_schoolId_idx" ON "Payment"("schoolId");

-- CreateIndex
CREATE INDEX "Student_schoolId_idx" ON "Student"("schoolId");

-- CreateIndex
CREATE INDEX "StudentAcademicAssignment_academicYearId_idx" ON "StudentAcademicAssignment"("academicYearId");

-- CreateIndex
CREATE INDEX "StudentAttendance_studentId_idx" ON "StudentAttendance"("studentId");

-- CreateIndex
CREATE INDEX "StudentAttendance_schoolId_idx" ON "StudentAttendance"("schoolId");

-- CreateIndex
CREATE INDEX "TeacherAttendance_schoolId_idx" ON "TeacherAttendance"("schoolId");

-- CreateIndex
CREATE INDEX "User_schoolId_idx" ON "User"("schoolId");
