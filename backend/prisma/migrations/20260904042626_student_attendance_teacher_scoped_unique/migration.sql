-- Mitigación urgente contra pisado silencioso entre maestros del mismo
-- curso (4-sep-2026): teacherId entra a la clave única. Ensanchar una
-- restricción única nunca puede violar los datos ya existentes (todo lo
-- que ya cumplía la restricción vieja, más angosta, cumple automáticamente
-- la nueva, más ancha) — 100% seguro, sin backfill.
DROP INDEX "StudentAttendance_studentId_courseId_date_key";

CREATE UNIQUE INDEX "StudentAttendance_studentId_courseId_date_teacherId_key" ON "StudentAttendance"("studentId", "courseId", "date", "teacherId");
