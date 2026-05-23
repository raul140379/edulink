import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes     from './routes/auth.routes'
import userRoutes     from './routes/user.routes'
import academicRoutes from './routes/academic.routes'
import courseRoutes   from './routes/course.routes'
import studentRoutes  from './routes/student.routes'
import parentRoutes   from './routes/parent.routes'
import teacherRoutes  from './routes/teacher.routes'
import treasuryRoutes from './routes/treasury.routes'
import delegateRoutes from './routes/delegate.routes'
import meetingRoutes from './routes/meeting.routes'
import subjectRoutes from './routes/subject.routes'
import reportRoutes from './routes/report.routes'
import notificationRoutes from './routes/notification.routes'

dotenv.config()

const app  = express()
const PORT = parseInt(process.env.PORT || '4000')

// CORS: en producción acepta cualquier origen, en local solo localhost:3000
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? '*'
  : 'http://localhost:3000'

app.use(cors({
  origin: allowedOrigins,
  credentials: process.env.NODE_ENV !== 'production'
}))

app.use(express.json())

app.use('/api/auth',     authRoutes)
app.use('/api/users',    userRoutes)
app.use('/api/academic', academicRoutes)
app.use('/api/courses',  courseRoutes)
app.use('/api/students', studentRoutes)
app.use('/api/parents',  parentRoutes)
app.use('/api/teachers', teacherRoutes)
app.use('/api/treasury', treasuryRoutes)
app.use('/api/delegates', delegateRoutes)
app.use('/api/meetings', meetingRoutes)
app.use('/api/subjects', subjectRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/notifications', notificationRoutes)
app.get('/', (req, res) => {
  res.json({ message: '🚀 SGJE Backend funcionando correctamente', version: '1.0.0' })
})

// Escuchar en 0.0.0.0 para que Railway pueda acceder
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`)
})

export default app