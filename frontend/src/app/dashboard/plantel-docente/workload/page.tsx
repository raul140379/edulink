'use client'
import { useEffect, useState } from 'react'
import TeacherView from './_TeacherView'
import TutorView from './_TutorView'

export default function WorkloadPage() {
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) setRole(JSON.parse(raw).role)
  }, [])

  if (!role) return null
  return role === 'TEACHER_TUTOR' ? <TutorView/> : <TeacherView/>
}
