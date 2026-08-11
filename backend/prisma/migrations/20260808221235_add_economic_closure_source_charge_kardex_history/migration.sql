-- AlterTable
ALTER TABLE "AcademicYear" ADD COLUMN     "economicClosedAt" TIMESTAMP(3),
ADD COLUMN     "economicClosedById" INTEGER;

-- AlterTable
ALTER TABLE "Charge" ADD COLUMN     "sourceChargeId" INTEGER;

-- CreateTable
CREATE TABLE "ParentKardexHistory" (
    "id" SERIAL NOT NULL,
    "parentId" INTEGER NOT NULL,
    "academicYearId" INTEGER NOT NULL,
    "kardex" TEXT NOT NULL,
    "schoolId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentKardexHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParentKardexHistory_parentId_academicYearId_key" ON "ParentKardexHistory"("parentId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentKardexHistory_kardex_academicYearId_schoolId_key" ON "ParentKardexHistory"("kardex", "academicYearId", "schoolId");

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_economicClosedById_fkey" FOREIGN KEY ("economicClosedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentKardexHistory" ADD CONSTRAINT "ParentKardexHistory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentKardexHistory" ADD CONSTRAINT "ParentKardexHistory_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentKardexHistory" ADD CONSTRAINT "ParentKardexHistory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_sourceChargeId_fkey" FOREIGN KEY ("sourceChargeId") REFERENCES "Charge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
