'use client'
import { useEffect, useState } from 'react'
import TeacherHome from './_TeacherHome'
import TutorHome from './_TutorHome'

export default function PlantelDocenteHome() {
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) setRole(JSON.parse(raw).role)
  }, [])

  if (!role) return null
  return role === 'TEACHER_TUTOR' ? <TutorHome/> : <TeacherHome/>
}
