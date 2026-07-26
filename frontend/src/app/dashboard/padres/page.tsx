'use client'
import { useEffect, useState } from 'react'
import ParentHome from './_ParentHome'
import JuntaHome from './_JuntaHome'
import DelegateHome from './_DelegateHome'
import JuntaNucleoHome from './_JuntaNucleoHome'
import JuntaDistritoHome from './_JuntaDistritoHome'

export default function PadresHome() {
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) setRole(JSON.parse(raw).role)
  }, [])

  if (!role) return null
  if (role === 'JUNTA_DISTRITO') return <JuntaDistritoHome/>
  if (role === 'JUNTA_NUCLEO') return <JuntaNucleoHome/>
  if (role === 'JUNTA_ESCOLAR') return <JuntaHome/>
  if (role === 'DELEGATE') return <DelegateHome/>
  return <ParentHome/>
}
