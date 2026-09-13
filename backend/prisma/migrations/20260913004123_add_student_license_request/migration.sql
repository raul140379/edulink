-- CreateEnum
CREATE TYPE "LicenseRequestStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "StudentLicenseRequest" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "requestedById" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LicenseRequestStatus" NOT NULL DEFAULT 'PENDIENTE',
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "licenseId" INTEGER,
    "schoolId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentLicenseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentLicenseRequest_licenseId_key" ON "StudentLicenseRequest"("licenseId");

-- CreateIndex
CREATE INDEX "StudentLicenseRequest_studentId_idx" ON "StudentLicenseRequest"("studentId");

-- CreateIndex
CREATE INDEX "StudentLicenseRequest_schoolId_idx" ON "StudentLicenseRequest"("schoolId");

-- CreateIndex
CREATE INDEX "StudentLicenseRequest_status_idx" ON "StudentLicenseRequest"("status");

-- AddForeignKey
ALTER TABLE "StudentLicenseRequest" ADD CONSTRAINT "StudentLicenseRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLicenseRequest" ADD CONSTRAINT "StudentLicenseRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLicenseRequest" ADD CONSTRAINT "StudentLicenseRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLicenseRequest" ADD CONSTRAINT "StudentLicenseRequest_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "StudentLicense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLicenseRequest" ADD CONSTRAINT "StudentLicenseRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
