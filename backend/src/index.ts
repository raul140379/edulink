import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes    from './routes/auth.routes'
import userRoutes    from './routes/user.routes'
import academicRoutes from './routes/academic.routes'
import courseRoutes  from './routes/course.routes'
import studentRoutes from './routes/student.routes'
import parentRoutes  from './routes/parent.routes'
import teacherRoutes from './routes/teacher.routes'

dotenv.config()

const app  = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: 'http://localhost:3000', credentials: true }))
app.use(express.json())

app.use('/api/auth',     authRoutes)
app.use('/api/users',    userRoutes)
app.use('/api/academic', academicRoutes)
app.use('/api/courses',  courseRoutes)
app.use('/api/students', studentRoutes)
app.use('/api/parents',  parentRoutes)
app.use('/api/teachers', teacherRoutes)

app.get('/', (req, res) => {
  res.json({ message: '🚀 SGJE Backend funcionando correctamente', version: '1.0.0' })
})

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`)
})

export default app