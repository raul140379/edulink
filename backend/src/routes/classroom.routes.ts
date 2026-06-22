import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.middleware'
import {
  getClassrooms,
  createClassroom,
  updateClassroom,
  deleteClassroom,
  assignClassroomToPeriod,
  assignClassroomToCourse,
} from '../controllers/classroom.controller'

const router = Router()

router.get('/',          verifyToken, getClassrooms)
router.post('/',         verifyToken, createClassroom)
router.put('/:id',       verifyToken, updateClassroom)
router.delete('/:id',    verifyToken, deleteClassroom)

// Este va en schedules pero lo manejamos aquí por conveniencia 
router.patch('/course/:courseId/all', verifyToken, assignClassroomToCourse)
router.patch('/:id/classroom', verifyToken, assignClassroomToPeriod)

export default router