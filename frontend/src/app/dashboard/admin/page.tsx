'use client'

import { useEffect, useState } from 'react'
import SchoolHome from './_SchoolHome'
import DistrictHome from './_DistrictHome'

const DISTRICT_ROLES = ['SUPER_ADMIN', 'DIRECTOR_DISTRITAL']

export default function AdminHome() {
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) setRole(JSON.parse(raw).role)
  }, [])

  if (!role) return null
  if (DISTRICT_ROLES.includes(role)) return <DistrictHome />
  return <SchoolHome />
}
