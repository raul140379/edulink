import prisma from '../lib/prisma'
import { getTenantContext } from '../lib/tenant-context'

const tutorParentSelect = { select: { id: true, firstName: true, lastName: true, ci: true, phone: true } }
const attendancesWithParent = { include: { attendances: { include: { parent: tutorParentSelect } } } }

export const meetingRepository = {
  findParentByUserId(userId: number | undefined) {
    return prisma.parent.findFirst({ where: { OR: [{ userId }, { delegateUserId: userId }] }, include: { delegateCourse: true } })
  },

  findParentWithDelegateCourseAssignments(userId: number | undefined) {
    return prisma.parent.findFirst({
      where: { OR: [{ userId }, { delegateUserId: userId }] },
      include: {
        delegateCourse: {
          include: {
            assignments: {
              where: { academicYear: { isActive: true } },
              include: {
                student: {
                  include: {
                    parents: { where: { isTutor: true }, include: { parent: { select: { id: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    })
  },

  findMeetingsByCourse(courseId: number) {
    return prisma.meeting.findMany({
      where: { courseId },
      ...attendancesWithParent,
      orderBy: { date: 'desc' },
    })
  },

  createMeeting(data: { title: string; date: Date; courseId: number; createdById: number; parentIds: number[] }) {
    // schoolId below is overwritten by the tenant-scoping extension in lib/prisma.ts for the acting user's school.
    return prisma.meeting.create({
      data: {
        title: data.title,
        date: data.date,
        courseId: data.courseId,
        createdById: data.createdById,
        schoolId: getTenantContext()?.schoolId ?? 0,
        attendances: { create: data.parentIds.map((parentId) => ({ parentId, present: false })) },
      },
      ...attendancesWithParent,
    })
  },

  updateAttendance(meetingId: number, parentId: number, present: boolean, note?: string) {
    return prisma.attendance.updateMany({ where: { meetingId, parentId }, data: { present, note: note || null } })
  },

  findMeetingWithAbsentAttendances(id: number) {
    return prisma.meeting.findUnique({
      where: { id },
      include: { attendances: { where: { present: false }, include: { parent: true } } },
    })
  },

  createCharges(charges: { title: string; description: string; amount: number; parentId: number; academicYearId: number }[]) {
    // schoolId below is overwritten by the tenant-scoping extension in lib/prisma.ts for the acting user's school.
    const schoolId = getTenantContext()?.schoolId ?? 0
    return prisma.charge.createMany({
      data: charges.map((c) => ({
        title: c.title, description: c.description, amount: c.amount, paidAmount: 0,
        type: 'MULTA_REUNION', target: 'TUTOR', status: 'PENDIENTE',
        parentId: c.parentId, academicYearId: c.academicYearId, schoolId,
      })),
    })
  },

  deleteMeetingAttendances(meetingId: number) {
    return prisma.attendance.deleteMany({ where: { meetingId } })
  },

  deleteMeeting(id: number) {
    return prisma.meeting.delete({ where: { id } })
  },

  findTeacherTutorByUserId(userId: number | undefined) {
    return prisma.teacher.findFirst({ where: { tutorUserId: userId }, include: { tutorCourse: true } })
  },

  findTeacherTutorWithCourseAssignments(userId: number | undefined) {
    return prisma.teacher.findFirst({
      where: { tutorUserId: userId },
      include: {
        tutorCourse: {
          include: {
            course: {
              include: {
                assignments: {
                  where: { academicYear: { isActive: true } },
                  include: {
                    student: {
                      include: {
                        parents: { where: { isTutor: true }, include: { parent: { select: { id: true } } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })
  },

  findAssignmentsForCourse(courseId: number) {
    return prisma.studentAcademicAssignment.findMany({
      where: { courseId, academicYear: { isActive: true } },
      include: {
        student: {
          include: { parents: { where: { isTutor: true }, include: { parent: { select: { id: true } } } } },
        },
      },
    })
  },

  updateMeeting(id: number, data: { title: string; date: Date }) {
    return prisma.meeting.update({ where: { id }, data })
  },

  // Check-in por QR/código: reunión de hoy para este tutor, sin importar el
  // curso. Lectura simple — el escaneo escribe vía updateAttendance de arriba,
  // no pasa por meetingService (así evita el candado de Presidente).
  findOpenTodayForTutor(parentId: number, start: Date, end: Date) {
    return prisma.attendance.findFirst({
      where: { parentId, meeting: { date: { gte: start, lt: end } } },
      include: { meeting: true },
    })
  },
}
