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
} from '../controllers/meeting.controller'

const router = Router()

router.use(verifyToken)

router.get('/',                       getMyMeetings)
router.post('/',                      createMeeting)
router.patch('/:id/attendance',       updateAttendance)
router.post('/:id/charge-absences',   chargeAbsences)
router.delete('/:id',                 deleteMeeting)
router.get('/my-course', getMyMeetingsAsTutor)
router.post('/my-course', createMeetingAsTutor)
router.put('/:id', updateMeeting)

export default router