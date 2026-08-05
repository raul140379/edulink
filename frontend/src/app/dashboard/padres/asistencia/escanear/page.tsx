'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Camera, CameraOff, CheckCircle, Users } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface CheckInResult {
  system: 'CONVOCATORIA' | 'MEETING'
  event:  string
  tutor:  string
}

export default function EscanearPage() {
  const toast = useToast()

  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [lastResult, setLastResult] = useState<CheckInResult | null>(null)

  const inputRef   = useRef<HTMLInputElement>(null)
  const scannerRef = useRef<any>(null)

  const token = () => localStorage.getItem('token') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => () => { stopCamera() }, [])

  const submitCode = async (value: string) => {
    const trimmed = value.trim().toUpperCase()
    if (!trimmed) return
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/attendance-checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ code: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      setLastResult(data)
      toast(`Presente registrado: ${data.tutor}`, 'success')
    } catch { toast('Error de conexión', 'error') }
    finally {
      setLoading(false)
      setCode('')
      inputRef.current?.focus()
    }
  }

  const startCamera = async () => {
    setShowCamera(true)
    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        const scanner = new Html5Qrcode('qr-reader-escanear')
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            stopCamera()
            submitCode(decodedText)
          },
          () => {}
        )
      } catch {
        toast('No se pudo acceder a la cámara', 'error')
        setShowCamera(false)
      }
    }, 300)
  }

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState()
        if (state === 2 || state === 3) await scannerRef.current.stop()
      } catch {}
      try { scannerRef.current.clear() } catch {}
      scannerRef.current = null
    }
    setShowCamera(false)
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/padres/asistencia">
          <Button variant="secondary" size="sm"><ArrowLeft size={14}/></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Escanear QR de asistencia</h1>
          <p className="text-[13px] text-neutral-500">Escanea o ingresa el código del tutor — se marca presente al instante</p>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Card className="flex flex-col gap-4">
          <Input
            ref={inputRef}
            label="Código del tutor" placeholder="Ej: JCF-4827"
            value={code} onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && submitCode(code)}
          />
          <Button onClick={() => submitCode(code)} disabled={!code.trim() || loading} loading={loading}>
            {loading ? 'Registrando...' : 'Registrar asistencia'}
          </Button>

          {!showCamera ? (
            <Button variant="secondary" onClick={startCamera}><Camera size={14}/> Escanear con cámara</Button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-neutral-500">Apunta la cámara al código QR</span>
                <Button variant="danger" size="sm" onClick={stopCamera}><CameraOff size={12}/> Cerrar</Button>
              </div>
              <div id="qr-reader-escanear" className="rounded-lg overflow-hidden"/>
            </div>
          )}
        </Card>

        <Card>
          {!lastResult ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-neutral-500">
              <Users size={40} className="text-neutral-300"/>
              <p className="text-[13px]">Aún no se registró ninguna asistencia en esta sesión</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle size={48} className="text-success-500"/>
              <div className="text-lg font-bold text-brand-700">{lastResult.tutor}</div>
              <Badge tone={lastResult.system === 'CONVOCATORIA' ? 'brand' : 'success'}>
                {lastResult.system === 'CONVOCATORIA' ? 'Convocatoria' : 'Reunión de curso'}: {lastResult.event}
              </Badge>
              <p className="text-[12.5px] text-neutral-500">Presente registrado correctamente</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
