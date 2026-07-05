import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import {
  createMeetingSchema, createMeetingAsTeacherSchema, updateMeetingSchema, updateAttendanceSchema, chargeAbsencesSchema,
} from '../schemas/meeting.schema'
import {
  getMyMeetings,
  createMeeting,
  updateAttendance,
  chargeAbsences,
  deleteMeeting,
  getMyMeetingsAsTutor,
  createMeetingAsTutor,
  updateMeeting,
  getMeetingsByCourse,
  createMeetingAsTeacher,
} from '../controllers/meeting.controller'

const router = Router()

router.use(verifyToken)

// Rutas específicas PRIMERO
router.get('/by-course',              requirePermission(Permission.MEETING_VIEW), getMeetingsByCourse)
router.get('/my-course',              requirePermission(Permission.MEETING_VIEW), getMyMeetingsAsTutor)
router.post('/my-course',             requirePermission(Permission.MEETING_CREATE), validateBody(createMeetingSchema), createMeetingAsTutor)
router.post('/by-teacher',            requirePermission(Permission.MEETING_CREATE), validateBody(createMeetingAsTeacherSchema), createMeetingAsTeacher)

// Rutas genéricas DESPUÉS
router.get('/',                       requirePermission(Permission.MEETING_VIEW), getMyMeetings)
router.post('/',                      requirePermission(Permission.MEETING_CREATE), validateBody(createMeetingSchema), createMeeting)
router.put('/:id',                    requirePermission(Permission.MEETING_CREATE), validateBody(updateMeetingSchema), updateMeeting)
router.patch('/:id/attendance',       requirePermission(Permission.MEETING_CREATE), validateBody(updateAttendanceSchema), updateAttendance)
router.post('/:id/charge-absences',   requirePermission(Permission.CHARGE_CREATE), validateBody(chargeAbsencesSchema), chargeAbsences)
router.delete('/:id',                 requirePermission(Permission.MEETING_CREATE), deleteMeeting)

export default router
