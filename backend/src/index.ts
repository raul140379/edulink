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
import convocatoriaRoutes from './routes/convocatoria.routes'
import subjectRoutes from './routes/subject.routes'
import reportRoutes from './routes/report.routes'
import notificationRoutes from './routes/notification.routes'
import notaRoutes from './routes/nota.routes'
import taskRoutes from './routes/task.routes'
import adminRoutes from './routes/admin.routes'
import teacherAttendanceRoutes from './routes/teacherAttendance.routes'
import scheduleRoutes from './routes/schedule.routes'
import classroomRoutes from './routes/classroom.routes'
import gateRoutes from './routes/gate.routes'
import studentAttendanceRoutes from './routes/studentAttendance.routes'
import studentLicenseRoutes from './routes/studentLicense.routes'
import planificacionRoutes from './routes/planificacion.routes'
import schoolRoutes from './routes/school.routes'
import nucleoRoutes from './routes/nucleo.routes'
import comunicadoRoutes from './routes/comunicado.routes'
import publicRoutes from './routes/public.routes'
import districtRoutes from './routes/district.routes'
import juntaRoutes from './routes/junta.routes'
import gobiernoRoutes from './routes/gobierno.routes'
import poaActaRoutes from './routes/poa-acta.routes'
import attendanceCheckinRoutes from './routes/attendance-checkin.routes'
import sportsParticipantRoutes from './routes/sportsParticipant.routes'

dotenv.config()

const app  = express()
const PORT = parseInt(process.env.PORT || '4000')

// CORS: en producción acepta cualquier origen (cada app-por-rol tiene su
// propio dominio en Vercel); en local, cada app de desarrollo corre en su
// propio puerto (frontend admin 3000, maestro-app 3001, próximas apps
// livianas suman su puerto acá) — más cualquier IP de red local (192.168.*/
// 10.*/172.16-31.*), necesario para probar en el celular real desde la
// misma red, sin depender de que la IP quede fija (DHCP puede cambiarla).
const LOCAL_NETWORK_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):\d+$/

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? '*' : (origin, callback) => {
    if (!origin || LOCAL_NETWORK_ORIGIN.test(origin)) callback(null, true)
    else callback(new Error('No permitido por CORS'))
  },
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
app.use('/api/notas', notaRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/admin',         adminRoutes)   
app.use('/api/teacher-attendance', teacherAttendanceRoutes)
app.use('/api/schedules', scheduleRoutes)
app.use('/api/classrooms', classroomRoutes)
app.use('/api/gate', gateRoutes)
app.use('/api/student-attendance', studentAttendanceRoutes)
app.use('/api/student-licenses', studentLicenseRoutes)
app.use('/api/planificacion', planificacionRoutes)
app.use('/api/schools', schoolRoutes)
app.use('/api/nucleos', nucleoRoutes)
app.use('/api/comunicados', comunicadoRoutes)
app.use('/api/public', publicRoutes)
app.use('/api/district', districtRoutes)
app.use('/api/junta', juntaRoutes)
app.use('/api/convocatorias', convocatoriaRoutes)
app.use('/api/gobierno', gobiernoRoutes)
app.use('/api/poa-acta', poaActaRoutes)
app.use('/api/attendance-checkin', attendanceCheckinRoutes)
app.use('/api/sports-participants', sportsParticipantRoutes)

app.get('/', (req, res) => {
  res.json({ message: '🚀 EduLink Backend funcionando correctamente', version: '1.0.0' })
})

// Escuchar en 0.0.0.0 para que Railway pueda acceder
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`)
})

export default app