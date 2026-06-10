import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.middleware'
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
router.get('/by-course',              getMeetingsByCourse)
router.get('/my-course',              getMyMeetingsAsTutor)
router.post('/my-course',             createMeetingAsTutor)
router.post('/by-teacher', createMeetingAsTeacher)

// Rutas genéricas DESPUÉS
router.get('/',                       getMyMeetings)
router.post('/',                      createMeeting)
router.put('/:id',                    updateMeeting)
router.patch('/:id/attendance',       updateAttendance)
router.post('/:id/charge-absences',   chargeAbsences)
router.delete('/:id',                 deleteMeeting)

export default router