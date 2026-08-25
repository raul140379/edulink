import { Prisma, RelationType } from '@prisma/client'
import prisma from '../lib/prisma'
import { getTenantContext } from '../lib/tenant-context'
import { Pagination, paginationArgs } from '../utils/pagination'

// El cliente extendido de lib/prisma (tenant-scoping) no es asignable al tipo
// genérico Prisma.TransactionClient de @prisma/client — se infiere el tipo
// real del callback de $transaction en vez de importarlo, mismo truco que ya
// usa academicClosure.repository.ts.
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export const parentRepository = {
  findMany(where: Prisma.ParentWhereInput, pagination?: Pagination) {
    return prisma.parent.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
        students: {
          select: {
            relationType: true,
            isTutor: true,
            student: { select: { id: true, firstName: true, lastName: true, ci: true, rude: true, kardex: true } },
          },
        },
        _count: { select: { students: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      ...paginationArgs(pagination),
    })
  },

  findById(id: number) {
    return prisma.parent.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
        students: {
          include: {
            student: {
              select: {
                id: true, firstName: true, lastName: true, ci: true, rude: true, birthDate: true,
                assignments: {
                  include: { course: true, academicYear: { select: { year: true, isActive: true } } },
                  orderBy: { year: 'desc' }, take: 1,
                },
              },
            },
          },
        },
        charges: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    })
  },

  findRaw(id: number) {
    return prisma.parent.findUnique({ where: { id } })
  },

  findByCI(ci: string) {
    return prisma.parent.findFirst({ where: { ci } })
  },

  findByNameFragment(firstName: string, lastName: string) {
    return prisma.parent.findFirst({
      where: {
        firstName: { contains: firstName, mode: 'insensitive' },
        lastName:  { contains: lastName, mode: 'insensitive' },
      },
    })
  },

  findStudentRelations(parentId: number) {
    return prisma.parentStudent.findMany({
      where: { parentId },
      include: {
        student: {
          select: {
            id: true, firstName: true, lastName: true, ci: true, rude: true, isActive: true,
            assignments: {
              include: { course: true, academicYear: { select: { year: true, isActive: true } } },
              orderBy: { year: 'desc' }, take: 1,
            },
          },
        },
      },
    })
  },

  // Unchecked (FKs escalares) a propósito: el motor de tenant-scoping
  // (lib/prisma.ts) fuerza `data.schoolId` como escalar para cualquier actor
  // de alcance colegio (Director, Secretaria, Junta Escolar, Delegado...) —
  // mezclar eso con `school: {connect}}` hace que Prisma rechace el create
  // ("Unknown argument schoolId"). Con Unchecked, esa asignación solo pisa el
  // mismo campo escalar, sin conflicto.
  create(data: Prisma.ParentUncheckedCreateInput) {
    return prisma.parent.create({ data })
  },

  update(id: number, data: Prisma.ParentUpdateInput) {
    return prisma.parent.update({ where: { id }, data, include: { user: { select: { id: true, email: true, role: true } } } })
  },

  findWithStudentsCount(id: number) {
    return prisma.parent.findUnique({ where: { id }, include: { _count: { select: { students: true } } } })
  },

  findWithFullDetail(id: number) {
    return prisma.parent.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, role: true } },
        students: { include: { student: { select: { id: true, firstName: true, lastName: true } } } },
      },
    })
  },

  setUserActive(userId: number, isActive: boolean) {
    return prisma.user.update({ where: { id: userId }, data: { isActive } })
  },

  linkUser(id: number, userId: number) {
    return prisma.parent.update({ where: { id }, data: { userId } })
  },

  countOtherTutorsFor(studentId: number, excludeParentId: number) {
    return prisma.parentStudent.count({ where: { studentId, isTutor: true, NOT: { parentId: excludeParentId } } })
  },

  // Cuántos registros de historial financiero real (no solo el vínculo
  // ParentStudent) tiene este tutor — deleteParent lo consulta ANTES de
  // borrar nada; si hay algo acá, el borrado se rechaza explícito en vez de
  // chocar a mitad de camino contra la restricción de clave foránea.
  async countFinancialRecords(parentId: number) {
    const [charges, payments, kardexHistory] = await Promise.all([
      prisma.charge.count({ where: { parentId } }),
      prisma.payment.count({ where: { parentId } }),
      prisma.parentKardexHistory.count({ where: { parentId } }),
    ])
    return { charges, payments, kardexHistory }
  },

  // Estos 3 métodos solo se usan dentro de la transacción de deleteParent —
  // reciben el `tx` explícito a propósito, para que un fallo a mitad de
  // camino (ej. el DELETE final del Parent) revierta también los pasos
  // anteriores (ParentStudent, desvinculación de User) en vez de dejar un
  // borrado parcial, que es justo el bug que se corrigió acá.
  deleteRelations(tx: TxClient, parentId: number) {
    return tx.parentStudent.deleteMany({ where: { parentId } })
  },

  async unlinkUser(tx: TxClient, id: number) {
    await tx.$executeRaw`UPDATE "Parent" SET "userId" = NULL WHERE id = ${id}`
  },

  delete(tx: TxClient, id: number) {
    return tx.parent.delete({ where: { id } })
  },

  findRelation(parentId: number, studentId: number) {
    return prisma.parentStudent.findUnique({ where: { parentId_studentId: { parentId, studentId } } })
  },

  createRelation(parentId: number, studentId: number, relationType: RelationType, isTutor: boolean) {
    return prisma.parentStudent.create({
      data: { parentId, studentId, relationType, isTutor },
      include: { student: { select: { firstName: true, lastName: true } } },
    })
  },

  createRelationSimple(parentId: number, studentId: number, relationType: RelationType, isTutor: boolean) {
    return prisma.parentStudent.create({ data: { parentId, studentId, relationType, isTutor } })
  },

  deleteRelation(parentId: number, studentId: number) {
    return prisma.parentStudent.delete({ where: { parentId_studentId: { parentId, studentId } } })
  },

  updateRelation(parentId: number, studentId: number, data: Prisma.ParentStudentUpdateInput) {
    return prisma.parentStudent.update({ where: { parentId_studentId: { parentId, studentId } }, data })
  },

  // Usado por changeTutor al desplazar al tutor legal actual — a diferencia
  // de clearAnyTutorForStudent, NO toca relationType: sigue siendo la madre/
  // el padre/etc. que ya era, solo deja de ser el tutor legal operativo.
  // "OTRO" queda reservado para el caso real de alguien sin parentesco.
  clearTutorFlagForStudent(studentId: number) {
    return prisma.parentStudent.updateMany({
      where: { studentId, isTutor: true },
      data:  { isTutor: false },
    })
  },

  clearAnyTutorForStudent(studentId: number) {
    return prisma.parentStudent.updateMany({
      where: { studentId, isTutor: true },
      data:  { isTutor: false, relationType: 'OTRO' },
    })
  },

  // ── Autoservicio ──────────────────────────────
  findByUserId(userId: number | undefined) {
    return prisma.parent.findUnique({
      where: { userId },
      include: {
        students: {
          include: {
            student: {
              include: { assignments: { include: { course: true, academicYear: { select: { isActive: true, year: true } } } } },
            },
          },
        },
        charges: { where: { status: { not: 'ANULADO' } }, orderBy: { createdAt: 'desc' } },
      },
    })
  },

  findRawByUserId(userId: number | undefined) {
    return prisma.parent.findUnique({ where: { userId } })
  },

  updateProfile(id: number, data: { phone: string | null; email: string | null; address: string | null }) {
    return prisma.parent.update({ where: { id }, data })
  },

  findMyStudentsByUserId(userId: number | undefined) {
    return prisma.parent.findUnique({
      where: { userId },
      include: {
        students: {
          include: {
            student: {
              include: {
                assignments: {
                  where: { academicYear: { isActive: true } },
                  include: {
                    course: { select: { id: true, grade: true, parallel: true, level: true, shift: true } },
                    academicYear: { select: { year: true } },
                  },
                  take: 1,
                },
              },
            },
          },
        },
      },
    })
  },

  // ── Importación ───────────────────────────────
  findStudentsByKardex(kardex: string) {
    return prisma.student.findMany({ where: { kardex } })
  },

  create_simple(data: { firstName: string; lastName: string; ci: string | null; phone: string | null; userId?: number }) {
    // schoolId below is overwritten by the tenant-scoping extension in lib/prisma.ts for the acting user's school.
    return prisma.parent.create({ data: { ...data, schoolId: getTenantContext()?.schoolId ?? 0 } })
  },

  // ── Código/QR de asistencia (solo tutores) ────
  findTutorsWithoutCode() {
    return prisma.parent.findMany({
      where: { attendanceCode: null, students: { some: { isTutor: true } } },
    })
  },

  findByAttendanceCode(code: string) {
    return prisma.parent.findFirst({ where: { attendanceCode: code } })
  },

  updateAttendanceCode(id: number, code: string) {
    return prisma.parent.update({ where: { id }, data: { attendanceCode: code } })
  },

  findAllTutorsWithCodes(pagination?: Pagination) {
    return prisma.parent.findMany({
      where: { students: { some: { isTutor: true } } },
      select: { id: true, firstName: true, lastName: true, ci: true, attendanceCode: true, kardex: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      ...paginationArgs(pagination),
    })
  },

  // ── Kardex de tutor (atributo del Parent, no del Student) ────
  findByKardex(kardex: string) {
    return prisma.parent.findFirst({ where: { kardex } })
  },

  updateKardex(id: number, kardex: string) {
    return prisma.parent.update({ where: { id }, data: { kardex } })
  },

  // Liberación manual — un humano confirma que la familia ya no tiene ningún
  // estudiante en la UE. Libera también attendanceCode: el código quedaría
  // apuntando a un kardex que ya no le pertenece.
  releaseKardex(id: number) {
    return prisma.parent.update({ where: { id }, data: { kardex: null, attendanceCode: null } })
  },

  findAllKardexValues() {
    return prisma.parent.findMany({ where: { kardex: { not: null } }, select: { kardex: true } })
  },

  // select explícito (no todo el modelo): los 3 usos en parent.service.ts
  // (buildAttendanceCode, getAllWithStatus, getParentsGroupedByCourse) solo
  // leen id/year — así esta lectura no depende de que el schema desplegado
  // esté 100% sincronizado con la DB real (ver CLAUDE.md 18.1, incidente
  // 22-ago-2026, P2022 por una columna nueva sin migrar en producción).
  findActiveAcademicYear() {
    return prisma.academicYear.findFirst({
      where: { isActive: true },
      select: { id: true, year: true },
    })
  },

  // Todos los padres (cualquier relación) con la info mínima para calcular si
  // tienen algún hijo matriculado en la gestión activa (Activo) o no
  // (Inactivo) — ver parentService.getAllWithStatus.
  findAllWithEnrollmentStatus(activeYearId: number, pagination?: Pagination) {
    return prisma.parent.findMany({
      include: {
        user: { select: { id: true, email: true, isActive: true } },
        students: {
          include: {
            student: {
              select: {
                id: true, firstName: true, lastName: true,
                assignments: { where: { academicYearId: activeYearId }, select: { id: true } },
              },
            },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      ...paginationArgs(pagination),
    })
  },

  // Padres/tutores agrupados por curso (Familias → Listado) — mismo shape que
  // treasuryRepository.findChargesGroupedByCourse, sin la parte de cargos.
  // courseId opcional — lo usa DELEGATE para acotar el resultado a su propio
  // curso (ver parentService.getParentsGroupedByCourse); sin él, trae todos
  // los cursos del colegio (JUNTA_ESCOLAR y demás roles de alcance completo).
  findAllGroupedByCourse(schoolId: number, academicYearId: number, courseId?: number) {
    return prisma.course.findMany({
      where: { schoolId, ...(courseId ? { id: courseId } : {}) },
      include: {
        assignments: {
          where: { academicYearId },
          include: {
            student: {
              select: {
                id: true, firstName: true, lastName: true,
                parents: {
                  include: {
                    parent: {
                      select: {
                        id: true, firstName: true, lastName: true, ci: true, phone: true,
                        email: true, address: true, kardex: true, attendanceCode: true,
                        user: { select: { id: true, email: true, isActive: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ level: 'asc' }, { grade: 'asc' }, { parallel: 'asc' }],
    })
  },
}
